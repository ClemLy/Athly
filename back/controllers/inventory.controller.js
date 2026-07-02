'use strict';

const User              = require('../models/User');
const { drawChestItem } = require('../services/chest.service');
const { consumeItemAtomic, addItemAtomic, purgeEmptyEntries } = require('../services/inventory.service');
const { levelFromXP, getRankForLevel } = require('../utils/levelHelpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const MIN_LEVEL_FOR_CHEST = 11;

/**
 * Crédite atomiquement `amount` XP et recalcule level/rank si un palier est
 * franchi. Deux écritures ($inc puis $set conditionnel) mais aucune lecture
 * intermédiaire mutable : pas de fenêtre de perte d'XP entre deux consommations
 * simultanées (contrairement à un read → mutate en mémoire → save()).
 */
async function applyXpGain(userId, amount) {
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { xp: amount } },
    { returnDocument: 'after' },
  );
  if (!updated) return null;

  const newLevel = levelFromXP(updated.xp);
  if (newLevel === updated.level) return updated;

  return User.findOneAndUpdate(
    { _id: userId },
    { $set: { level: newLevel, rank: getRankForLevel(newLevel) } },
    { returnDocument: 'after' },
  );
}

// Effets des consommables — chaque effet est une opération atomique côté DB,
// jamais un mutate-en-mémoire + save() (qui perdrait des écritures concurrentes
// sur xp/streakGels si deux items sont utilisés au même instant).
const ITEM_EFFECTS = {
  ENERGY_DRINK:        (userId) => applyXpGain(userId, 150),
  DOUBLE_XP:           (userId) => applyXpGain(userId, 200),
  TRIPLE_XP:           (userId) => applyXpGain(userId, 300),
  QUINTUPLE_XP:        (userId) => applyXpGain(userId, 500),

  // Pipeline d'agrégation dans l'update : le plafond à 3 est calculé côté
  // MongoDB en une seule écriture atomique (pas de read-then-clamp en JS).
  STREAK_FREEZE: (userId) => User.findOneAndUpdate(
    { _id: userId },
    [{ $set: { streakGels: { $min: [{ $add: ['$streakGels', 1] }, 3] } } }],
    { returnDocument: 'after', updatePipeline: true },
  ),
  SUPER_STREAK_FREEZE: (userId) => User.findOneAndUpdate(
    { _id: userId },
    { $set: { streakGels: 3 } },
    { returnDocument: 'after' },
  ),

  LEVEL_COUPON: async (userId) => {
    const updated = await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { level: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) return null;
    return User.findOneAndUpdate(
      { _id: userId },
      { $set: { rank: getRankForLevel(updated.level) } },
      { returnDocument: 'after' },
    );
  },
};

const VALID_USE_ITEMS = Object.keys(ITEM_EFFECTS);

// ─────────────────────────────────────────────────────────────────────────────
// openChest  POST /api/inventory/chest/open
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ouvre un coffre.
 *
 * Sécurités :
 *  - Niveau minimum 11 (Rang Initié) requis.
 *  - L'utilisateur doit posséder au moins une CHEST_KEY dans son inventaire.
 *
 * Flux :
 *  1. Consomme 1 CHEST_KEY.
 *  2. Tire un item aléatoire via l'algorithme de tirage pondéré.
 *  3. Ajoute l'item à l'inventaire (incrémente si déjà présent).
 */
exports.openChest = async (req, res, next) => {
  try {
    // Consommation atomique : clé décrémentée UNIQUEMENT si possédée ET niveau
    // suffisant, en une seule écriture — aucune fenêtre de double-spend.
    const afterConsume = await consumeItemAtomic(req.user.id, 'CHEST_KEY', {
      level: { $gte: MIN_LEVEL_FOR_CHEST },
    });

    if (!afterConsume) {
      // Diagnostic du refus pour renvoyer l'erreur historique appropriée.
      const user = await User.findById(req.user.id).select('level inventory');
      if (!user) return next(createError('Utilisateur introuvable.', 404));
      if (user.level < MIN_LEVEL_FOR_CHEST) {
        return next(createError("Fonctionnalité bloquée jusqu'au niveau 11.", 403));
      }
      return next(createError('Aucun coffre disponible dans votre inventaire.', 400));
    }

    const drawnItem = drawChestItem();
    await addItemAtomic(req.user.id, drawnItem.itemType, drawnItem.rarity);
    const finalUser = await purgeEmptyEntries(req.user.id);

    return res.status(200).json({
      success:   true,
      message:   'Coffre ouvert !',
      drawnItem,
      inventory: finalUser.inventory,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// useItem  POST /api/inventory/item/use
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Utilise un consommable de l'inventaire.
 *
 * Body : { itemType: string }
 *
 * Flux :
 *  1. Valide l'itemType.
 *  2. Vérifie la possession et consomme 1 unité.
 *  3. Applique l'effet (XP, streakGels, level, rang…).
 */
exports.useItem = async (req, res, next) => {
  try {
    const { itemType } = req.body;

    if (!itemType || !VALID_USE_ITEMS.includes(itemType)) {
      return next(createError(
        `itemType invalide. Valeurs acceptées : ${VALID_USE_ITEMS.join(', ')}.`,
        400,
      ));
    }

    // Consommation atomique : même garde anti double-spend que openChest.
    const consumed = await consumeItemAtomic(req.user.id, itemType);

    if (!consumed) {
      const exists = await User.exists({ _id: req.user.id });
      if (!exists) return next(createError('Utilisateur introuvable.', 404));
      return next(createError('Vous ne possédez pas cet objet.', 400));
    }

    // Effet 100% atomique côté DB (xp/level/rank/streakGels) — voir ITEM_EFFECTS.
    const user = await ITEM_EFFECTS[itemType](req.user.id);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    const finalUser = await purgeEmptyEntries(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Objet utilisé avec succès.",
      user: {
        xp:         user.xp,
        level:      user.level,
        rank:       user.rank,
        streakGels: user.streakGels,
        inventory:  finalUser.inventory,
      },
    });
  } catch (err) {
    next(err);
  }
};
