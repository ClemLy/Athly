'use strict';

const mongoose      = require('mongoose');
const WorkoutLobby  = require('../models/WorkoutLobby');
const User          = require('../models/User');
const Friendship    = require('../models/Friendship');
const { sendPushToUser } = require('../services/push.service');
const { checkAndUnlockAchievements } = require('./reward.controller');
const { checkAndUnlockTitles } = require('./title.controller');

const { MAX_MEMBERS } = WorkoutLobby;
// Une invitation non acceptée expire au bout de 2 h (lobby certainement abandonné).
const INVITE_TTL_MS = 2 * 60 * 60 * 1000;
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

/**
 * Un lobby n'est rejoignable que par un ami accepté d'au moins un membre
 * actuel (c'est le cercle que `inviteToLobby` peut atteindre). Sans ce
 * contrôle, n'importe quel compte connaissant l'identifiant d'un lobby
 * pouvait s'y inviter seul et voir le pseudo de ses membres.
 */
async function canJoinLobby(lobby, userId) {
  const memberIds = lobby.members.map((m) => m.user);
  return Friendship.exists({
    status: 'accepted',
    $or: [
      { requester: userId, recipient: { $in: memberIds } },
      { recipient: userId, requester: { $in: memberIds } },
    ],
  });
}

/**
 * Clôture le lobby si TOUS ses membres restants ont fini : passage atomique
 * 'active' → 'completed' (un seul appel peut le faire, donc compteurs et
 * trophées ne sont distribués qu'une fois), bonus XP figé, compteur
 * totalMultiSessions incrémenté, trophées et titres vérifiés.
 * Appelé par finishLobby (le dernier termine) et leaveLobby (le dernier
 * retardataire s'en va).
 */
async function closeLobbyIfDone(lobbyId, memberCount) {
  const closed = await WorkoutLobby.findOneAndUpdate(
    {
      _id: lobbyId,
      status: 'active',
      'members.0': { $exists: true },
      members: { $not: { $elemMatch: { status: { $ne: 'finished' } } } },
    },
    { $set: { status: 'completed', xpBonusPercent: computeMultiBonusPercent(memberCount) } },
    { returnDocument: 'after' },
  );
  const unlocked = {};
  const titles = {};
  if (!closed) return { closed: null, unlocked, titles };

  // Best-effort : les trophées/titres ne doivent jamais faire échouer la clôture.
  try {
    // Incrémente le compteur AVANT de vérifier les trophées gradués
    // (MULTI_SESSIONS_5 / MULTI_SESSIONS_30), sinon le seuil serait
    // évalué sur l'ancienne valeur.
    await User.updateMany(
      { _id: { $in: closed.members.map((m) => m.user) } },
      { $inc: { totalMultiSessions: 1 } },
    );
    const results = await Promise.all(
      closed.members.map((m) => checkAndUnlockAchievements(m.user.toString())),
    );
    closed.members.forEach((m, i) => { unlocked[m.user.toString()] = results[i]; });

    const titleResults = await Promise.all(
      closed.members.map((m) => checkAndUnlockTitles(m.user.toString())),
    );
    closed.members.forEach((m, i) => { titles[m.user.toString()] = titleResults[i]; });
  } catch (_) {
    // ignore — la clôture du lobby ne doit pas dépendre des trophées/titres.
  }
  return { closed, unlocked, titles };
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
    if (!isValidId(id)) return next(createError("Cette séance Multi n'existe plus.", 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError("Cette séance Multi n'existe plus.", 404));

    const myId = req.user.id;
    if (!lobby.members.some((m) => m.user.toString() === myId)) {
      return next(createError("Tu ne fais pas partie de cette séance Multi.", 403));
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

    if (!isValidId(id)) return next(createError("Cette séance Multi n'existe plus.", 400));
    if (!friendId || !isValidId(friendId)) return next(createError("Choisis un ami à inviter.", 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError("Cette séance Multi n'existe plus.", 404));

    if (!lobby.members.some((m) => m.user.toString() === myId)) {
      return next(createError("Tu ne fais pas partie de cette séance Multi.", 403));
    }
    if (lobby.status !== 'waiting') {
      return next(createError("Cette séance Multi a déjà commencé.", 422));
    }
    if (lobby.memberCount >= MAX_MEMBERS) {
      return next(createError("Cette séance Multi est complète (5 participants maximum).", 422));
    }

    const isFriend = await Friendship.exists({
      $or: [
        { requester: myId, recipient: friendId, status: 'accepted' },
        { requester: friendId, recipient: myId, status: 'accepted' },
      ],
    });
    if (!isFriend) return next(createError("Tu ne peux inviter que tes amis.", 403));

    const [me, friend] = await Promise.all([
      User.findById(myId).select('pseudo'),
      User.findById(friendId).select('pseudo'),
    ]);
    if (!friend) return next(createError('Ce compte est introuvable.', 404));
    if (lobby.members.some((m) => m.user.toString() === friendId)) {
      return next(createError(`${friend.pseudo} est déjà dans la séance.`, 422));
    }

    // Visible dans l'app même sans notification (web, Expo Go, push coupées).
    await WorkoutLobby.updateOne({ _id: lobby._id }, { $pull: { invitedUsers: { user: friendId } } });
    await WorkoutLobby.updateOne(
      { _id: lobby._id },
      { $push: { invitedUsers: { user: friendId, by: myId, at: new Date() } } },
    );

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
    if (!isValidId(id)) return next(createError("Cette séance Multi n'existe plus.", 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError("Cette séance Multi n'existe plus.", 404));

    if (lobby.status !== 'waiting') {
      return next(createError("Cette séance Multi a déjà commencé.", 422));
    }

    const alreadyMember = lobby.members.some((m) => m.user.toString() === myId);
    if (!alreadyMember) {
      if (!(await canJoinLobby(lobby, myId))) {
        return next(createError("Cette séance Multi est réservée aux amis de ses participants.", 403));
      }
      if (lobby.memberCount >= MAX_MEMBERS) {
        return next(createError("Cette séance Multi est complète (5 participants maximum).", 422));
      }
      lobby.members.push({ user: myId, status: 'waiting' });
      lobby.memberCount = lobby.members.length;
      lobby.invitedUsers = lobby.invitedUsers.filter((i) => i.user.toString() !== myId);
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
    if (!isValidId(id)) return next(createError("Cette séance Multi n'existe plus.", 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError("Cette séance Multi n'existe plus.", 404));

    if (lobby.status !== 'waiting') {
      return next(createError("Cette séance Multi a déjà commencé.", 422));
    }

    let member = lobby.members.find((m) => m.user.toString() === myId);
    if (!member) {
      if (!(await canJoinLobby(lobby, myId))) {
        return next(createError("Cette séance Multi est réservée aux amis de ses participants.", 403));
      }
      if (lobby.memberCount >= MAX_MEMBERS) {
        return next(createError("Cette séance Multi est complète (5 participants maximum).", 422));
      }
      lobby.members.push({ user: myId, status: 'ready' });
      lobby.memberCount = lobby.members.length;
      lobby.invitedUsers = lobby.invitedUsers.filter((i) => i.user.toString() !== myId);
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
    if (!isValidId(id)) return next(createError("Cette séance Multi n'existe plus.", 400));

    const lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError("Cette séance Multi n'existe plus.", 404));

    if (lobby.status !== 'waiting') {
      return next(createError("Cette séance Multi a déjà commencé.", 422));
    }

    const member = lobby.members.find((m) => m.user.toString() === myId);
    if (!member) {
      return next(createError("Tu ne fais pas partie de cette séance Multi.", 403));
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
    if (!isValidId(id)) return next(createError("Cette séance Multi n'existe plus.", 400));

    let lobby = await WorkoutLobby.findById(id);
    if (!lobby) return next(createError("Cette séance Multi n'existe plus.", 404));

    if (lobby.status !== 'active') {
      return next(createError("Cette séance Multi n'est pas en cours.", 422));
    }

    const member = lobby.members.find((m) => m.user.toString() === myId);
    if (!member) {
      return next(createError("Tu ne fais pas partie de cette séance Multi.", 403));
    }

    // Écriture atomique du statut du membre (positionnel) : deux membres qui
    // terminent au même instant ne s'écrasent plus mutuellement (avant, le
    // dernier save() pouvait laisser le lobby bloqué en 'active').
    await WorkoutLobby.updateOne(
      { _id: lobby._id, status: 'active', 'members.user': myId },
      { $set: { 'members.$.status': 'finished' } },
    );

    // Coéquipiers de test God Mode : ils terminent en même temps que vous.
    const botIds = (await User.find({ _id: { $in: lobby.members.map((m) => m.user) }, isTestBot: true }).select('_id'))
      .map((b) => b._id);
    if (botIds.length > 0) {
      await WorkoutLobby.updateOne(
        { _id: lobby._id },
        { $set: { 'members.$[bot].status': 'finished' } },
        { arrayFilters: [{ 'bot.user': { $in: botIds } }] },
      );
    }

    // Clôture si tout le monde a fini (persistée AVANT la vérification des
    // trophées : checkAndUnlockAchievements interroge WorkoutLobby en base).
    const { closed, unlocked: newlyUnlockedByUser, titles: newlyUnlockedTitlesByUser } =
      await closeLobbyIfDone(lobby._id, lobby.memberCount);
    const allFinished = Boolean(closed);
    lobby = closed || (await WorkoutLobby.findById(lobby._id));

    await populateLobby(lobby);

    return res.status(200).json({
      success: true,
      lobby: serializeLobby(lobby),
      completed: allFinished,
      newlyUnlocked: allFinished ? (newlyUnlockedByUser[myId] ?? []) : [],
      newlyUnlockedTitles: allFinished ? (newlyUnlockedTitlesByUser[myId] ?? []) : [],
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// leaveLobby  POST /api/lobby/:id/leave
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quitte la séance Multi (fermeture du salon d'attente, abandon de la séance).
 * Sans ça, un membre parti restait « pas prêt » (personne ne pouvait plus
 * démarrer) ou « en séance » (les autres attendaient sa fin indéfiniment).
 *
 *  - salon d'attente : le membre est retiré ; si tous les restants sont
 *    prêts (2+), la séance démarre ; un salon vide est supprimé.
 *  - séance en cours : le membre est retiré ; si tous les restants ont
 *    déjà fini, la séance est clôturée pour eux.
 *  - l'hôte qui part transmet son rôle au membre suivant.
 *
 * Idempotent : quitter un salon inexistant, terminé ou déjà quitté répond 200.
 */
exports.leaveLobby = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return next(createError("Cette séance Multi n'existe plus.", 400));

    const lobby = await WorkoutLobby.findOneAndUpdate(
      { _id: id, 'members.user': myId, status: { $ne: 'completed' } },
      { $pull: { members: { user: myId } } },
      { returnDocument: 'after' },
    );
    if (!lobby) return res.status(200).json({ success: true, lobby: null });

    if (lobby.members.length === 0) {
      await WorkoutLobby.deleteOne({ _id: lobby._id });
      return res.status(200).json({ success: true, lobby: null });
    }

    lobby.memberCount = lobby.members.length;
    if (lobby.creatorId.toString() === myId) lobby.creatorId = lobby.members[0].user;
    if (lobby.status === 'waiting'
      && lobby.memberCount >= 2
      && lobby.members.every((m) => m.status === 'ready')) {
      lobby.status = 'active';
    }
    await lobby.save();

    if (lobby.status === 'active') await closeLobbyIfDone(lobby._id, lobby.memberCount);

    return res.status(200).json({ success: true, lobby: null });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getMyInvites  GET /api/lobby/invites
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invitations Multi en attente pour l'utilisateur : salons encore ouverts,
 * non complets, où il a été invité il y a moins de 2 h et qu'il n'a pas
 * encore rejoints. Interrogée par l'app (écran Social, popup globale).
 */
exports.getMyInvites = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const since = new Date(Date.now() - INVITE_TTL_MS);

    const lobbies = await WorkoutLobby.find({
      status: 'waiting',
      'members.user': { $ne: myId },
      invitedUsers: { $elemMatch: { user: myId, at: { $gte: since } } },
      memberCount: { $lt: MAX_MEMBERS },
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('members.user', MEMBER_PUBLIC_FIELDS)
      .populate('invitedUsers.by', 'pseudo');

    const invites = lobbies.map((l) => {
      const inv = l.invitedUsers.find((i) => (i.user._id || i.user).toString() === myId);
      return {
        lobbyId:     l._id,
        from:        inv && inv.by ? { _id: inv.by._id, pseudo: inv.by.pseudo } : null,
        invitedAt:   inv ? inv.at : null,
        memberCount: l.memberCount,
        members:     l.members.map((m) => ({ user: m.user, status: m.status })),
      };
    });

    return res.status(200).json({ success: true, invites });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// declineInvite  POST /api/lobby/:id/decline
// ─────────────────────────────────────────────────────────────────────────────

/** Ignore une invitation Multi : elle n'est plus proposée. Idempotent. */
exports.declineInvite = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return next(createError("Cette séance Multi n'existe plus.", 400));
    await WorkoutLobby.updateOne({ _id: id }, { $pull: { invitedUsers: { user: myId } } });
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports.computeMultiBonusPercent = computeMultiBonusPercent;
