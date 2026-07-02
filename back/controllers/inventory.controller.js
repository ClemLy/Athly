'use strict';

const User              = require('../models/User');
const { drawChestItem } = require('../services/chest.service');
const { consumeItemAtomic, addItemAtomic, purgeEmptyEntries } = require('../services/inventory.service');

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
 * Consomme atomiquement 1 unité d'un item.
 *
 * Anti race-condition (double-spend) : le filtre conditionnel garantit que le
 * décrément n'a lieu que si la quantité est encore >= 1 AU MOMENT de l'écriture.
 * Deux requêtes simultanées sur la dernière unité : une seule matche le filtre,
 * l'autre reçoit null — impossible de dépenser deux fois le même objet.
 *
 * @returns Le document User APRÈS décrément, ou null si non possédé
 *          (ou si extraFilter ne matche pas).
 */
async function consumeItemAtomic(userId, itemType, extraFilter = {}) {
  return User.findOneAndUpdate(
    {
      _id: userId,
      inventory: { $elemMatch: { itemType, quantity: { $gte: 1 } } },
      ...extraFilter,
    },
    { $inc: { 'inventory.$[elem].quantity': -1 } },
    {
      returnDocument: 'after',
      arrayFilters: [{ 'elem.itemType': itemType }],
    },
  );
}

/**
 * Ajoute atomiquement 1 unité d'un item ($inc si l'entrée existe, sinon $push
 * gardé par $ne pour éviter un double-push concurrent).
 * @returns Le document User APRÈS ajout.
 */
async function addItemAtomic(userId, itemType, rarity) {
  const incremented = await User.findOneAndUpdate(
    { _id: userId, 'inventory.itemType': itemType },
    { $inc: { 'inventory.$.quantity': 1 } },
    { returnDocument: 'after' },
  );
  if (incremented) return incremented;

  const pushed = await User.findOneAndUpdate(
    { _id: userId, 'inventory.itemType': { $ne: itemType } },
    { $push: { inventory: { itemType, rarity, quantity: 1 } } },
    { returnDocument: 'after' },
  );
  if (pushed) return pushed;

  // Course perdue contre un $push concurrent du même itemType : on retombe
  // sur le $inc, qui matche forcément maintenant.
  return User.findOneAndUpdate(
    { _id: userId, 'inventory.itemType': itemType },
    { $inc: { 'inventory.$.quantity': 1 } },
    { returnDocument: 'after' },
  );
}

/**
 * Purge les entrées d'inventaire tombées à 0 (comportement historique :
 * une entrée épuisée disparaît de l'inventaire).
 * @returns Le document User APRÈS purge.
 */
async function purgeEmptyEntries(userId) {
  return User.findOneAndUpdate(
    { _id: userId },
    { $pull: { inventory: { quantity: { $lte: 0 } } } },
    { returnDocument: 'after' },
  );
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
