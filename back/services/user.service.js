const { Types }      = require("mongoose");
const User           = require("../models/User");
const Workout        = require("../models/Workout");
const ExerciseRecord = require("../models/ExerciseRecord");
const Friendship     = require("../models/Friendship");
const StreakGroup    = require("../models/StreakGroup");
const ActivityEvent  = require("../models/ActivityEvent");
const WeightHistory  = require("../models/WeightHistory");
const WorkoutLobby   = require("../models/WorkoutLobby");

function userNotFound() {
  const err = new Error("Ce compte est introuvable.");
  err.statusCode = 404;
  err.code = "USER_NOT_FOUND";
  return err;
}

/**
 * Service gérant la logique liée aux utilisateurs (profil, progression, XP).
 */
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

    const user = await User.findById(userId).select('xp level rank');
    if (!user) throw userNotFound();

    const clampedXp = Math.max(0, Math.min(submittedXp, xpForLevel(MAX_LEVEL)));
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