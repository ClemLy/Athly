'use strict';

const User = require('../models/User');
const { xpForLevel, getRankForLevel } = require('../utils/levelHelpers');

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
