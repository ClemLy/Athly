'use strict';

// ─── Titres déblocables (Section X) ────────────────────────────────────────────
// checkAndUnlockTitles est appelée depuis les points d'action existants
// (clôture de séance, ouverture de coffre, parrainage, bouton Secouer,
// validation/rupture de streak, clôture de Lobby Multi) — même philosophie que
// checkAndUnlockAchievements dans reward.controller.js, mais pour les titres.

const mongoose      = require('mongoose');
const User          = require('../models/User');
const StreakGroup   = require('../models/StreakGroup');
const Workout       = require('../models/Workout');
const WorkoutLobby  = require('../models/WorkoutLobby');
const ExerciseRecord = require('../models/ExerciseRecord');
const { TITLE_CATALOG } = require('../data/titleCatalog');
const { sendPushToUser } = require('../services/push.service');

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Mêmes 7 exercices que front/src/data/majorExercises.js — condition
// PR_HEAVY_100 ("record sur un exo majeur"), dupliqué volontairement ici
// comme le reste des tables de référence de ce contrôleur (pas de dépendance
// backend → code front).
const MAJOR_EXERCISE_NAMES = [
  'Développé couché', 'Squat', 'Soulevé de terre', 'Tractions',
  'Développé militaire', 'Rowing barre', 'Curl barre',
];

const GUILD_MASTER_MIN_MEMBERS = 5;
const GUILD_MASTER_MIN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SHAME_REPENTANCE_WINDOW_MS = 2 * 60 * 60 * 1000;
const STREAK_GEL_SAVE_TARGET = 3;
const IRON_BREAKER_SETS_TARGET = 100;
const HOARDER_ITEM_TARGET = 10;
const SHAKE_BURNING_TARGET = 15;
const POKE_STRIKER_DISTINCT_TARGET = 3;
const LOBBY_INSTIGATOR_TARGET = 20;

// ── Conditions nécessitant une requête dédiée (pas un simple champ User) ──────

async function hasPrHeavy100(userId) {
  return ExerciseRecord.exists({
    user: userId,
    exerciceNom: { $in: MAJOR_EXERCISE_NAMES },
    series: { $elemMatch: { poids: { $gt: 100 } } },
  });
}

async function hasNightOwlWorkout(userId) {
  // $hour utilise le fuseau serveur (UTC sur Render) — cohérent avec le reste
  // du backend, qui ne gère pas de fuseau par utilisateur.
  // Cast explicite : un pipeline $match d'agrégation ne caste PAS une string
  // en ObjectId comme le ferait .find()/.exists() — sans ça, 0 résultat.
  const rows = await Workout.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $addFields: { hour: { $hour: '$createdAt' } } },
    { $match: { hour: { $gte: 0, $lt: 5 } } },
    { $limit: 1 },
  ]);
  return rows.length > 0;
}

// "S'entraîner seul pendant qu'un de ses groupes est actif" : une séance
// terminée par CET utilisateur (via workout.service.js finalize/complete —
// jamais un Lobby Multi, qui n'écrit pas de Workout backend) recouvre dans le
// temps une séance 'in_progress' d'un AUTRE membre d'un de ses groupes —
// même notion d' "actif" que la Météo des séances (weatherStatus).
async function hasSoloShadowWork(userId, finishedWorkout) {
  if (!finishedWorkout) return false;
  const groups = await StreakGroup.find({ members: userId }).select('members');
  if (groups.length === 0) return false;

  const otherMemberIds = [...new Set(
    groups.flatMap((g) => g.members.map(String)).filter((id) => id !== String(userId)),
  )];
  if (otherMemberIds.length === 0) return false;

  // 'in_progress' est par nature une séance encore en cours AU MOMENT de la
  // requête — pas besoin de recouper des fenêtres temporelles, c'est la même
  // notion d' "actif" que la Météo des séances (weatherStatus).
  return Workout.exists({
    user: { $in: otherMemberIds },
    status: 'in_progress',
  });
}

async function countLobbyInstigator(userId) {
  return WorkoutLobby.countDocuments({ creatorId: userId, status: 'completed' });
}

async function findGuildMasterGroup(userId) {
  const groups = await StreakGroup.find({ members: userId }).select('members createdAt');
  return groups.find((g) =>
    g.members.length >= GUILD_MASTER_MIN_MEMBERS &&
    g.members[0]?.toString() === String(userId) &&
    (Date.now() - new Date(g.createdAt).getTime()) >= GUILD_MASTER_MIN_DAYS_MS,
  ) || null;
}

// "Secouer 3 membres différents le même jour" : agrège les secousses ENVOYÉES
// par l'utilisateur, tous groupes confondus, sur la journée civile en cours.
async function countDistinctShakeTargetsToday(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const groups = await StreakGroup.find({ members: userId }).select('shakes');
  const targets = new Set();
  for (const group of groups) {
    for (const shake of group.shakes) {
      if (
        shake.from.toString() === String(userId) &&
        shake.date >= todayStart && shake.date < tomorrow
      ) {
        targets.add(shake.to.toString());
      }
    }
  }
  return targets.size;
}

// "Sortir du Hall of Shame en validant sa séance moins de 2h après y avoir
// été affiché" : l'utilisateur doit être (ou avoir été) dans shameBreakers
// d'un groupe, et avoir une séance validée dans les 2h suivant shameBreakersShamedAt.
async function hasShameRepentance(userId) {
  const groups = await StreakGroup.find({
    members: userId,
    shameBreakersShamedAt: { $ne: null },
  }).select('shameBreakersShamedAt shameBreakers');

  for (const group of groups) {
    // On considère aussi les anciens breakers (le tableau est vidé à la
    // streak suivante) : shameBreakersShamedAt seul suffit à borner la
    // fenêtre de 2h, peu importe que shameBreakers ait depuis été vidé.
    const windowEnd = new Date(group.shameBreakersShamedAt.getTime() + SHAME_REPENTANCE_WINDOW_MS);
    const redeemed = await Workout.exists({
      user: userId,
      status: { $in: ['finished', 'completed'] },
      completedAt: { $gte: group.shameBreakersShamedAt, $lte: windowEnd },
    });
    if (redeemed) return true;
  }
  return false;
}

function inventoryItemCount(user) {
  return (user.inventory || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function hasRarityItem(user, rarity) {
  return (user.inventory || []).some((i) => i.rarity === rarity && i.quantity > 0);
}

// Un cosmétique Unique réclamé (claimUniqueItem) est CONSOMMÉ de l'inventaire
// et déplacé vers unlockedCosmetics (permanent) — hasRarityItem seul ne
// détecterait donc plus rien après réclamation. On vérifie les deux sources.
function hasEverOwnedUnique(user) {
  return hasRarityItem(user, 'unique') || (user.unlockedCosmetics || []).length > 0;
}

// ── checkAndUnlockTitles ────────────────────────────────────────────────────
/**
 * Vérifie toutes les conditions de titres pour `userId` et débloque celles
 * qui sont remplies mais pas encore acquises. Best-effort : appelée depuis de
 * nombreux points d'action existants, ne doit jamais faire échouer l'action
 * qui l'a déclenchée (les appelants doivent l'entourer d'un try/catch — voir
 * les hooks dans workoutLobby/inventory/groupStreak/workout controllers).
 *
 * @param {string} userId
 * @param {object} [context] — infos additionnelles selon le point d'appel :
 *   { finishedWorkout } pour SOLO_SHADOW_WORK (séance backend qui vient de se terminer).
 * @returns {string[]} IDs des titres nouvellement débloqués.
 */
async function checkAndUnlockTitles(userId, context = {}) {
  const user = await User.findById(userId);
  if (!user) return [];

  const unlockedIds = new Set(user.unlockedTitles);
  const newlyUnlocked = [];

  function tryUnlock(titleId) {
    if (unlockedIds.has(titleId)) return;
    user.unlockedTitles.push(titleId);
    unlockedIds.add(titleId);
    newlyUnlocked.push(titleId);
  }

  if (user.level >= 10) tryUnlock('PERFORM_LEVEL_10');
  if (user.level >= 50) tryUnlock('PERFORM_LEVEL_50');
  if (user.referredBy) tryUnlock('REFERRAL_EARLY');
  if (hasRarityItem(user, 'legendary')) tryUnlock('LOOT_LEGENDARY');
  if (hasEverOwnedUnique(user)) tryUnlock('LOOT_BLOOD_UNIQUE');
  if (inventoryItemCount(user) >= HOARDER_ITEM_TARGET) tryUnlock('INVENTORY_HOARDER');
  if (user.totalMultiSessions >= 30) tryUnlock('MULTI_SESSIONS_30_TITLE');
  if (user.totalShakesSent >= SHAKE_BURNING_TARGET) tryUnlock('SHAME_BURNING');
  if (user.totalSetsCompleted >= IRON_BREAKER_SETS_TARGET) tryUnlock('WORKOUT_IRON_BREAKER');
  if (user.consecutiveStreakGelSaves >= STREAK_GEL_SAVE_TARGET) tryUnlock('STREAK_INSUBMERSIBLE');

  if (!unlockedIds.has('PR_HEAVY_100') && await hasPrHeavy100(userId)) tryUnlock('PR_HEAVY_100');
  if (!unlockedIds.has('WORKOUT_NIGHT_OWL') && await hasNightOwlWorkout(userId)) tryUnlock('WORKOUT_NIGHT_OWL');
  if (!unlockedIds.has('LOBBY_INSTIGATOR') && await countLobbyInstigator(userId) >= LOBBY_INSTIGATOR_TARGET) tryUnlock('LOBBY_INSTIGATOR');
  if (!unlockedIds.has('GROUP_GUILD_MASTER') && await findGuildMasterGroup(userId)) tryUnlock('GROUP_GUILD_MASTER');
  if (!unlockedIds.has('SOCIAL_POKE_STRIKER') && await countDistinctShakeTargetsToday(userId) >= POKE_STRIKER_DISTINCT_TARGET) tryUnlock('SOCIAL_POKE_STRIKER');
  if (!unlockedIds.has('SHAME_REPENTANCE') && await hasShameRepentance(userId)) tryUnlock('SHAME_REPENTANCE');
  if (!unlockedIds.has('SOLO_SHADOW_WORK') && await hasSoloShadowWork(userId, context.finishedWorkout)) tryUnlock('SOLO_SHADOW_WORK');

  if (newlyUnlocked.length > 0) {
    await user.save();
    for (const titleId of newlyUnlocked) {
      const meta = TITLE_CATALOG[titleId];
      if (!meta) continue;
      sendPushToUser(userId, {
        title: 'Nouveau titre débloqué !',
        body:  `« ${meta.label} » est maintenant disponible dans tes titres.`,
        data:  { type: 'title_unlocked', titleId },
      }).catch(() => {});
    }

    // Trophées TITLE_FIRST / TITLE_COLLECTOR_5 (require tardif : évite le
    // cycle reward.controller ↔ title.controller au chargement des modules).
    try {
      const { checkAndUnlockAchievements } = require('./reward.controller');
      await checkAndUnlockAchievements(userId);
    } catch (_) {
      // best-effort — ne doit jamais faire échouer le déblocage de titre.
    }
  }

  return newlyUnlocked;
}

// ── Progression (pour l'écran de sélection) ────────────────────────────────
// Renvoie, pour les titres à seuil numérique, { current, target } — les
// titres purement événementiels (parrainage, loot, night owl…) n'ont pas de
// barre de progression significative côté front (juste verrouillé/débloqué).
async function computeProgress(user) {
  const progress = {};
  progress.PERFORM_LEVEL_10 = { current: Math.min(user.level, 10), target: 10 };
  progress.PERFORM_LEVEL_50 = { current: Math.min(user.level, 50), target: 50 };
  progress.INVENTORY_HOARDER = { current: Math.min(inventoryItemCount(user), HOARDER_ITEM_TARGET), target: HOARDER_ITEM_TARGET };
  progress.MULTI_SESSIONS_30_TITLE = { current: Math.min(user.totalMultiSessions, 30), target: 30 };
  progress.SHAME_BURNING = { current: Math.min(user.totalShakesSent, SHAKE_BURNING_TARGET), target: SHAKE_BURNING_TARGET };
  progress.WORKOUT_IRON_BREAKER = { current: Math.min(user.totalSetsCompleted, IRON_BREAKER_SETS_TARGET), target: IRON_BREAKER_SETS_TARGET };
  progress.STREAK_INSUBMERSIBLE = { current: Math.min(user.consecutiveStreakGelSaves, STREAK_GEL_SAVE_TARGET), target: STREAK_GEL_SAVE_TARGET };

  const lobbyCount = await countLobbyInstigator(user._id);
  progress.LOBBY_INSTIGATOR = { current: Math.min(lobbyCount, LOBBY_INSTIGATOR_TARGET), target: LOBBY_INSTIGATOR_TARGET };

  const pokeCount = await countDistinctShakeTargetsToday(user._id);
  progress.SOCIAL_POKE_STRIKER = { current: Math.min(pokeCount, POKE_STRIKER_DISTINCT_TARGET), target: POKE_STRIKER_DISTINCT_TARGET };

  return progress;
}

// ─────────────────────────────────────────────────────────────────────────────
// getMyTitles  GET /api/profile/titles
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyTitles = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    const unlockedSet = new Set(user.unlockedTitles);
    const progressById = await computeProgress(user);

    const titles = Object.values(TITLE_CATALOG).map((entry) => ({
      ...entry,
      unlocked: unlockedSet.has(entry.id),
      progress: progressById[entry.id] || null,
    }));

    return res.status(200).json({
      success:       true,
      titles,
      equippedTitle: user.equippedTitle,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// equipTitle  POST /api/profile/equip-title
// ─────────────────────────────────────────────────────────────────────────────
exports.equipTitle = async (req, res, next) => {
  try {
    const { titleId } = req.body || {};

    // titleId null/undefined explicite → déséquipe (retour au pseudo seul).
    if (titleId === null || titleId === undefined) {
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: { equippedTitle: null } },
        { new: true },
      ).select('equippedTitle');
      if (!user) return next(createError('Utilisateur introuvable.', 404));
      return res.status(200).json({ success: true, equippedTitle: user.equippedTitle });
    }

    if (!TITLE_CATALOG[titleId]) {
      return next(createError('Titre inconnu.', 400));
    }

    const user = await User.findById(req.user.id);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    if (!user.unlockedTitles.includes(titleId)) {
      return next(createError("Ce titre n'est pas encore débloqué.", 403));
    }

    user.equippedTitle = titleId;
    await user.save();

    return res.status(200).json({ success: true, equippedTitle: user.equippedTitle });
  } catch (err) {
    next(err);
  }
};

exports.checkAndUnlockTitles = checkAndUnlockTitles;
