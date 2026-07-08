'use strict';

const mongoose = require('mongoose');
const Friendship = require('../models/Friendship');
const User       = require('../models/User');
const Workout    = require('../models/Workout');
const ExerciseRecord = require('../models/ExerciseRecord');
const { ACHIEVEMENT_CATALOG } = require('./reward.controller');
const { LOCAL_TROPHY_CATALOG } = require('../data/localTrophyCatalog');

// Catalogue combiné : backend (achievements serveur) + miroir du catalogue
// LOCAL (V1, synchronisé via PUT /rewards/achievements/sync). Un profil
// d'ami affiche ainsi les 2 systèmes de trophées d'Athly en une seule vue.
const FULL_ACHIEVEMENT_CATALOG = { ...ACHIEVEMENT_CATALOG, ...LOCAL_TROPHY_CATALOG };
const FULL_CATALOG_SIZE        = Object.keys(FULL_ACHIEVEMENT_CATALOG).length;

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
const FRIEND_PUBLIC_FIELDS = 'pseudo discriminator level rank xp equippedFrame';

/**
 * Streak courante (jours consécutifs) calculée depuis des dates de séances
 * synchronisées côté backend. Approximation honnête : contrairement au calcul
 * local (front), elle ne voit pas les rituels/activités 100% locales — mais
 * c'est la seule donnée de séance disponible pour le profil d'un tiers.
 */
// Clé YYYY-MM-DD basée sur les composantes LOCALES (pas .toISOString(), qui
// décale au jour UTC précédent/suivant selon le fuseau du serveur).
function dayKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}

function computeStreakFromDates(dates) {
  const days = new Set(dates.map((d) => dayKey(d)));
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);

  if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);

  let streak = 0;
  while (days.has(dayKey(cur))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/**
 * Étend le catalogue de trophées avec l'état débloqué/verrouillé pour un
 * utilisateur donné — même logique que getUserAchievements, factorisée ici
 * pour être réutilisée sur le profil public d'un ami.
 */
function buildAchievementsView(userAchievements) {
  const unlockedMap = new Map(userAchievements.map((a) => [a.achievementId, a.unlockedAt]));

  const achievements = Object.values(FULL_ACHIEVEMENT_CATALOG).map((entry) => {
    const unlocked   = unlockedMap.has(entry.id);
    const unlockedAt = unlockedMap.get(entry.id) ?? null;

    if (entry.hidden && !unlocked) {
      return {
        id: entry.id, name: '???', description: 'Ce trophée est encore secret.',
        category: entry.category, hidden: true, unlocked: false, unlockedAt: null,
      };
    }
    return { ...entry, unlocked, unlockedAt };
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return {
    achievements,
    stats: {
      total:      FULL_CATALOG_SIZE,
      unlocked:   unlockedCount,
      percentage: Math.round((unlockedCount / FULL_CATALOG_SIZE) * 100),
    },
  };
}

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
 * Récupère les demandes d'ami en attente pour l'utilisateur connecté, dans
 * les deux sens :
 *  - `requests` : demandes REÇUES (je suis recipient) — inchangé, back-compat.
 *  - `sent`     : demandes ENVOYÉES par moi, toujours en attente de réponse.
 */
exports.getPendingRequests = async (req, res, next) => {
  try {
    const myId = req.user.id;

    const [requests, sent] = await Promise.all([
      Friendship.find({ recipient: myId, status: 'pending' })
        .populate('requester', FRIEND_PUBLIC_FIELDS)
        .sort({ createdAt: -1 }),
      Friendship.find({ requester: myId, status: 'pending' })
        .populate('recipient', FRIEND_PUBLIC_FIELDS)
        .sort({ createdAt: -1 }),
    ]);

    return res.status(200).json({
      success:  true,
      count:    requests.length,
      requests,
      sentCount: sent.length,
      sent,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// cancelFriendRequest  DELETE /api/friends/request/:requestId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Annule une demande d'ami que J'AI ENVOYÉE et qui est toujours en attente —
 * pendant du "refuser" côté destinataire, mais côté expéditeur.
 */
exports.cancelFriendRequest = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { requestId } = req.params;

    if (!isValidId(requestId)) {
      return next(createError('requestId invalide.', 400));
    }

    const friendship = await Friendship.findById(requestId);
    if (!friendship) {
      return next(createError('Demande d\'ami introuvable.', 404));
    }
    if (friendship.requester.toString() !== myId) {
      return next(createError('Action non autorisée : vous n\'êtes pas l\'auteur de cette demande.', 403));
    }
    if (friendship.status !== 'pending') {
      return next(createError(`Impossible d'annuler une demande au statut "${friendship.status}".`, 422));
    }

    await friendship.deleteOne();

    return res.status(200).json({ success: true, message: 'Demande d\'ami annulée.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// removeFriend  DELETE /api/friends/:friendshipId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Supprime une amitié ACCEPTÉE (retire un ami) — l'un ou l'autre membre de
 * la relation peut la rompre. Ne touche pas à un éventuel groupe de streak
 * partagé (retrait manuel séparé, comme pour n'importe quel autre membre).
 */
exports.removeFriend = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const { friendshipId } = req.params;

    if (!isValidId(friendshipId)) {
      return next(createError('friendshipId invalide.', 400));
    }

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      return next(createError('Amitié introuvable.', 404));
    }
    const isMember = friendship.requester.toString() === myId || friendship.recipient.toString() === myId;
    if (!isMember) {
      return next(createError('Action non autorisée : vous ne faites pas partie de cette amitié.', 403));
    }
    if (friendship.status !== 'accepted') {
      return next(createError('Cette relation n\'est pas une amitié active.', 422));
    }

    await friendship.deleteOne();

    return res.status(200).json({ success: true, message: 'Ami retiré.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// searchUsers  GET /api/friends/search?q=
// ─────────────────────────────────────────────────────────────────────────────

// Format exact "Pseudo#1234" — Section III : plus de recherche floue par
// substring, on exige le tag complet pour éviter d'ajouter la mauvaise
// personne (deux comptes peuvent partager le même pseudo).
const FULL_TAG_PATTERN = /^(.+)#(\d{4})$/;

/**
 * Recherche d'un utilisateur par tag EXACT "Pseudo#1234" (insensible à la
 * casse sur le pseudo, discriminator exact). Renvoie 0 ou 1 résultat — sert
 * la carte "Preview" avant envoi d'invitation, pas une liste de suggestions.
 */
exports.searchUsers = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const q    = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const match = q.match(FULL_TAG_PATTERN);
    if (!match) {
      return next(createError('Utilise le format complet "Pseudo#1234" pour rechercher un athlète.', 400));
    }
    const [, pseudo, discriminator] = match;

    const users = await User.find({ _id: { $ne: myId }, pseudo, discriminator })
      .collation({ locale: 'en', strength: 2 })
      .select(FRIEND_PUBLIC_FIELDS)
      .limit(1);

    // Annotation du statut de relation en une seule requête
    const ids = users.map((u) => u._id);
    const relations = await Friendship.find({
      $or: [
        { requester: myId, recipient: { $in: ids } },
        { recipient: myId, requester: { $in: ids } },
      ],
    });

    const results = users.map((u) => {
      const rel = relations.find(
        (r) => r.requester.toString() === u._id.toString() || r.recipient.toString() === u._id.toString(),
      );
      let relationStatus = 'none';
      let requestId      = null;
      if (rel) {
        requestId = rel._id;
        if (rel.status === 'accepted')      relationStatus = 'accepted';
        else if (rel.status === 'pending') {
          relationStatus = rel.requester.toString() === myId ? 'pending_sent' : 'pending_received';
        }
      }
      return { user: u, relationStatus, requestId };
    });

    return res.status(200).json({ success: true, count: results.length, results });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getFriendProfile  GET /api/friends/profile/:friendId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Profil public d'un AMI ACCEPTÉ uniquement : identité de jeu, progression,
 * cadre équipé, trophées débloqués (catalogue complet), stats de séances
 * (total, streak approximée, minutes cumulées), records d'exercices,
 * niveau d'amitié. 403 si la relation n'est pas acceptée — pas de fuite de
 * données entre inconnus.
 */
exports.getFriendProfile = async (req, res, next) => {
  try {
    const myId         = req.user.id;
    const { friendId } = req.params;

    if (!isValidId(friendId)) return next(createError('friendId invalide.', 400));

    const friendship = await Friendship.findOne({
      $or: [
        { requester: myId, recipient: friendId },
        { requester: friendId, recipient: myId },
      ],
      status: 'accepted',
    });
    if (!friendship) {
      return next(createError("Vous devez être amis pour consulter ce profil.", 403));
    }

    const friend = await User.findById(friendId)
      .select('pseudo level rank xp achievements showcasedAchievements showcasedRecords streakGels totalWorkoutMinutes equippedFrame createdAt');
    if (!friend) return next(createError('Utilisateur introuvable.', 404));

    const friendObjectId = new mongoose.Types.ObjectId(friendId);

    // Records mis en avant par l'ami lui-même (max 6, ordre choisi) — voir
    // updateRecordsShowcase. Si jamais configuré (comptes pré-migration),
    // repli sur l'ancien comportement : top 5 auto par poids max.
    const hasShowcase = Array.isArray(friend.showcasedRecords) && friend.showcasedRecords.length > 0;
    const recordsMatch = hasShowcase
      ? { user: friendObjectId, exerciceNom: { $in: friend.showcasedRecords } }
      : { user: friendObjectId };

    const recordsPromise = ExerciseRecord.aggregate([
      { $match: recordsMatch },
      { $unwind: '$series' },
      { $group: {
        _id:       '$exerciceNom',
        maxPoids:  { $max: '$series.poids' },
        maxReps:   { $max: '$series.repetitions' },
      } },
      { $sort: { maxPoids: -1 } },
      { $limit: hasShowcase ? 6 : 5 },
    ]).then((rows) => {
      if (!hasShowcase) return rows;
      // Réordonne selon l'ordre choisi par l'ami (l'aggregate trie par poids,
      // pas par ordre de sélection) — l'ordre de mise en avant doit primer.
      const byName = new Map(rows.map((r) => [r._id, r]));
      return friend.showcasedRecords.map((name) => byName.get(name)).filter(Boolean);
    });

    // Séances finalisées synchronisées côté backend (total + dates pour la streak)
    const workoutsPromise = Workout.find({
      user:   friendObjectId,
      status: { $in: ['finished', 'completed'] },
    }).select('date');

    const [records, workouts] = await Promise.all([recordsPromise, workoutsPromise]);

    const { achievements, stats: achievementsStats } = buildAchievementsView(friend.achievements);

    return res.status(200).json({
      success: true,
      profile: {
        user:            friend,
        friendshipLevel: friendship.friendshipLevel,
        friendshipXp:    friendship.friendshipXp,
        stats: {
          totalSessions:       workouts.length,
          totalActiveDays:     new Set(workouts.map((w) => dayKey(w.date))).size,
          streak:              computeStreakFromDates(workouts.map((w) => w.date)),
          totalWorkoutMinutes: friend.totalWorkoutMinutes,
        },
        achievements,
        achievementsStats,
        // Restreint aux trophées réellement débloqués — défense en profondeur
        // contre un désync (ex: trophée retiré après avoir été mis en vitrine).
        showcasedAchievements: (friend.showcasedAchievements || []).filter((id) =>
          friend.achievements.some((a) => a.achievementId === id),
        ),
        records: records.map((r) => ({
          exercice: r._id,
          maxPoids: r.maxPoids,
          maxReps:  r.maxReps,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getLeaderboard  GET /api/friends/leaderboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classement dynamique : l'utilisateur + tous ses amis acceptés,
 * triés par XP décroissant, avec le rang de chacun.
 */
exports.getLeaderboard = async (req, res, next) => {
  try {
    const myId = req.user.id;

    const friendships = await Friendship.find({
      $or: [{ requester: myId }, { recipient: myId }],
      status: 'accepted',
    });

    const friendIds = friendships.map((f) =>
      f.requester.toString() === myId ? f.recipient : f.requester,
    );

    const competitors = await User.find({ _id: { $in: [...friendIds, myId] } })
      .select(FRIEND_PUBLIC_FIELDS)
      .sort({ xp: -1 });

    const leaderboard = competitors.map((u, index) => ({
      position: index + 1,
      user:     u,
      isMe:     u._id.toString() === myId,
    }));

    return res.status(200).json({ success: true, count: leaderboard.length, leaderboard });
  } catch (err) {
    next(err);
  }
};
