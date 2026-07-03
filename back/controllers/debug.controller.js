'use strict';

const crypto      = require('crypto');
const bcrypt       = require('bcrypt');
const User         = require('../models/User');
const Friendship   = require('../models/Friendship');
const { xpForLevel, getRankForLevel } = require('../utils/levelHelpers');
const { addItemAtomic, addUniqueItemOnce } = require('../services/inventory.service');
const { checkAndUnlockAchievements } = require('./reward.controller');

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
 * connecté, pour tester l'ouverture de coffre sans cumuler 2h de séance par
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
// giveAllItems  POST /api/debug/godmode/give-all-items
// ─────────────────────────────────────────────────────────────────────────────

// Rareté d'affichage de chaque itemType — miroir de front/src/services/
// inventory.service.js (ITEM_CATALOG). Dupliqué volontairement ici : ce
// contrôleur n'a pas de dépendance vers le code front, et cette table est un
// simple outil de QA (pas une règle de jeu, qui reste dans chest.service.js).
const ITEM_RARITY_MAP = {
  ENERGY_DRINK:            'common',
  CHEST_KEY:               'common',
  STREAK_FREEZE:           'rare',
  DOUBLE_XP:               'rare',
  SUPER_STREAK_FREEZE:     'epic',
  TRIPLE_XP:               'epic',
  LEVEL_COUPON:            'legendary',
  QUINTUPLE_XP:            'legendary',
  PROFILE_FRAME_BLOOD_BOND:'unique',
  FRAME_COLOR_BLOOD_SANG:  'unique',
  THEME_UNLOCK_BLOOD_SANG: 'unique',
};

/**
 * Outil de test : injecte 1 exemplaire de CHAQUE itemType existant dans
 * l'inventaire de l'utilisateur connecté — permet de tester en un clic tous
 * les consommables ET tous les cosmétiques Uniques réclamables (cadre,
 * couleur, thème), sans enchaîner des dizaines d'actions de jeu.
 *
 * La liste des itemTypes vient directement de l'enum Mongoose (User.js) :
 * toujours synchronisée avec le schéma, aucun risque de dérive si un nouvel
 * item est ajouté un jour sans mettre à jour ce contrôleur.
 */
exports.giveAllItems = async (req, res, next) => {
  try {
    const itemTypes = User.schema.path('inventory').schema.path('itemType').enumValues;

    for (const itemType of itemTypes) {
      const rarity = ITEM_RARITY_MAP[itemType] || 'common';
      await addItemAtomic(req.user.id, itemType, rarity, 1);
    }

    const user = await User.findById(req.user.id).select('inventory');
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    return res.status(200).json({
      success:   true,
      message:   `${itemTypes.length} objet(s) ajouté(s) (1 exemplaire de chaque).`,
      inventory: user.inventory,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateChestsOpened  POST /api/debug/godmode/simulate-chests-opened
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : incrémente directement `totalChestsOpened` sans passer par
 * de vraies ouvertures de coffre — les trophées gradués (CHEST_1…CHEST_200)
 * et le déblocage du thème "Rouge Sang" à 100 coffres nécessiteraient sinon
 * des dizaines/centaines d'actions manuelles pour être testés.
 *
 * Réplique le même octroi que openChest au palier 100 (voir
 * inventory.controller.js) pour rester cohérent avec le vrai parcours.
 *
 * Body : { amount?: number } — défaut 1, borné à 250 (couvre CHEST_200).
 */
exports.simulateChestsOpened = async (req, res, next) => {
  try {
    const amount = req.body.amount === undefined ? 1 : parseInt(req.body.amount, 10);
    if (!Number.isFinite(amount) || amount < 1 || amount > 250) {
      return next(createError('amount doit être un entier entre 1 et 250.', 400));
    }

    const updated = await User.findOneAndUpdate(
      { _id: req.user.id },
      { $inc: { totalChestsOpened: amount } },
      { returnDocument: 'after' },
    ).select('totalChestsOpened');
    if (!updated) return next(createError('Utilisateur introuvable.', 404));

    let themeUnlockGranted = false;
    if (updated.totalChestsOpened >= 100) {
      const granted = await addUniqueItemOnce(req.user.id, 'THEME_UNLOCK_BLOOD_SANG', 'unique');
      themeUnlockGranted = Boolean(granted);
    }

    const newlyUnlocked = await checkAndUnlockAchievements(req.user.id);

    return res.status(200).json({
      success: true,
      message: `+${amount} coffre(s) ouvert(s) simulé(s) (total : ${updated.totalChestsOpened}).`,
      totalChestsOpened: updated.totalChestsOpened,
      themeUnlockGranted,
      newlyUnlocked,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateReferral  POST /api/debug/godmode/simulate-referral
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : crée un compte factice "filleul" avec referredBy pointant
 * vers l'utilisateur connecté, pour débloquer FIRST_REFERRAL sans avoir à
 * faire créer un vrai second compte et réclamer un code de parrainage.
 */
exports.simulateReferral = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), MOCK_PASSWORD_ROUNDS);

    await User.create({
      pseudo:     `Filleul_${Date.now().toString(36)}`,
      email:      `mock-referral-${myId}-${Date.now()}@athly.dev`,
      password:   passwordHash,
      isVerified: true,
      referredBy: myId,
    });

    const newlyUnlocked = await checkAndUnlockAchievements(myId);

    return res.status(201).json({
      success: true,
      message: 'Parrainage simulé : un filleul factice a été créé.',
      newlyUnlocked,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateBirthday  POST /api/debug/godmode/simulate-birthday
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : force la date de naissance à aujourd'hui (année neutre) et
 * marque le cadeau d'anniversaire comme déjà réclamé cette année — débloque
 * BIRTHDAY_SET et BIRTHDAY_CELEBRATED sans attendre le vrai jour J.
 *
 * Contourne volontairement la garde anti-triche "une seule saisie" de
 * setBirthdate (voir reward.controller.js) : c'est un outil de dev, pas le
 * parcours utilisateur normal.
 */
exports.simulateBirthday = async (req, res, next) => {
  try {
    const now = new Date();
    const birthdate = new Date(Date.UTC(2000, now.getUTCMonth(), now.getUTCDate()));

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          isBirthdateSet: true,
          birthdate,
          lastBirthdayRewardedYear: now.getUTCFullYear(),
        },
      },
      { new: true },
    );
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    const newlyUnlocked = await checkAndUnlockAchievements(req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Anniversaire simulé (aujourd\'hui).',
      newlyUnlocked,
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
