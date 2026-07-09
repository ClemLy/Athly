'use strict';

const mongoose      = require('mongoose');
const WorkoutLobby  = require('../models/WorkoutLobby');
const User          = require('../models/User');
const Friendship    = require('../models/Friendship');
const { sendPushToUser } = require('../services/push.service');
const { checkAndUnlockAchievements } = require('./reward.controller');

const { MAX_MEMBERS } = WorkoutLobby;
const MEMBER_PUBLIC_FIELDS = 'pseudo level rank equippedFrame';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Bonus XP Multi (Section VII) : généreux à dessein — assembler un groupe de
// 5 est rare, ça doit vraiment valoir le coup (2 joueurs → 15%, 3 → 25%,
// 4 → 35%, 5 → 50%). Table plutôt que formule linéaire pour garder des
// paliers ronds et un gros saut au dernier membre.
const MULTI_BONUS_BY_COUNT = { 1: 0, 2: 0.15, 3: 0.25, 4: 0.35, 5: 0.50 };
function computeMultiBonusPercent(memberCount) {
  if (memberCount >= 5) return MULTI_BONUS_BY_COUNT[5];
  return MULTI_BONUS_BY_COUNT[memberCount] ?? 0;
}

async function populateLobby(lobby) {
  await lobby.populate('members.user', MEMBER_PUBLIC_FIELDS);
  return lobby;
}

/**
 * Auto-progresse tout membre "bot" de test (voir simulateLobbyInvite dans
 * debug.controller.js) vers `targetStatus` — miroir instantané de l'action de
 * l'utilisateur réel, pour tester le flux complet du Lobby Multi en solo
 * sans second compte/appareil. N'affecte jamais les membres humains.
 */
async function autoProgressBots(lobby, targetStatus) {
  const memberIds = lobby.members.map((m) => m.user);
  const bots = await User.find({ _id: { $in: memberIds }, isTestBot: true }).select('_id');
  if (bots.length === 0) return;

  const botIds = new Set(bots.map((b) => b._id.toString()));
  lobby.members.forEach((m) => {
    if (botIds.has(m.user.toString())) m.status = targetStatus;
  });
}

function serializeLobby(lobby) {
  const plain = lobby.toObject();
  return {
    _id:            plain._id,
    creatorId:      plain.creatorId,
    status:         plain.status,
    creationDate:   plain.creationDate,
    memberCount:    plain.memberCount,
    xpBonusPercent: plain.xpBonusPercent,
    members: plain.members.map((m) => ({
      user:   m.user,
      status: m.status,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// createLobby  POST /api/lobby/create
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un salon de séance Multi au statut 'waiting', avec le créateur comme
 * premier membre (statut 'waiting' — il doit lui aussi passer 'ready').
 */
exports.createLobby = async (req, res, next) => {
  try {
    const myId = req.user.id;

    const lobby = await WorkoutLobby.create({
      creatorId: myId,
      members:   [{ user: myId, status: 'waiting' }],
      memberCount: 1,
      status: 'waiting',
    });

    await populateLobby(lobby);

    return res.status(201).json({ success: true, lobby: serializeLobby(lobby) });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getLobby  GET /api/lobby/:id
// ─────────────────────────────────────────────────────────────────────────────

/** Consultation de l'état courant du lobby — pollée par le front (pas de websocket). */
exports.getLobby = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return next(createError('id de lobby invalide.', 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError('Lobby introuvable.', 404));

    const myId = req.user.id;
    if (!lobby.members.some((m) => m.user.toString() === myId)) {
      return next(createError('Vous ne faites pas partie de ce lobby.', 403));
    }

    await populateLobby(lobby);
    return res.status(200).json({ success: true, lobby: serializeLobby(lobby) });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// inviteToLobby  POST /api/lobby/:id/invite
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envoie une VRAIE notification push à un ami pour l'inviter à rejoindre le
 * lobby — ne l'ajoute pas comme membre (il rejoint lui-même via /join en
 * ouvrant la notification, comme pour le bouton Secouer).
 *
 * Sécurités : seul un membre du lobby peut inviter ; seul un ami accepté peut
 * être invité ; le lobby doit encore accepter des membres (waiting, < 5).
 */
exports.inviteToLobby = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { id } = req.params;
    const { friendId } = req.body;

    if (!isValidId(id)) return next(createError('id de lobby invalide.', 400));
    if (!friendId || !isValidId(friendId)) return next(createError('friendId manquant ou invalide.', 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError('Lobby introuvable.', 404));

    if (!lobby.members.some((m) => m.user.toString() === myId)) {
      return next(createError('Vous ne faites pas partie de ce lobby.', 403));
    }
    if (lobby.status !== 'waiting') {
      return next(createError("Ce lobby n'accepte plus de nouveaux membres.", 422));
    }
    if (lobby.memberCount >= MAX_MEMBERS) {
      return next(createError('Le lobby est déjà complet (5 max).', 422));
    }

    const isFriend = await Friendship.exists({
      $or: [
        { requester: myId, recipient: friendId, status: 'accepted' },
        { requester: friendId, recipient: myId, status: 'accepted' },
      ],
    });
    if (!isFriend) return next(createError("Vous ne pouvez inviter qu'un ami accepté.", 403));

    const [me, friend] = await Promise.all([
      User.findById(myId).select('pseudo'),
      User.findById(friendId).select('pseudo'),
    ]);
    if (!friend) return next(createError('Utilisateur introuvable.', 404));

    await sendPushToUser(friendId, {
      title: 'Invitation Multi',
      body:  `${me?.pseudo ?? 'Un ami'} t'invite à une séance Multi !`,
      data:  { type: 'lobby_invite', lobbyId: lobby._id.toString(), fromPseudo: me?.pseudo ?? 'Un ami' },
    });

    return res.status(200).json({
      success: true,
      message: `Invitation envoyée à ${friend.pseudo}.`,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// joinLobby  POST /api/lobby/:id/join
// ─────────────────────────────────────────────────────────────────────────────

/** Rejoint un lobby existant (statut initial 'waiting') — idempotent. */
exports.joinLobby = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return next(createError('id de lobby invalide.', 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError('Lobby introuvable.', 404));

    if (lobby.status !== 'waiting') {
      return next(createError("Ce lobby n'accepte plus de nouveaux membres.", 422));
    }

    const alreadyMember = lobby.members.some((m) => m.user.toString() === myId);
    if (!alreadyMember) {
      if (lobby.memberCount >= MAX_MEMBERS) {
        return next(createError('Le lobby est déjà complet (5 max).', 422));
      }
      lobby.members.push({ user: myId, status: 'waiting' });
      lobby.memberCount = lobby.members.length;
      await lobby.save();
    }

    await populateLobby(lobby);
    return res.status(200).json({ success: true, lobby: serializeLobby(lobby) });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// readyLobby  POST /api/lobby/:id/ready
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Passe le statut du membre appelant à 'ready' (le rejoint d'abord s'il n'est
 * pas encore membre — évite un aller-retour join+ready côté front). Dès que
 * TOUS les membres sont 'ready', le lobby passe 'active'.
 */
exports.readyLobby = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return next(createError('id de lobby invalide.', 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError('Lobby introuvable.', 404));

    if (lobby.status !== 'waiting') {
      return next(createError(`Impossible de se déclarer prêt : le lobby est au statut "${lobby.status}".`, 422));
    }

    let member = lobby.members.find((m) => m.user.toString() === myId);
    if (!member) {
      if (lobby.memberCount >= MAX_MEMBERS) {
        return next(createError('Le lobby est déjà complet (5 max).', 422));
      }
      lobby.members.push({ user: myId, status: 'ready' });
      lobby.memberCount = lobby.members.length;
    } else {
      member.status = 'ready';
    }

    // Coéquipiers de test God Mode : ils se déclarent prêts en même temps que
    // vous, pour pouvoir tester le passage à 'active' en solo.
    await autoProgressBots(lobby, 'ready');

    // Un lobby "Multi" à 1 seul membre n'a pas de sens : n'active qu'à partir
    // de 2 membres, sinon "100% de 1 personne prête" activerait le lobby dès
    // le créateur seul, avant même qu'un ami ait pu le rejoindre.
    const allReady = lobby.memberCount >= 2 && lobby.members.every((m) => m.status === 'ready');
    if (allReady) {
      lobby.status = 'active';
    }

    await lobby.save();
    await populateLobby(lobby);
    return res.status(200).json({ success: true, lobby: serializeLobby(lobby) });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// unreadyLobby  POST /api/lobby/:id/unready
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Repasse le statut du membre appelant à 'waiting' — pendant du bouton
 * "Je ne suis plus prêt" côté front. Seulement possible tant que le lobby
 * est encore 'waiting' (une fois 'active', tout le monde a déjà commencé,
 * il n'y a plus rien à annuler).
 */
exports.unreadyLobby = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return next(createError('id de lobby invalide.', 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError('Lobby introuvable.', 404));

    if (lobby.status !== 'waiting') {
      return next(createError(`Impossible d'annuler : le lobby est au statut "${lobby.status}".`, 422));
    }

    const member = lobby.members.find((m) => m.user.toString() === myId);
    if (!member) {
      return next(createError('Vous ne faites pas partie de ce lobby.', 403));
    }

    member.status = 'waiting';
    await lobby.save();
    await populateLobby(lobby);
    return res.status(200).json({ success: true, lobby: serializeLobby(lobby) });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// finishLobby  POST /api/lobby/:id/finish
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Passe le statut du membre appelant à 'finished'. Dès que TOUS les membres
 * ont fini, le lobby passe 'completed', le bonus XP Multi est figé
 * (`xpBonusPercent`), le compteur totalMultiSessions de chaque membre est
 * incrémenté, et les trophées sociaux Multi sont vérifiés (FIRST_MULTI_SESSION,
 * MULTI_SQUAD_FULL à 5 joueurs, MULTI_SESSIONS_5, MULTI_SESSIONS_30).
 */
exports.finishLobby = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return next(createError('id de lobby invalide.', 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError('Lobby introuvable.', 404));

    if (lobby.status !== 'active') {
      return next(createError(`Impossible de terminer : le lobby est au statut "${lobby.status}".`, 422));
    }

    const member = lobby.members.find((m) => m.user.toString() === myId);
    if (!member) {
      return next(createError('Vous ne faites pas partie de ce lobby.', 403));
    }

    member.status = 'finished';

    // Coéquipiers de test God Mode : ils terminent en même temps que vous.
    await autoProgressBots(lobby, 'finished');

    const allFinished = lobby.members.every((m) => m.status === 'finished');
    if (allFinished) {
      lobby.status = 'completed';
      lobby.xpBonusPercent = computeMultiBonusPercent(lobby.memberCount);
    }

    // Persiste AVANT de vérifier les trophées : checkAndUnlockAchievements
    // interroge WorkoutLobby en base (status: 'completed') — s'il tournait
    // avant ce save(), il verrait encore l'ancien statut 'active' et ne
    // débloquerait jamais rien.
    await lobby.save();

    let newlyUnlockedByUser = {};
    if (allFinished) {
      // Best-effort : les trophées ne doivent jamais faire échouer la clôture.
      try {
        // Incrémente le compteur AVANT de vérifier les trophées gradués
        // (MULTI_SESSIONS_5 / MULTI_SESSIONS_30), sinon le seuil serait
        // évalué sur l'ancienne valeur.
        await User.updateMany(
          { _id: { $in: lobby.members.map((m) => m.user) } },
          { $inc: { totalMultiSessions: 1 } },
        );

        const results = await Promise.all(
          lobby.members.map((m) => checkAndUnlockAchievements(m.user.toString())),
        );
        lobby.members.forEach((m, i) => { newlyUnlockedByUser[m.user.toString()] = results[i]; });
      } catch (_) {
        // ignore — la clôture du lobby ne doit pas dépendre des trophées.
      }
    }

    await populateLobby(lobby);

    return res.status(200).json({
      success: true,
      lobby: serializeLobby(lobby),
      completed: allFinished,
      newlyUnlocked: allFinished ? (newlyUnlockedByUser[myId] ?? []) : [],
    });
  } catch (err) {
    next(err);
  }
};

module.exports.computeMultiBonusPercent = computeMultiBonusPercent;
