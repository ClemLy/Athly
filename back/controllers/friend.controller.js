'use strict';

const mongoose = require('mongoose');
const Friendship = require('../models/Friendship');
const User       = require('../models/User');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Crée une erreur métier avec le bon statusCode pour le middleware global. */
function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** Vérifie qu'un ObjectId est valide avant de taper la DB. */
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Champs publics d'un ami renvoyés dans les listes.
 * On n'expose jamais password, verificationCode, resetPasswordCode…
 */
const FRIEND_PUBLIC_FIELDS = 'pseudo level rank xp';

// ─────────────────────────────────────────────────────────────────────────────
// sendFriendRequest  POST /api/friends/request
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Envoie une demande d'ami.
 *
 * Sécurités :
 *  - Impossible de s'ajouter soi-même.
 *  - Impossible si une relation existe déjà dans n'importe quel sens
 *    et n'importe quel statut (pending, accepted, rejected).
 *  - L'utilisateur cible doit exister.
 */
exports.sendFriendRequest = async (req, res, next) => {
  try {
    const myId       = req.user.id;
    const { friendId } = req.body;

    // ── Validation de l'ID ────────────────────────────────────────────────
    if (!friendId || !isValidId(friendId)) {
      return next(createError('friendId manquant ou invalide.', 400));
    }

    // ── Pas de demande à soi-même ─────────────────────────────────────────
    if (myId === friendId.toString()) {
      return next(createError('Impossible de vous ajouter vous-même en ami.', 422));
    }

    // ── L'utilisateur cible existe-t-il ? ────────────────────────────────
    const targetUser = await User.findById(friendId).select('_id');
    if (!targetUser) {
      return next(createError('Utilisateur introuvable.', 404));
    }

    // ── Relation déjà existante (dans les deux sens) ──────────────────────
    const existing = await Friendship.findOne({
      $or: [
        { requester: myId,     recipient: friendId },
        { requester: friendId, recipient: myId     },
      ],
    });

    if (existing) {
      const messages = {
        pending:  'Une demande est déjà en attente avec cet utilisateur.',
        accepted: 'Vous êtes déjà amis.',
        rejected: 'Cette demande a été refusée. Aucune nouvelle demande ne peut être envoyée.',
      };
      return next(createError(messages[existing.status] ?? 'Relation déjà existante.', 409));
    }

    // ── Création ──────────────────────────────────────────────────────────
    const friendship = await Friendship.create({
      requester: myId,
      recipient: friendId,
    });

    return res.status(201).json({
      success: true,
      message: 'Demande d\'ami envoyée.',
      friendship,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// acceptFriendRequest  PUT /api/friends/accept/:requestId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Accepte une demande d'ami.
 *
 * Sécurités :
 *  - Seul le destinataire (recipient) peut accepter.
 *  - La demande doit être en statut 'pending'.
 */
exports.acceptFriendRequest = async (req, res, next) => {
  try {
    const myId      = req.user.id;
    const { requestId } = req.params;

    if (!isValidId(requestId)) {
      return next(createError('requestId invalide.', 400));
    }

    const friendship = await Friendship.findById(requestId);

    if (!friendship) {
      return next(createError('Demande d\'ami introuvable.', 404));
    }

    // Seul le recipient peut accepter
    if (friendship.recipient.toString() !== myId) {
      return next(createError('Action non autorisée : vous n\'êtes pas le destinataire de cette demande.', 403));
    }

    if (friendship.status !== 'pending') {
      return next(createError(`Impossible d'accepter une demande au statut "${friendship.status}".`, 422));
    }

    friendship.status = 'accepted';
    await friendship.save();

    return res.status(200).json({
      success: true,
      message: 'Demande d\'ami acceptée.',
      friendship,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// declineFriendRequest  PUT /api/friends/decline/:requestId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Refuse et supprime une demande d'ami.
 *
 * On supprime le document (plutôt que de passer en 'rejected') pour :
 *  - Garder la DB propre.
 *  - Permettre à l'expéditeur de renvoyer une demande ultérieurement.
 * Si l'on veut bloquer définitivement, passer à `status = 'rejected'` ici
 * et adapter le check dans sendFriendRequest.
 *
 * Sécurités :
 *  - Seul le destinataire peut refuser.
 *  - La demande doit être en statut 'pending'.
 */
exports.declineFriendRequest = async (req, res, next) => {
  try {
    const myId      = req.user.id;
    const { requestId } = req.params;

    if (!isValidId(requestId)) {
      return next(createError('requestId invalide.', 400));
    }

    const friendship = await Friendship.findById(requestId);

    if (!friendship) {
      return next(createError('Demande d\'ami introuvable.', 404));
    }

    if (friendship.recipient.toString() !== myId) {
      return next(createError('Action non autorisée : vous n\'êtes pas le destinataire de cette demande.', 403));
    }

    if (friendship.status !== 'pending') {
      return next(createError(`Impossible de refuser une demande au statut "${friendship.status}".`, 422));
    }

    await friendship.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Demande d\'ami refusée et supprimée.',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getFriendsList  GET /api/friends/list
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Récupère tous les amis acceptés de l'utilisateur connecté.
 *
 * Pour chaque amitié, on renvoie les infos publiques de "l'autre" utilisateur
 * ainsi que les métadonnées de l'amitié (niveau, xp, depuis quand).
 */
exports.getFriendsList = async (req, res, next) => {
  try {
    const myId = req.user.id;

    const friendships = await Friendship.find({
      $or: [{ requester: myId }, { recipient: myId }],
      status: 'accepted',
    })
      .populate('requester', FRIEND_PUBLIC_FIELDS)
      .populate('recipient', FRIEND_PUBLIC_FIELDS)
      .sort({ updatedAt: -1 });

    // Retourne "l'autre" utilisateur (pas moi) pour chaque amitié
    const friends = friendships.map((f) => {
      const isRequester = f.requester._id.toString() === myId;
      return {
        friendshipId:    f._id,
        friendshipLevel: f.friendshipLevel,
        friendshipXp:    f.friendshipXp,
        since:           f.updatedAt,
        user:            isRequester ? f.recipient : f.requester,
      };
    });

    return res.status(200).json({
      success: true,
      count:   friends.length,
      friends,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getPendingRequests  GET /api/friends/pending
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Récupère les demandes d'ami reçues et en attente pour l'utilisateur connecté.
 * Seules les demandes dont JE suis le recipient sont retournées.
 */
exports.getPendingRequests = async (req, res, next) => {
  try {
    const myId = req.user.id;

    const requests = await Friendship.find({
      recipient: myId,
      status:    'pending',
    })
      .populate('requester', FRIEND_PUBLIC_FIELDS)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success:  true,
      count:    requests.length,
      requests,
    });
  } catch (err) {
    next(err);
  }
};
