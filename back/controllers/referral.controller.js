'use strict';

const User = require('../models/User');
const { checkAndUnlockAchievements } = require('./reward.controller');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function addItem(user, itemType, rarity, qty = 1) {
  const existing = user.inventory.find((i) => i.itemType === itemType);
  if (existing) {
    existing.quantity += qty;
  } else {
    user.inventory.push({ itemType, rarity, quantity: qty });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// claimReferral  POST /api/referral/claim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valide un code de parrainage et distribue les récompenses aux deux parties.
 *
 * Sécurités anti-triche :
 *  - Impossible de soumettre son propre code (400)
 *  - Impossible d'utiliser un code si déjà parrainé (409)
 *  - Code inexistant en base (404)
 *
 * Récompenses :
 *  - Filleul et Parrain : 1 STREAK_FREEZE + 1 LEVEL_COUPON chacun
 *  - Trophée FIRST_REFERRAL potentiellement débloqué pour le Parrain
 */
exports.claimReferral = async (req, res, next) => {
  try {
    const myId         = req.user.id;
    const { referralCode } = req.body;

    if (!referralCode) {
      return next(createError('Le champ referralCode est obligatoire.', 400));
    }

    // ── Trouver le parrain via son code ────────────────────────────────────
    const referrer = await User.findOne({ referralCode: referralCode.trim() });
    if (!referrer) {
      return next(createError('Code de parrainage invalide.', 404));
    }

    // ── Garde : impossible d'utiliser son propre code ──────────────────────
    if (referrer._id.toString() === myId) {
      return next(createError("Vous ne pouvez pas utiliser votre propre code de parrainage.", 400));
    }

    // ── Charger le filleul ─────────────────────────────────────────────────
    const filleul = await User.findById(myId);
    if (!filleul) return next(createError('Utilisateur introuvable.', 404));

    // ── Garde : déjà parrainé ─────────────────────────────────────────────
    if (filleul.referredBy) {
      return next(createError("Vous avez déjà utilisé un code de parrainage.", 409));
    }

    // ── Enregistrer le parrain sur le filleul ──────────────────────────────
    filleul.referredBy = referrer._id;

    // ── Récompenses filleul : 1 STREAK_FREEZE + 1 LEVEL_COUPON ───────────
    addItem(filleul, 'STREAK_FREEZE', 'rare',      1);
    addItem(filleul, 'LEVEL_COUPON',  'legendary',  1);
    filleul.markModified('inventory');
    await filleul.save();

    // ── Récompenses parrain : 1 STREAK_FREEZE + 1 LEVEL_COUPON ──────────
    addItem(referrer, 'STREAK_FREEZE', 'rare',     1);
    addItem(referrer, 'LEVEL_COUPON',  'legendary', 1);
    referrer.markModified('inventory');
    await referrer.save();

    // ── Déblocage des trophées (FIRST_REFERRAL pour le parrain) ──────────
    // Les deux saves ci-dessus doivent être terminés avant les checks.
    const [filleulUnlocked, referrerUnlocked] = await Promise.all([
      checkAndUnlockAchievements(myId),
      checkAndUnlockAchievements(referrer._id.toString()),
    ]);

    return res.status(200).json({
      success:                 true,
      message:                 "Parrainage validé ! Vous avez chacun reçu vos récompenses.",
      filleulRewards:          { STREAK_FREEZE: 1, LEVEL_COUPON: 1 },
      referrerRewards:         { STREAK_FREEZE: 1, LEVEL_COUPON: 1 },
      filleulNewAchievements:  filleulUnlocked,
      referrerNewAchievements: referrerUnlocked,
    });
  } catch (err) {
    next(err);
  }
};
