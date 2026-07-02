'use strict';

const User              = require('../models/User');
const { drawChestItem } = require('../services/chest.service');
const { consumeItemAtomic, addItemAtomic, purgeEmptyEntries } = require('../services/inventory.service');
const { getRankForLevel } = require('../utils/levelHelpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const MIN_LEVEL_FOR_CHEST = 11;

// Effets des consommables — chaque fonction modifie user en place
// Note : DOUBLE/TRIPLE/QUINTUPLE_XP donnent un XP instantané.
// Un système de boost temporaire (multiplicateur) est prévu dans une brique future.
const ITEM_EFFECTS = {
  ENERGY_DRINK:        (user) => { user.xp += 150; },
  STREAK_FREEZE:       (user) => { user.streakGels = Math.min(user.streakGels + 1, 3); },
  SUPER_STREAK_FREEZE: (user) => { user.streakGels = 3; },
  DOUBLE_XP:           (user) => { user.xp += 200; },
  TRIPLE_XP:           (user) => { user.xp += 300; },
  QUINTUPLE_XP:        (user) => { user.xp += 500; },
  LEVEL_COUPON: (user) => {
    user.level += 1;
    user.rank   = getRankForLevel(user.level);
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
    const user = await consumeItemAtomic(req.user.id, itemType);

    if (!user) {
      const exists = await User.exists({ _id: req.user.id });
      if (!exists) return next(createError('Utilisateur introuvable.', 404));
      return next(createError('Vous ne possédez pas cet objet.', 400));
    }

    // L'effet ne touche que des champs scalaires (xp, level, rank, streakGels) :
    // save() n'écrit que ces chemins, sans réécrire l'inventaire déjà à jour.
    ITEM_EFFECTS[itemType](user);
    await user.save();

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
