'use strict';

const User              = require('../models/User');
const { drawChestItem } = require('../services/chest.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const MIN_LEVEL_FOR_CHEST = 11;

// Correspondance niveau → rang (ordre décroissant : premier match gagné)
const RANK_THRESHOLDS = [
  { min: 200, rank: 'ATHLY GOD'    },
  { min: 171, rank: 'Légende'      },
  { min: 141, rank: 'Grand Maître' },
  { min: 111, rank: 'Maître'       },
  { min:  91, rank: 'Élite'        },
  { min:  71, rank: 'Warrior'      },
  { min:  51, rank: 'Compétiteur'  },
  { min:  31, rank: 'Athlète'      },
  { min:  11, rank: 'Initié'       },
  { min:   1, rank: 'Novice'       },
];

function getRankForLevel(level) {
  const match = RANK_THRESHOLDS.find((t) => level >= t.min);
  return match ? match.rank : 'Novice';
}

/**
 * Ajoute un item à l'inventaire en incrémentant la quantité si déjà présent.
 * Modifie le tableau en place.
 */
function addToInventory(inventory, itemType, rarity, quantity = 1) {
  const existing = inventory.find((i) => i.itemType === itemType);
  if (existing) {
    existing.quantity += quantity;
  } else {
    inventory.push({ itemType, rarity, quantity });
  }
}

/**
 * Consomme `quantity` unités d'un item dans l'inventaire.
 * Supprime l'entrée si la quantité tombe à 0.
 * Retourne false si l'item est introuvable ou en quantité insuffisante.
 */
function consumeFromInventory(inventory, itemType, quantity = 1) {
  const idx = inventory.findIndex((i) => i.itemType === itemType);
  if (idx === -1 || inventory[idx].quantity < quantity) return false;
  inventory[idx].quantity -= quantity;
  if (inventory[idx].quantity === 0) inventory.splice(idx, 1);
  return true;
}

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
    const user = await User.findById(req.user.id);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    if (user.level < MIN_LEVEL_FOR_CHEST) {
      return next(createError("Fonctionnalité bloquée jusqu'au niveau 11.", 403));
    }

    const hasKey = user.inventory.some((i) => i.itemType === 'CHEST_KEY' && i.quantity > 0);
    if (!hasKey) {
      return next(createError('Aucun coffre disponible dans votre inventaire.', 400));
    }

    consumeFromInventory(user.inventory, 'CHEST_KEY');

    const drawnItem = drawChestItem();
    addToInventory(user.inventory, drawnItem.itemType, drawnItem.rarity);

    // markModified nécessaire : Mongoose ne détecte pas les mutations des tableaux de sous-documents
    user.markModified('inventory');
    await user.save();

    return res.status(200).json({
      success:   true,
      message:   'Coffre ouvert !',
      drawnItem,
      inventory: user.inventory,
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

    const user = await User.findById(req.user.id);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    const consumed = consumeFromInventory(user.inventory, itemType);
    if (!consumed) {
      return next(createError('Vous ne possédez pas cet objet.', 400));
    }

    ITEM_EFFECTS[itemType](user);

    user.markModified('inventory');
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Objet utilisé avec succès.",
      user: {
        xp:         user.xp,
        level:      user.level,
        rank:       user.rank,
        streakGels: user.streakGels,
        inventory:  user.inventory,
      },
    });
  } catch (err) {
    next(err);
  }
};
