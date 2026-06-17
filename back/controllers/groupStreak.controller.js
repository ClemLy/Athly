'use strict';

const mongoose   = require('mongoose');
const StreakGroup = require('../models/StreakGroup');
const Friendship  = require('../models/Friendship');
const User        = require('../models/User');
const Workout     = require('../models/Workout');

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_GROUP_SIZE = 5;

// Champs publics exposés pour un membre de groupe
const MEMBER_PUBLIC_FIELDS = 'pseudo level rank xp';

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

  friendship.friendshipXp    += xpGain;
  friendship.friendshipLevel  = computeFriendshipLevel(friendship.friendshipXp);
  await friendship.save();
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
      return next(createError("Ce membre a déjà validé sa séance aujourd'hui — inutile de le secouer !", 422));
    }

    const target       = await User.findById(memberId).select('pseudo');
    const targetPseudo = target?.pseudo ?? memberId;

    // Simulation du push — remplacer par un appel réel au service de notifications
    console.log(`[SHAKE] Push simulé → ${targetPseudo} n'a pas encore fait sa séance du jour.`);

    return res.status(200).json({
      success:  true,
      message:  `Notification envoyée à ${targetPseudo} !`,
      targetId: memberId,
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

    return res.status(200).json({
      success:       true,
      allValidated:  true,
      message:       `Streak de groupe validée ! Jour ${group.currentStreak} consécutif.`,
      currentStreak: group.currentStreak,
      xpGain,
      xpUpdates,
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

    const group = await StreakGroup.findOne({ members: myId })
      .populate('members',       MEMBER_PUBLIC_FIELDS)
      .populate('pendingInvites', 'pseudo level rank');

    if (!group) {
      return res.status(200).json({
        success: true,
        group:   null,
        message: "Vous ne faites partie d'aucun groupe.",
      });
    }

    return res.status(200).json({ success: true, group });
  } catch (err) {
    next(err);
  }
};
