'use strict';

const User = require('../models/User');
const { addItemAtomic } = require('../services/inventory.service');
const { checkAndUnlockAchievements } = require('./reward.controller');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
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

    if (typeof referralCode !== 'string' || !referralCode.trim() || referralCode.length > 20) {
      return next(createError('Entre un code de parrainage valide (ex : ATH-X7K2P).', 400));
    }

    // ── Trouver le parrain via son code ────────────────────────────────────
    const referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() }).select('_id');
    if (!referrer) {
      return next(createError("Ce code de parrainage n'existe pas. Vérifie-le et réessaie.", 404));
    }

    // ── Garde : impossible d'utiliser son propre code ──────────────────────
    if (referrer._id.toString() === myId) {
      return next(createError("Tu ne peux pas utiliser ton propre code de parrainage.", 400));
    }

    // ── Enregistrement atomique du parrain : la condition referredBy: null
    //    garantit qu'un double appel simultané ne distribue les récompenses
    //    qu'une seule fois (sinon deux requêtes parallèles passaient le test
    //    "déjà parrainé" avant que l'une d'elles n'enregistre).
    const claimed = await User.findOneAndUpdate(
      { _id: myId, referredBy: null },
      { $set: { referredBy: referrer._id } },
      { returnDocument: 'after' },
    ).select('_id');

    if (!claimed) {
      const exists = await User.exists({ _id: myId });
      if (!exists) return next(createError('Ce compte est introuvable.', 404));
      return next(createError('Tu as déjà utilisé un code de parrainage.', 409));
    }

    // ── Récompenses : 1 STREAK_FREEZE + 1 LEVEL_COUPON chacun ─────────────
    await Promise.all([
      addItemAtomic(myId, 'STREAK_FREEZE', 'rare', 1),
      addItemAtomic(myId, 'LEVEL_COUPON', 'legendary', 1),
      addItemAtomic(referrer._id, 'STREAK_FREEZE', 'rare', 1),
      addItemAtomic(referrer._id, 'LEVEL_COUPON', 'legendary', 1),
    ]);

    // ── Déblocage des trophées (FIRST_REFERRAL pour le parrain) ──────────
    // Les deux saves ci-dessus doivent être terminés avant les checks.
    const [filleulUnlocked, referrerUnlocked] = await Promise.all([
      checkAndUnlockAchievements(myId),
      checkAndUnlockAchievements(referrer._id.toString()),
    ]);

    return res.status(200).json({
      success:                 true,
      message:                 "Parrainage validé. Vous avez chacun reçu vos récompenses.",
      filleulRewards:          { STREAK_FREEZE: 1, LEVEL_COUPON: 1 },
      referrerRewards:         { STREAK_FREEZE: 1, LEVEL_COUPON: 1 },
      filleulNewAchievements:  filleulUnlocked,
      referrerNewAchievements: referrerUnlocked,
    });
  } catch (err) {
    next(err);
  }
};
