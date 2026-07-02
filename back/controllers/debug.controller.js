'use strict';

const crypto      = require('crypto');
const bcrypt       = require('bcrypt');
const User         = require('../models/User');
const Friendship   = require('../models/Friendship');
const { xpForLevel, getRankForLevel } = require('../utils/levelHelpers');
const { addItemAtomic } = require('../services/inventory.service');

const MOCK_PASSWORD_ROUNDS = 10; // comptes jetables, jamais utilisés pour se connecter

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// ─────────────────────────────────────────────────────────────────────────────
// syncLevel  POST /api/debug/sync-level
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test réservé au dev/QA (jamais monté en production — voir
 * devOnly.middleware.js). Aligne xp/level/rank backend sur un niveau cible.
 *
 * Contexte : le panneau "God Mode" du front simule XP/niveau/streak
 * uniquement en local (AsyncStorage) pour l'affichage — il ne touche jamais
 * le `user.level` backend, qui est la SEULE source de vérité pour les
 * fonctionnalités gated côté serveur (coffres, niveau 11+). Sans cette
 * route, tester ces fonctionnalités nécessiterait des dizaines de vraies
 * séances. N'affecte jamais inventory/achievements — uniquement xp/level/rank.
 */
exports.syncLevel = async (req, res, next) => {
  try {
    const target = parseInt(req.body.level, 10);
    if (!Number.isFinite(target) || target < 0 || target > 200) {
      return next(createError('level doit être un entier entre 0 et 200.', 400));
    }

    const xp   = xpForLevel(target);
    const rank = getRankForLevel(target);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { level: target, xp, rank } },
      { new: true },
    ).select('level xp rank');

    if (!user) return next(createError('Utilisateur introuvable.', 404));

    return res.status(200).json({
      success: true,
      level:   user.level,
      xp:      user.xp,
      rank:    user.rank,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// giveChests  POST /api/debug/godmode/give-chests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : crédite atomiquement `amount` CHEST_KEY à l'utilisateur
 * connecté, pour tester l'ouverture de coffre sans cumuler 5h de séance par
 * palier. Réutilise addItemAtomic (même garde anti-race que openChest/useItem).
 *
 * Body : { amount?: number } — défaut 1, borné à 50 pour rester un outil de
 * test (pas un moyen de remplir l'inventaire à l'infini en un clic).
 */
exports.giveChests = async (req, res, next) => {
  try {
    const amount = req.body.amount === undefined ? 1 : parseInt(req.body.amount, 10);
    if (!Number.isFinite(amount) || amount < 1 || amount > 50) {
      return next(createError('amount doit être un entier entre 1 et 50.', 400));
    }

    const user = await addItemAtomic(req.user.id, 'CHEST_KEY', 'common', amount);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    const chestEntry = user.inventory.find((i) => i.itemType === 'CHEST_KEY');

    return res.status(200).json({
      success:   true,
      message:   `+${amount} coffre(s) ajouté(s).`,
      chestCount: chestEntry ? chestEntry.quantity : 0,
      inventory: user.inventory,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// mockSocial  POST /api/debug/godmode/mock-social
// ─────────────────────────────────────────────────────────────────────────────

// 3 profils types couvrant les usages de l'écran Social :
//  - 2 amis "accepted" → alimentent le Classement/Podium et permettent de
//    créer un Groupe de Streak.
//  - 1 ami "pending" (le faux profil est le requester, l'appelant le
//    recipient) → apparaît dans les demandes reçues, pour tester
//    Accepter/Refuser.
const MOCK_FRIEND_SPECS = [
  { suffix: 1, status: 'accepted' },
  { suffix: 2, status: 'accepted' },
  { suffix: 3, status: 'pending'  },
];

/**
 * Outil de test : génère (ou régénère) un petit réseau social factice
 * pour l'utilisateur connecté — 3 faux comptes User + leurs Friendship.
 *
 * Idempotent : les faux amis précédemment générés PAR CET utilisateur
 * (namespacés par son ObjectId dans l'email) sont supprimés avant d'en
 * recréer de nouveaux, pour permettre de relancer l'outil sans accumuler
 * des dizaines de doublons "FauxAmi_*" en base.
 */
exports.mockSocial = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const emailPrefix = `mock-${myId}-`;

    // ── Nettoyage des faux amis précédents de CET utilisateur ────────────────
    const previousMocks = await User.find({
      email: { $regex: `^${emailPrefix}` },
    }).select('_id');
    const previousIds = previousMocks.map((u) => u._id);
    if (previousIds.length > 0) {
      await Friendship.deleteMany({
        $or: [{ requester: { $in: previousIds } }, { recipient: { $in: previousIds } }],
      });
      await User.deleteMany({ _id: { $in: previousIds } });
    }

    // Mot de passe jetable — ces comptes ne sont jamais destinés à se connecter.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), MOCK_PASSWORD_ROUNDS);

    const created = [];
    for (const spec of MOCK_FRIEND_SPECS) {
      const level = Math.floor(Math.random() * 40) + 5; // 5–44 : mixe plusieurs rangs
      const mockUser = await User.create({
        pseudo:     `FauxAmi_${spec.suffix}`,
        email:      `${emailPrefix}${spec.suffix}@athly.dev`,
        password:   passwordHash,
        isVerified: true,
        level,
        xp:         xpForLevel(level),
        rank:       getRankForLevel(level),
      });

      await Friendship.create(
        spec.status === 'pending'
          ? { requester: mockUser._id, recipient: myId, status: 'pending' }
          : { requester: myId, recipient: mockUser._id, status: 'accepted' },
      );

      created.push({ pseudo: mockUser.pseudo, level, rank: mockUser.rank, status: spec.status });
    }

    return res.status(201).json({
      success: true,
      message: `${created.length} faux profils générés (2 amis acceptés, 1 demande en attente).`,
      created,
    });
  } catch (err) {
    next(err);
  }
};
