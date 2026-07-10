'use strict';

const mongoose   = require('mongoose');
const StreakGroup = require('../models/StreakGroup');
const Friendship  = require('../models/Friendship');
const User        = require('../models/User');
const Workout     = require('../models/Workout');
const { addUniqueItemOnce } = require('../services/inventory.service');
const { checkAndUnlockAchievements } = require('./reward.controller');
const { checkAndUnlockTitles } = require('./title.controller');
const { levelFromXP, getRankForLevel } = require('../utils/levelHelpers');
const { sendPushToUser } = require('../services/push.service');
const { SHAKE_TROLL_MESSAGES } = require('../data/shakeMessages');

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_GROUP_SIZE = 5;

// Streak de groupe (jours consécutifs) requise, à taille maximale (5 membres),
// pour débloquer la couleur cosmétique Unique "Rouge Sang Unique".
const BLOOD_SANG_STREAK_THRESHOLD = 30;

// Champs publics exposés pour un membre de groupe (lastActiveAt alimente la
// Météo des séances — statut "Prêt")
const MEMBER_PUBLIC_FIELDS = 'pseudo level rank xp lastActiveAt';

// Météo des séances : une séance "draft"/"in_progress" plus vieille que cette
// fenêtre est considérée abandonnée plutôt qu'activement chronométrée — évite
// d'afficher ⚡ indéfiniment pour une séance oubliée en arrière-plan.
const WEATHER_ACTIVE_WINDOW_MS = 4 * 60 * 60 * 1000; // 4h

// Seuils XP pour les 5 niveaux d'amitié — progression exponentielle (~4 mois)
const FRIENDSHIP_XP_THRESHOLDS = [0, 100, 300, 700, 1500];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/** Minuit du jour courant (heure locale). */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * XP d'amitié attribué par validation de streak de groupe.
 * Palier : +10 XP de base, +10 tous les 7 jours de streak consécutive.
 */
function computeGroupFriendshipXpGain(currentStreak) {
  return 10 * (Math.floor(currentStreak / 7) + 1);
}

/**
 * Niveau d'amitié calculé depuis les XP cumulés.
 * Cherche le seuil le plus élevé que xp dépasse.
 */
function computeFriendshipLevel(xp) {
  for (let i = FRIENDSHIP_XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= FRIENDSHIP_XP_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

/**
 * Ajoute `xpGain` au document Friendship entre userId1 et userId2 (accepted).
 * Met à jour le niveau d'amitié si un seuil est franchi.
 * Si aucune amitié acceptée n'existe, ignore silencieusement.
 *
 * Passage au niveau 5 (Rareté Unique) : injecte le cadre cosmétique
 * PROFILE_FRAME_BLOOD_BOND (hors coffres, une seule fois) dans l'inventaire
 * des deux amis et déclenche le déblocage du trophée FRIENDSHIP_LEVEL_5.
 */
async function addFriendshipXp(userId1, userId2, xpGain) {
  const friendship = await Friendship.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
    status: 'accepted',
  });
  if (!friendship) return;

  const previousLevel = friendship.friendshipLevel;
  friendship.friendshipXp    += xpGain;
  friendship.friendshipLevel  = computeFriendshipLevel(friendship.friendshipXp);
  await friendship.save();

  if (previousLevel < 5 && friendship.friendshipLevel === 5) {
    await Promise.all([
      addUniqueItemOnce(userId1, 'PROFILE_FRAME_BLOOD_BOND', 'unique'),
      addUniqueItemOnce(userId2, 'PROFILE_FRAME_BLOOD_BOND', 'unique'),
    ]);
    await Promise.all([
      checkAndUnlockAchievements(String(userId1)),
      checkAndUnlockAchievements(String(userId2)),
    ]);
  }
}

// ── Bonus XP de groupe (Brique IV) ────────────────────────────────────────────
// Le multiplicateur cumule deux composantes, exposées séparément pour
// affichage front (ex: "x1.98 = x1.35 taille × x1.47 régularité") :
//   - Taille     : +35% par membre au-delà du premier (2 → x1.35, 5 → x2.40).
//     Un groupe à 5 est bien plus dur à maintenir qu'à 2 (aléas du quotidien
//     de 5 personnes) : le bonus doit le refléter, pas juste suivre linéairement.
//   - Régularité : +8% par semaine de streak consécutive, plafonné à +60%
//     (7j → x1.08, ~53j+ → x1.60) — récompense la constance sans devenir infini.
const GROUP_BASE_BONUS_XP  = 50;
const REGULARITY_STEP      = 0.08;
const REGULARITY_MAX_BONUS = 0.6;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeGroupXpBonus(memberCount, currentStreak = 0) {
  const sizeMultiplier       = 1 + 0.35 * (memberCount - 1);
  const regularityMultiplier = 1 + Math.min(REGULARITY_MAX_BONUS, REGULARITY_STEP * Math.floor(currentStreak / 7));
  const multiplier           = sizeMultiplier * regularityMultiplier;

  return {
    sizeMultiplier:       round2(sizeMultiplier),
    regularityMultiplier: round2(regularityMultiplier),
    multiplier:           round2(multiplier),
    bonusXp:              Math.round(GROUP_BASE_BONUS_XP * multiplier),
  };
}

/** Crédite atomiquement le bonus XP à un membre et recale son niveau/rang. */
async function grantGroupXpBonus(memberId, bonusXp) {
  const updated = await User.findOneAndUpdate(
    { _id: memberId },
    { $inc: { xp: bonusXp } },
    { returnDocument: 'after' },
  );
  if (!updated) return;
  const newLevel = levelFromXP(updated.xp);
  if (newLevel !== updated.level) {
    await User.updateOne(
      { _id: memberId },
      { $set: { level: newLevel, rank: getRankForLevel(newLevel) } },
    );
  }
}

// ── Météo des séances (Brique IV) ──────────────────────────────────────────
// 4 états stricts, du plus « chaud » au plus « froid » — le premier qui
// s'applique gagne :
//   ✅ done      : séance terminée aujourd'hui (status finished/completed).
//   ⚡ active    : séance en cours aujourd'hui (status draft/in_progress)
//                  dont le dernier `updatedAt` date de moins de 4h — au-delà,
//                  on considère la séance oubliée en arrière-plan plutôt que
//                  réellement chronométrée en direct.
//   🔥 ready     : l'utilisateur a ouvert l'app aujourd'hui (lastActiveAt)
//                  sans avoir encore de séance du jour.
//   💤 sleeping  : aucun des signaux ci-dessus.
/**
 * Enrichit un tableau de membres populés (`MEMBER_PUBLIC_FIELDS`) avec leur
 * `weatherStatus` du jour. Une seule requête `Workout.find` groupée pour tout
 * le groupe (pas de N+1) — appelée à chaque `getMyGroup`, donc rafraîchie
 * "proprement" à chaque focus d'écran côté front, sans avoir besoin d'un
 * websocket dédié.
 */
async function attachWeatherStatuses(members) {
  const todayStart = startOfToday();
  const memberIds = members.map((m) => m._id);

  const workouts = await Workout.find({
    user: { $in: memberIds },
    date: { $gte: todayStart },
  }).select('user status updatedAt');

  const workoutsByUser = new Map();
  for (const w of workouts) {
    const key = String(w.user);
    if (!workoutsByUser.has(key)) workoutsByUser.set(key, []);
    workoutsByUser.get(key).push(w);
  }

  const now = Date.now();

  return members.map((member) => {
    const plain = typeof member.toObject === 'function' ? member.toObject() : member;
    const todaysWorkouts = workoutsByUser.get(String(member._id)) || [];

    let weatherStatus = 'sleeping';

    const hasFinishedToday = todaysWorkouts.some((w) => w.status === 'finished' || w.status === 'completed');
    const hasActiveNow = todaysWorkouts.some((w) => {
      if (w.status !== 'draft' && w.status !== 'in_progress') return false;
      const updatedAt = w.updatedAt ? new Date(w.updatedAt).getTime() : 0;
      return now - updatedAt <= WEATHER_ACTIVE_WINDOW_MS;
    });
    const wasActiveToday = plain.lastActiveAt && new Date(plain.lastActiveAt).getTime() >= todayStart.getTime();

    if (hasFinishedToday) weatherStatus = 'done';
    else if (hasActiveNow) weatherStatus = 'active';
    else if (wasActiveToday) weatherStatus = 'ready';

    return { ...plain, weatherStatus };
  });
}

// ── Hall of Shame (Brique IV) ──────────────────────────────────────────────
// Sans cron quotidien (aucun n'existe dans ce backend — voir StreakGroup.js),
// la rupture de streak est détectée "paresseusement" : au premier getMyGroup
// appelé après qu'une journée entière se soit écoulée sans validation.
//
// Un membre absent la veille est "couvert" (ne casse pas la streak) s'il
// possède au moins 1 Gel de Streak — celui-ci est alors consommé
// automatiquement. S'il en reste au moins un membre non couvert, la streak
// entière retombe à 0 et ce(s) membre(s) deviennent les "briseurs" affichés
// dans le bandeau Hall of Shame, jusqu'à la prochaine streak validée avec
// succès (voir checkAndUpdateGroupStreaks, qui vide shameBreakers).
async function detectAndApplyStreakBreak(group) {
  if (!group.currentStreak || !group.lastValidatedDate) return group;

  const todayStart = startOfToday();
  const missedDayStart = new Date(group.lastValidatedDate);
  missedDayStart.setHours(0, 0, 0, 0);
  missedDayStart.setDate(missedDayStart.getDate() + 1);

  // La journée suivant la dernière validation n'est même pas encore terminée
  // (aujourd'hui ou avant) : rien à détecter pour l'instant.
  if (missedDayStart >= todayStart) return group;

  const missedDayEnd = new Date(missedDayStart);
  missedDayEnd.setDate(missedDayEnd.getDate() + 1);

  const memberIds = group.members.map(String);
  const workoutChecks = await Promise.all(
    memberIds.map((memberId) =>
      Workout.findOne({
        user:   memberId,
        status: { $in: ['finished', 'completed'] },
        date:   { $gte: missedDayStart, $lt: missedDayEnd },
      }).select('_id'),
    ),
  );

  const absentMemberIds = memberIds.filter((_, i) => !workoutChecks[i]);

  if (absentMemberIds.length === 0) {
    // Tout le monde avait validé cette journée-là (juste pas cliqué sur
    // "Valider la streak") : on avance le curseur pour ne pas la re-traiter
    // indéfiniment, sans casser ni incrémenter la streak.
    group.lastValidatedDate = missedDayStart;
    await group.save();
    return group;
  }

  const breakers = [];
  const coveredMemberIds = [];
  for (const memberId of absentMemberIds) {
    const covered = await User.findOneAndUpdate(
      { _id: memberId, streakGels: { $gt: 0 } },
      { $inc: { streakGels: -1 } },
    );
    if (covered) {
      coveredMemberIds.push(memberId);
    } else {
      breakers.push(memberId);
    }
  }

  // Titre STREAK_INSUBMERSIBLE ("sauver sa streak 3 fois de suite avec un Gel
  // de Streak") : incrémente pour chaque sauvetage, remis à 0 pour un membre
  // dès qu'il devient lui-même breaker (rupture non couverte, voir plus bas).
  if (coveredMemberIds.length > 0) {
    await User.updateMany(
      { _id: { $in: coveredMemberIds } },
      { $inc: { consecutiveStreakGelSaves: 1 } },
    );
  }

  if (breakers.length === 0) {
    // Tous les absents couverts par un Gel de Streak — pareil, on avance le
    // curseur pour ne pas re-consommer un gel supplémentaire au prochain appel.
    group.lastValidatedDate = missedDayStart;
    await group.save();
    try {
      await Promise.all(coveredMemberIds.map((id) => checkAndUnlockTitles(id)));
    } catch (_) {
      // best-effort — ne doit jamais bloquer la détection de rupture.
    }
    return group;
  }

  await User.updateMany(
    { _id: { $in: breakers } },
    { $set: { consecutiveStreakGelSaves: 0 } },
  );

  group.currentStreak = 0;
  group.shameBreakers = breakers;
  group.shameBreakersShamedAt = new Date();
  await group.save();
  try {
    await Promise.all(coveredMemberIds.map((id) => checkAndUnlockTitles(id)));
  } catch (_) {
    // best-effort
  }
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// inviteToGroup  POST /api/groups/invite
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un groupe de streak et invite des amis, OU ajoute des invitations
 * à un groupe déjà existant dont l'utilisateur est membre.
 *
 * Sécurités :
 *  - Seuls les amis acceptés peuvent être invités.
 *  - Un invité déjà membre d'un autre groupe est bloqué.
 *  - La capacité totale (membres + pending) ne doit pas dépasser MAX_GROUP_SIZE.
 */
exports.inviteToGroup = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { friendIds, name } = req.body;

    if (!Array.isArray(friendIds) || friendIds.length === 0) {
      return next(createError('friendIds doit être un tableau non vide.', 400));
    }
    for (const id of friendIds) {
      if (!isValidId(id)) return next(createError(`ID invalide : ${id}`, 400));
    }

    if (friendIds.some((id) => id.toString() === myId)) {
      return next(createError("Vous ne pouvez pas vous inviter vous-même.", 422));
    }

    const uniqueIds = [...new Set(friendIds.map(String))];

    // Vérification d'amitié acceptée pour chaque invité
    for (const friendId of uniqueIds) {
      const friendship = await Friendship.findOne({
        $or: [
          { requester: myId,     recipient: friendId },
          { requester: friendId, recipient: myId     },
        ],
        status: 'accepted',
      });
      if (!friendship) {
        return next(createError("Vous ne pouvez inviter que vos amis acceptés.", 403));
      }
    }

    const existingGroup = await StreakGroup.findOne({ members: myId });

    if (existingGroup) {
      // ── Ajout à un groupe existant ────────────────────────────────────────
      const alreadyIn = new Set([
        ...existingGroup.members.map(String),
        ...existingGroup.pendingInvites.map(String),
      ]);
      const toInvite = uniqueIds.filter((id) => !alreadyIn.has(id));

      const total = existingGroup.members.length + existingGroup.pendingInvites.length + toInvite.length;
      if (total > MAX_GROUP_SIZE) {
        return next(createError(`Le groupe est plein (maximum ${MAX_GROUP_SIZE} membres).`, 422));
      }

      for (const friendId of toInvite) {
        const inOther = await StreakGroup.findOne({ members: friendId });
        if (inOther) {
          return next(createError("Un des utilisateurs invités appartient déjà à un autre groupe.", 409));
        }
      }

      existingGroup.pendingInvites.push(...toInvite);
      await existingGroup.save();

      return res.status(200).json({
        success: true,
        message: `${toInvite.length} invitation(s) envoyée(s).`,
        group:   existingGroup,
      });
    }

    // ── Création d'un nouveau groupe ──────────────────────────────────────────
    if (1 + uniqueIds.length > MAX_GROUP_SIZE) {
      return next(createError(`Le groupe ne peut pas dépasser ${MAX_GROUP_SIZE} membres au total.`, 422));
    }

    for (const friendId of uniqueIds) {
      const inGroup = await StreakGroup.findOne({ members: friendId });
      if (inGroup) {
        return next(createError("Un des utilisateurs invités appartient déjà à un autre groupe.", 409));
      }
    }

    const group = await StreakGroup.create({
      name:           name || undefined,
      members:        [myId],
      pendingInvites: uniqueIds,
    });

    return res.status(201).json({
      success: true,
      message: 'Groupe créé et invitations envoyées.',
      group,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// respondToGroupInvite  PUT /api/groups/respond/:groupId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accepte ou refuse une invitation à rejoindre un groupe.
 *
 * Body : { accept: boolean }
 *
 * Si acceptée :
 *  - L'utilisateur ne doit pas déjà être membre d'un autre groupe.
 *  - Le groupe ne doit pas être plein.
 */
exports.respondToGroupInvite = async (req, res, next) => {
  try {
    const myId      = req.user.id;
    const { groupId } = req.params;
    const { accept }  = req.body;

    if (!isValidId(groupId)) return next(createError('groupId invalide.', 400));
    if (typeof accept !== 'boolean') {
      return next(createError("Le champ 'accept' doit être un booléen (true / false).", 400));
    }

    const group = await StreakGroup.findById(groupId);
    if (!group) return next(createError('Groupe introuvable.', 404));

    const pendingIdx = group.pendingInvites.findIndex((id) => id.toString() === myId);
    if (pendingIdx === -1) {
      return next(createError("Vous n'avez pas d'invitation en attente pour ce groupe.", 403));
    }

    // Retirer de pendingInvites dans tous les cas
    group.pendingInvites.splice(pendingIdx, 1);

    if (!accept) {
      await group.save();
      return res.status(200).json({
        success: true,
        message: 'Invitation refusée.',
        group,
      });
    }

    // ── Acceptation ───────────────────────────────────────────────────────────
    const alreadyInGroup = await StreakGroup.findOne({ members: myId });
    if (alreadyInGroup) {
      return next(createError("Vous appartenez déjà à un groupe de streak.", 409));
    }

    if (group.members.length >= MAX_GROUP_SIZE) {
      return next(createError(`Le groupe est plein (maximum ${MAX_GROUP_SIZE} membres).`, 422));
    }

    group.members.push(myId);
    await group.save();

    return res.status(200).json({
      success: true,
      message: "Vous avez rejoint le groupe !",
      group,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// shakeMember  POST /api/groups/:groupId/shake/:memberId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "Secoue" (notifie) un membre du groupe qui n'a pas encore validé sa séance.
 * La notification push est simulée par un log serveur.
 *
 * Sécurités :
 *  - L'appelant et la cible doivent être membres du groupe.
 *  - On ne peut pas se secouer soi-même.
 *  - Inutile de secouer quelqu'un qui a déjà fini sa séance.
 */
exports.shakeMember = async (req, res, next) => {
  try {
    const myId              = req.user.id;
    const { groupId, memberId } = req.params;

    if (!isValidId(groupId))  return next(createError('groupId invalide.', 400));
    if (!isValidId(memberId)) return next(createError('memberId invalide.', 400));

    if (myId === memberId) {
      return next(createError("Vous ne pouvez pas vous secouer vous-même.", 422));
    }

    const group = await StreakGroup.findById(groupId);
    if (!group) return next(createError('Groupe introuvable.', 404));

    if (!group.members.some((m) => m.toString() === myId)) {
      return next(createError("Vous ne faites pas partie de ce groupe.", 403));
    }

    if (!group.members.some((m) => m.toString() === memberId)) {
      return next(createError("Ce membre ne fait pas partie du groupe.", 404));
    }

    // Vérifier que la cible n'a pas encore validé sa séance aujourd'hui
    const todayStart = startOfToday();
    const tomorrow   = new Date(todayStart);
    tomorrow.setDate(todayStart.getDate() + 1);

    const workoutDone = await Workout.findOne({
      user:   memberId,
      status: { $in: ['finished', 'completed'] },
      date:   { $gte: todayStart, $lt: tomorrow },
    });

    if (workoutDone) {
      return next(createError("Ce membre a déjà validé sa séance aujourd'hui - inutile de le secouer !", 422));
    }

    // Limite 1 secousse par jour civil et par cible — évite le harcèlement
    // et donne un sens au bouton grisé côté front (voir getMyGroup).
    const alreadyShakenToday = group.shakes.some((s) =>
      s.from.toString() === myId && s.to.toString() === memberId && s.date >= todayStart && s.date < tomorrow,
    );
    if (alreadyShakenToday) {
      return next(createError("Tu as déjà secoué cette personne aujourd'hui - reviens demain !", 422));
    }

    const target       = await User.findById(memberId).select('pseudo');
    const targetPseudo = target?.pseudo ?? memberId;
    const me           = await User.findById(myId).select('pseudo');

    const trollMessage = SHAKE_TROLL_MESSAGES[Math.floor(Math.random() * SHAKE_TROLL_MESSAGES.length)];
    await sendPushToUser(memberId, {
      title: `${me?.pseudo ?? 'Un ami'} t'a secoué ! 🚨`,
      body:  trollMessage,
      data:  { type: 'shake', fromUserId: myId },
    });

    group.shakes.push({ from: myId, to: memberId, date: new Date() });
    await group.save();

    // Titres SHAME_BURNING (>15 secousses au total) / SOCIAL_POKE_STRIKER
    // (3 cibles différentes le même jour) — best-effort, ne bloque jamais
    // l'envoi de la notification déjà effectué ci-dessus.
    let newlyUnlockedTitles = [];
    try {
      await User.updateOne({ _id: myId }, { $inc: { totalShakesSent: 1 } });
      newlyUnlockedTitles = await checkAndUnlockTitles(myId);
    } catch (_) {
      // ignore
    }

    return res.status(200).json({
      success:  true,
      message:  `Notification envoyée à ${targetPseudo} !`,
      targetId: memberId,
      newlyUnlockedTitles,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// checkAndUpdateGroupStreaks  POST /api/groups/:groupId/check-streak
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie si tous les membres ont validé une séance aujourd'hui.
 * Si oui :
 *   1. Incrémente currentStreak du groupe.
 *   2. Ajoute des points d'amitié (friendshipXp) entre chaque paire de membres.
 *   3. Met à jour le niveau d'amitié si un seuil XP est franchi.
 *
 * Idempotent : un groupe déjà validé aujourd'hui renvoie alreadyValidated=true.
 */
exports.checkAndUpdateGroupStreaks = async (req, res, next) => {
  try {
    const myId      = req.user.id;
    const { groupId } = req.params;

    if (!isValidId(groupId)) return next(createError('groupId invalide.', 400));

    const group = await StreakGroup.findById(groupId);
    if (!group) return next(createError('Groupe introuvable.', 404));

    if (!group.members.some((m) => m.toString() === myId)) {
      return next(createError("Vous ne faites pas partie de ce groupe.", 403));
    }

    // Garde idempotence : déjà validé aujourd'hui ?
    const todayStart = startOfToday();
    if (group.lastValidatedDate && group.lastValidatedDate >= todayStart) {
      return res.status(200).json({
        success:          true,
        alreadyValidated: true,
        message:          "La streak de groupe a déjà été validée aujourd'hui.",
        currentStreak:    group.currentStreak,
      });
    }

    const tomorrow   = new Date(todayStart);
    tomorrow.setDate(todayStart.getDate() + 1);
    const memberIds  = group.members.map(String);

    // Vérification parallèle : chaque membre a-t-il une séance finalisée ?
    const workoutChecks = await Promise.all(
      memberIds.map((memberId) =>
        Workout.findOne({
          user:   memberId,
          status: { $in: ['finished', 'completed'] },
          date:   { $gte: todayStart, $lt: tomorrow },
        }),
      ),
    );

    const allValidated  = workoutChecks.every((w) => w !== null);

    if (!allValidated) {
      const pendingMembers = memberIds.filter((_, i) => workoutChecks[i] === null);
      return res.status(200).json({
        success:        true,
        allValidated:   false,
        message:        "Tous les membres n'ont pas encore validé leur séance.",
        pendingMembers,
      });
    }

    // ── Tous ont validé ──────────────────────────────────────────────────────
    group.currentStreak    += 1;
    group.lastValidatedDate = new Date();
    group.shameBreakers     = []; // une nouvelle streak efface le Hall of Shame
    await group.save();

    // XP d'amitié par paire (C(n, 2) mises à jour)
    const xpGain = computeGroupFriendshipXpGain(group.currentStreak);
    const xpUpdates = [];

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        await addFriendshipXp(memberIds[i], memberIds[j], xpGain);
        xpUpdates.push({ pair: [memberIds[i], memberIds[j]], xpGain });
      }
    }

    // Bonus XP utilisateur : multiplicateur taille × régularité (streak fraîchement incrémenté)
    const xpBonus = computeGroupXpBonus(memberIds.length, group.currentStreak);
    await Promise.all(memberIds.map((id) => grantGroupXpBonus(id, xpBonus.bonusXp)));

    // Récompense cosmétique Unique "Rouge Sang Unique" : streak de groupe de
    // 30 jours validée à taille MAXIMALE (5 membres). Octroi unique (garde
    // bloodSangAwarded) — chaque membre reçoit l'item à réclamer depuis son
    // inventaire (voir inventory.controller.js → claimUniqueItem).
    let bloodSangUnlocked = false;
    if (
      !group.bloodSangAwarded &&
      memberIds.length === MAX_GROUP_SIZE &&
      group.currentStreak >= BLOOD_SANG_STREAK_THRESHOLD
    ) {
      await Promise.all(memberIds.map((id) => addUniqueItemOnce(id, 'FRAME_COLOR_BLOOD_SANG', 'unique')));
      group.bloodSangAwarded = true;
      await group.save();
      bloodSangUnlocked = true;
      // FIRST_UNIQUE_ITEM peut se débloquer ici si c'est le tout premier objet
      // Unique du membre — doit être vérifié pendant que l'item est encore en
      // inventaire (avant toute réclamation qui le consommerait).
      await Promise.all(memberIds.map((id) => checkAndUnlockAchievements(id)));
    }

    // Titres GROUP_GUILD_MASTER / SHAME_REPENTANCE — best-effort, ne doit
    // jamais faire échouer la validation de streak déjà actée ci-dessus.
    let newlyUnlockedTitlesByUser = {};
    try {
      const titleResults = await Promise.all(memberIds.map((id) => checkAndUnlockTitles(id)));
      memberIds.forEach((id, i) => { newlyUnlockedTitlesByUser[id] = titleResults[i]; });
    } catch (_) {
      // ignore
    }

    return res.status(200).json({
      success:       true,
      allValidated:  true,
      message:       `Streak de groupe validée ! Jour ${group.currentStreak} consécutif.`,
      currentStreak: group.currentStreak,
      xpGain,
      xpUpdates,
      groupBonus: { ...xpBonus, memberCount: memberIds.length },
      bloodSangUnlocked,
      newlyUnlockedTitles: newlyUnlockedTitlesByUser[myId] ?? [],
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getMyGroup  GET /api/groups/my-group
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne le groupe de streak auquel appartient l'utilisateur connecté,
 * avec les membres et les invitations en attente populés.
 * Renvoie { group: null } si l'utilisateur n'appartient à aucun groupe.
 */
exports.getMyGroup = async (req, res, next) => {
  try {
    const myId = req.user.id;

    // Groupe non populé d'abord : la détection de rupture de streak (Hall of
    // Shame) a besoin des ObjectId bruts des membres, pas de documents User
    // populés (String(userDoc) ne donne pas son _id).
    let group = await StreakGroup.findOne({ members: myId });

    // Invitations de groupe reçues (groupes où je suis en pendingInvites),
    // pour que l'invité puisse accepter/refuser depuis l'app.
    const invites = await StreakGroup.find({ pendingInvites: myId })
      .populate('members', MEMBER_PUBLIC_FIELDS)
      .select('name currentStreak members');

    if (!group) {
      return res.status(200).json({
        success: true,
        group:   null,
        invites,
        message: "Vous ne faites partie d'aucun groupe.",
      });
    }

    group = await detectAndApplyStreakBreak(group);
    await group.populate([
      { path: 'members', select: MEMBER_PUBLIC_FIELDS },
      { path: 'pendingInvites', select: 'pseudo level rank' },
      { path: 'shameBreakers', select: 'pseudo' },
    ]);

    // Multiplicateur courant (taille + régularité), affichable même sans
    // attendre la prochaine validation — group est un document Mongoose,
    // on construit la réponse à part pour ne pas le muter.
    const xpBonus = computeGroupXpBonus(group.members.length, group.currentStreak);
    const membersWithWeather = await attachWeatherStatuses(group.members);

    // Membres déjà secoués aujourd'hui par MOI — permet au front de griser
    // leur bouton "Secouer" plutôt que de laisser échouer un second clic.
    const todayStart = startOfToday();
    const tomorrow    = new Date(todayStart);
    tomorrow.setDate(todayStart.getDate() + 1);
    const shakenTodayByMe = group.shakes
      .filter((s) => s.from.toString() === myId && s.date >= todayStart && s.date < tomorrow)
      .map((s) => s.to.toString());

    const { shakes: _shakes, ...groupPlain } = group.toObject();

    return res.status(200).json({
      success: true,
      group:   { ...groupPlain, members: membersWithWeather, xpBonus, shakenTodayByMe },
      invites,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// leaveGroup  POST /api/groups/leave
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quitte le groupe de streak actuel.
 *
 * Si l'utilisateur était le dernier membre, le groupe est dissous
 * (supprimé) plutôt que laissé vide en base. Sinon, la streak et
 * l'historique du groupe sont conservés pour les membres restants.
 */
exports.leaveGroup = async (req, res, next) => {
  try {
    const myId = req.user.id;

    const group = await StreakGroup.findOne({ members: myId });
    if (!group) return next(createError("Vous ne faites partie d'aucun groupe.", 404));

    group.members = group.members.filter((m) => m.toString() !== myId);

    if (group.members.length === 0) {
      await StreakGroup.deleteOne({ _id: group._id });
      return res.status(200).json({
        success:      true,
        message:      'Vous avez quitté le groupe. Il était vide, il a été dissous.',
        groupDeleted: true,
      });
    }

    await group.save();

    return res.status(200).json({
      success: true,
      message: 'Vous avez quitté le groupe.',
      groupDeleted: false,
    });
  } catch (err) {
    next(err);
  }
};
