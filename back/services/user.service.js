const { Types }      = require("mongoose");
const User           = require("../models/User");
const Workout        = require("../models/Workout");
const ExerciseRecord = require("../models/ExerciseRecord");
const Friendship     = require("../models/Friendship");
const StreakGroup    = require("../models/StreakGroup");
const ActivityEvent  = require("../models/ActivityEvent");
const WeightHistory  = require("../models/WeightHistory");
const WorkoutLobby   = require("../models/WorkoutLobby");
const CloudItem      = require("../models/CloudItem");

function userNotFound() {
  const err = new Error("Ce compte est introuvable.");
  err.statusCode = 404;
  err.code = "USER_NOT_FOUND";
  return err;
}

/**
 * Service gérant la logique liée aux utilisateurs (profil, progression, XP).
 */
// ─── Plafond de vraisemblance de l'XP synchronisée ───────────────────────────
// L'XP est calculée sur le téléphone (local-first) : sans garde, une seule
// requête suffisait à s'offrir le niveau 200 et la tête du classement. Le
// plafond grandit avec l'ancienneté du compte, à un rythme qu'aucun joueur
// réel n'atteint (2 séances XP par jour, quêtes, objets, coupons compris) :
// un vrai joueur n'est jamais bridé, un compte neuf ne peut pas tricher.
// Désactivé en développement local pour garder les outils de test.
const XP_CEILING_PER_DAY = 15000;
const DAY_MS = 24 * 60 * 60 * 1000;

function plausibleXpCeiling(createdAt, now = Date.now()) {
  if (require("../config/env").nodeEnv === "development") return Infinity;
  const created = createdAt ? new Date(createdAt).getTime() : now;
  const days = Math.max(0, Math.floor((now - created) / DAY_MS));
  return (days + 1) * XP_CEILING_PER_DAY;
}

// Date de mise en ligne de sync-xp (commit du 2026-07-10) : à partir de là,
// chaque séance terminée a été comptée deux fois dans user.xp.
const SYNC_XP_RELEASE = new Date('2026-07-10T00:00:00.000Z');

// XP qu'a ajoutée finalizeWorkout pour chaque séance terminée depuis
// SYNC_XP_RELEASE (et avant la correction : serverXpAdded absent). Même règle
// que l'ancien code : séance courte 0, moins de 15 min ÷ 10.
async function legacyServerAddedXp(userId) {
  const docs = await Workout.find({
    user: userId,
    status: { $in: Workout.FINAL_STATUSES },
    serverXpAdded: { $exists: false },
    updatedAt: { $gte: SYNC_XP_RELEASE },
  }).select('xpEarned durationSeconds shortSession').lean();
  return docs.reduce((sum, w) => {
    const xp = Number(w.xpEarned) || 0;
    const duration = Number(w.durationSeconds) || 0;
    if (w.shortSession || duration < 300) return sum;
    return sum + (duration < 900 ? Math.round(xp / 10) : xp);
  }, 0);
}

class UserService {
  /**
   * Récupère le profil complet d'un utilisateur sans son mot de passe.
   * @param {string} userId - L'ID de l'utilisateur.
   */
  async getUserProfile(userId) {
    // .select("-password") permet d'exclure le champ mot de passe par sécurité
    const user = await User.findById(userId).select("-password");
    if (!user) throw userNotFound();

    // Génération lazy pour les comptes antérieurs au parrainage à l'inscription :
    // tout utilisateur qui consulte son profil obtient son code une fois pour toutes.
    if (!user.referralCode) {
      const { uniqueReferralCode } = require("./auth.service");
      user.referralCode = await uniqueReferralCode();
      await user.save();
    }

    // Génération lazy du tag Discord (Section III) pour les comptes créés
    // avant cette fonctionnalité — même idiome que referralCode ci-dessus.
    if (!user.discriminator) {
      const { uniqueDiscriminator } = require("./auth.service");
      user.discriminator = await uniqueDiscriminator(user.pseudo);
      await user.save();
    }

    // Présence : getMe est appelé à chaque focus d'écran côté front, ce qui
    // en fait un signal "activité récente" fiable pour la Météo des séances
    // (statut 🔥 Prêt) sans avoir besoin d'un endpoint de heartbeat dédié.
    // Fire-and-forget : ne doit jamais retarder ni faire échouer la réponse.
    User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } }).catch(() => {});

    return user;
  }

  /**
   * Met à jour les informations de l'utilisateur.
   * @param {string} userId - L'ID de l'utilisateur.
   * @param {Object} updateData - Les données à modifier (poids, taille, etc.).
   */
  async updateUser(userId, updateData) {
    // Changement de pseudo : le tag #1234 doit rester unique pour ce pseudo.
    // On garde le tag actuel s'il est libre, sinon on en tire un nouveau.
    if (updateData.pseudo) {
      const current = await User.findById(userId).select("pseudo discriminator").lean();
      if (!current) throw userNotFound();
      const samePseudo = String(current.pseudo || "").toLowerCase() === updateData.pseudo.toLowerCase();
      if (!samePseudo) {
        const taken = await User.exists({ pseudo: updateData.pseudo, discriminator: current.discriminator, _id: { $ne: userId } })
          .collation({ locale: "en", strength: 2 });
        if (taken || !current.discriminator) {
          const { uniqueDiscriminator } = require("./auth.service");
          updateData = { ...updateData, discriminator: await uniqueDiscriminator(updateData.pseudo) };
        }
      }
    }

    // $set explicite : seuls les champs validés par Joi (user.validator.js) sont modifiés
    const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, {
      returnDocument: "after",
      runValidators: true, // Force la validation des enums dans le schéma
    }).select("-password");
    if (!updatedUser) throw userNotFound();

    return updatedUser;
  }

  /**
   * Suppression définitive du compte (RGPD, droit à l'effacement).
   * Efface TOUTES les données personnelles liées au compte, pas seulement le
   * document User : séances, records, pesées, amitiés, présence dans les
   * groupes et lobbys, événements et réactions du flux d'activité.
   * Les références restantes chez d'autres utilisateurs (filleuls) sont
   * détachées pour ne laisser aucun identifiant orphelin.
   * @param {string} userId
   */
  async deleteAccount(userId) {
    const id = new Types.ObjectId(userId);

    await Promise.all([
      ExerciseRecord.deleteMany({ user: id }),
      Workout.deleteMany({ user: id }),
      WeightHistory.deleteMany({ user: id }),
      CloudItem.deleteMany({ user: id }),
      Friendship.deleteMany({ $or: [{ requester: id }, { recipient: id }] }),
      ActivityEvent.deleteMany({ actor: id }),
      ActivityEvent.updateMany({ "reactions.user": id }, { $pull: { reactions: { user: id } } }),
      StreakGroup.updateMany(
        { $or: [{ members: id }, { pendingInvites: id }, { shameBreakers: id }, { "shakes.from": id }] },
        { $pull: { members: id, pendingInvites: id, shameBreakers: id, shakes: { from: id } } },
      ),
      StreakGroup.updateMany({ "shakes.to": id }, { $pull: { shakes: { to: id } } }),
      WorkoutLobby.updateMany(
        { "members.user": id },
        [
          { $set: { members: { $filter: { input: "$members", cond: { $ne: ["$$this.user", id] } } } } },
          { $set: { memberCount: { $size: "$members" } } },
        ],
        { updatePipeline: true },
      ),
      User.updateMany({ referredBy: id }, { $set: { referredBy: null } }),
    ]);

    // Nettoyage des conteneurs devenus vides ou incohérents
    await Promise.all([
      StreakGroup.deleteMany({ members: { $size: 0 } }),
      WorkoutLobby.deleteMany({ $or: [{ creatorId: id }, { members: { $size: 0 } }] }),
    ]);

    await User.findByIdAndDelete(id);
  }

  /**
   * Met à jour atomiquement la vitrine de trophées (max 3 IDs).
   * Les IDs sont filtrés sur le catalogue unifié (backend + local) : aucune
   * valeur arbitraire ne peut être stockée puis affichée chez un ami.
   * @param {string} userId
   * @param {string[]} achievementIds
   */
  async updateShowcase(userId, achievementIds) {
    const { ACHIEVEMENT_CATALOG } = require('../controllers/reward.controller');
    const { LOCAL_TROPHY_CATALOG } = require('../data/localTrophyCatalog');

    const validIds = [...new Set(achievementIds)]
      .filter((id) => ACHIEVEMENT_CATALOG[id] || LOCAL_TROPHY_CATALOG[id])
      .slice(0, 3);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { showcasedAchievements: validIds } },
      { returnDocument: 'after', runValidators: true },
    ).select('showcasedAchievements');
    if (!updatedUser) throw userNotFound();
    return updatedUser;
  }

  /**
   * Met à jour atomiquement les records d'exercices mis en avant (max 6).
   * Seuls des exercices pour lesquels l'utilisateur a AU MOINS un
   * ExerciseRecord sont acceptés — impossible de mettre en avant un
   * exercice jamais pratiqué. L'ordre saisi est conservé (ordre d'affichage).
   * @param {string} userId
   * @param {string[]} exerciseNames
   */
  async updateRecordsShowcase(userId, exerciseNames) {
    const ExerciseRecord = require('../models/ExerciseRecord');

    const dedup = [...new Set(exerciseNames)].slice(0, 6);
    const owned = await ExerciseRecord.distinct('exerciceNom', { user: userId, exerciceNom: { $in: dedup } });
    const ownedSet = new Set(owned);
    const validNames = dedup.filter((n) => ownedSet.has(n));

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { showcasedRecords: validNames } },
      { returnDocument: 'after', runValidators: true },
    ).select('showcasedRecords');
    if (!updatedUser) throw userNotFound();
    return updatedUser;
  }

  /**
   * Met à jour atomiquement le cadre de profil équipé (forme + couleur).
   * @param {string} userId
   * @param {string} shapeId
   * @param {string} colorId
   */
  async updateEquippedFrame(userId, shapeId, colorId) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { 'equippedFrame.shapeId': shapeId, 'equippedFrame.colorId': colorId } },
      { returnDocument: 'after', runValidators: true },
    ).select('equippedFrame');
    if (!updatedUser) throw userNotFound();
    return updatedUser;
  }

  /**
   * Enregistre (ou efface, si null) le token Expo Push de l'appareil courant.
   * @param {string} userId
   * @param {string|null} pushToken
   */
  async registerPushToken(userId, pushToken) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { pushToken } },
      { returnDocument: 'after' },
    ).select('pushToken');
    if (!updatedUser) throw userNotFound();
    return updatedUser;
  }

  /**
   * Marque le tutoriel/onboarding comme terminé pour cet utilisateur.
   * Idempotent : rejouer ne change rien une fois le flag à true. Le client
   * appelle ceci en best-effort à la fin (ou au skip) du tutoriel — la vérité
   * immédiate reste AsyncStorage, ce flag backend sert la cohérence
   * inter-appareils (voir TutorialContext.js).
   * @param {string} userId
   */
  async completeOnboarding(userId) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { hasCompletedOnboarding: true } },
      { returnDocument: 'after' },
    ).select('hasCompletedOnboarding');
    if (!updatedUser) throw userNotFound();
    return updatedUser;
  }

  /**
   * Synchronise l'XP totale calculée localement (front, AsyncStorage-first)
   * vers user.xp/level backend — Source de Vérité pour tout ce qui est gated
   * côté serveur (coffres niveau 11+, conditions de titres comme PERFORM_LEVEL_50).
   *
   * Sans ce point de synchro explicite, le niveau backend dérive silencieusement
   * de celui vécu par le joueur : `finalizeWorkout` calcule sa PROPRE xp
   * (anti-cheat serveur, à partir des exercices soumis) plutôt que d'adopter
   * l'xp locale — les deux ledgers divergent avec le temps.
   *
   * Sécurité : XP en lecture seule ratchet (ne redescend jamais) — un sync
   * redondant ou tardif ne peut jamais effacer une progression déjà actée.
   * Bornée à xpForLevel(MAX_LEVEL) pour rejeter tout payload absurde (la
   * validation Joi en amont ne fait qu'un garde-fou grossier).
   *
   * @param {string} userId
   * @param {number} submittedXp — XP cumulée locale (jamais un delta)
   * @returns {{ level, xp, rank, newlyUnlockedTitles }}
   */
  async syncXp(userId, submittedXp) {
    const { levelFromXP, getRankForLevel, xpForLevel, MAX_LEVEL } = require('../utils/levelHelpers');

    // Compte sauvegardé : l'XP se calcule à partir des séances sauvegardées,
    // pas du total envoyé (voir recomputeXpFromBackup).
    if (await CloudItem.exists({ user: userId, kind: 'logs' })) {
      return this.recomputeXpFromBackup(userId);
    }

    const user = await User.findById(userId).select('xp level rank createdAt');
    if (!user) throw userNotFound();

    const ceiling = Math.min(xpForLevel(MAX_LEVEL), plausibleXpCeiling(user.createdAt));
    const clampedXp = Math.max(0, Math.min(submittedXp, ceiling));
    const nextXp = Math.max(user.xp || 0, clampedXp);

    let newlyUnlockedTitles = [];

    if (nextXp !== user.xp) {
      user.xp    = nextXp;
      user.level = levelFromXP(nextXp);
      user.rank  = getRankForLevel(user.level);
      await user.save();

      // Require tardif : évite le cycle user.service ↔ title.controller au
      // chargement des modules (voir même idiome dans reward.controller.js).
      try {
        const { checkAndUnlockTitles } = require('../controllers/title.controller');
        newlyUnlockedTitles = await checkAndUnlockTitles(userId);
      } catch (_) {
        // best-effort — la synchro XP elle-même ne doit jamais échouer pour ça.
      }
    }

    return {
      level: user.level,
      xp:    user.xp,
      rank:  user.rank,
      newlyUnlockedTitles,
    };
  }

  /**
   * XP du compte = somme de l'XP de toutes les entrées sauvegardées de
   * l'historique (séances, quêtes, rituels, bonus), bornée par le plafond
   * d'ancienneté. Même chiffre que celui affiché dans l'app, puisque l'app
   * calcule son total à partir des mêmes entrées. Une séance supprimée fait
   * donc aussi baisser l'XP du compte.
   *
   * Avant ce calcul, l'XP du compte était gonflée : l'app envoyait son total
   * (sync-xp), PUIS finalizeWorkout ajoutait encore l'XP de la séance. Le
   * premier recalcul corrige ce double comptage, après avoir mémorisé xpFloor.
   * @param {string} userId
   */
  async recomputeXpFromBackup(userId) {
    const { levelFromXP, getRankForLevel, xpForLevel, MAX_LEVEL } = require('../utils/levelHelpers');
    const user = await User.findById(userId).select('xp level rank createdAt xpFloor');
    if (!user) throw userNotFound();
    await this.ensureXpFloor(user);

    const [agg] = await CloudItem.aggregate([
      { $match: { user: new Types.ObjectId(String(userId)), kind: 'logs', deleted: false } },
      { $group: {
        _id: null,
        xp: { $sum: { $max: [0, { $convert: { input: '$data.xpEarned', to: 'double', onError: 0, onNull: 0 } }] } },
      } },
    ]);
    const ceiling = Math.min(xpForLevel(MAX_LEVEL), plausibleXpCeiling(user.createdAt));
    const nextXp = Math.round(Math.min(agg ? agg.xp : 0, ceiling));

    let newlyUnlockedTitles = [];
    if (nextXp !== user.xp) {
      user.xp    = nextXp;
      user.level = levelFromXP(nextXp);
      user.rank  = getRankForLevel(user.level);
      await user.save();
      try {
        const { checkAndUnlockTitles } = require('../controllers/title.controller');
        newlyUnlockedTitles = await checkAndUnlockTitles(userId);
      } catch (_) {
        // best-effort
      }
    }
    return { level: user.level, xp: user.xp, rank: user.rank, newlyUnlockedTitles };
  }

  /**
   * Mémorise une fois pour toutes l'XP acquise avant la sauvegarde du compte,
   * sans le double comptage : XP du compte − XP ajoutée par le serveur pour
   * chaque séance terminée depuis l'arrivée de sync-xp. Doit être appelée
   * AVANT le premier recalcul (qui remplace user.xp). Idempotent.
   * @param {import('mongoose').Document} user — avec xp, xpFloor
   */
  async ensureXpFloor(user) {
    if (user.xpFloor != null) return user.xpFloor;
    const inflation = await legacyServerAddedXp(user._id);
    user.xpFloor = Math.max(0, Math.round((user.xp || 0) - inflation));
    await User.updateOne({ _id: user._id, xpFloor: null }, { $set: { xpFloor: user.xpFloor } });
    return user.xpFloor;
  }

  async addExperience(userId, xpAmount) {
    const user = await User.findById(userId);
    user.xp += xpAmount;

    // Logique simple : tous les 1000 XP, on gagne un niveau
    const newLevel = Math.floor(user.xp / 1000) + 1;
    if (newLevel > user.level) {
      user.level = newLevel;
    }

    await user.save();
    return { xp: user.xp, level: user.level };
  }
}

module.exports = new UserService();
module.exports.plausibleXpCeiling = plausibleXpCeiling;
module.exports.XP_CEILING_PER_DAY = XP_CEILING_PER_DAY;