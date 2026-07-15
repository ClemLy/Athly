'use strict';

const User = require('../models/User');

// ─── Opérations d'inventaire atomiques ────────────────────────────────────────
// Toutes les écritures passent par findOneAndUpdate conditionnel : aucune
// fenêtre de race condition (double-spend, double-octroi) possible.

/**
 * Consomme atomiquement 1 unité d'un item.
 * Le filtre garantit que le décrément n'a lieu que si la quantité est encore
 * >= 1 au moment de l'écriture. Deux requêtes simultanées sur la dernière
 * unité : une seule matche, l'autre reçoit null.
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
 * Ajoute atomiquement `quantity` unités d'un item ($inc si l'entrée existe,
 * sinon $push gardé par $ne pour éviter un double-push concurrent).
 * @returns Le document User APRÈS ajout.
 */
async function addItemAtomic(userId, itemType, rarity, quantity = 1) {
  const incremented = await User.findOneAndUpdate(
    { _id: userId, 'inventory.itemType': itemType },
    { $inc: { 'inventory.$.quantity': quantity } },
    { returnDocument: 'after' },
  );
  if (incremented) return incremented;

  const pushed = await User.findOneAndUpdate(
    { _id: userId, 'inventory.itemType': { $ne: itemType } },
    { $push: { inventory: { itemType, rarity, quantity } } },
    { returnDocument: 'after' },
  );
  if (pushed) return pushed;

  // Course perdue contre un $push concurrent du même itemType : on retombe
  // sur le $inc, qui matche forcément maintenant.
  return User.findOneAndUpdate(
    { _id: userId, 'inventory.itemType': itemType },
    { $inc: { 'inventory.$.quantity': quantity } },
    { returnDocument: 'after' },
  );
}

/**
 * Ajoute un item UNIQUEMENT s'il n'est pas déjà possédé (jamais de doublon).
 * Utilisé pour les récompenses uniques (cosmétiques niveau 5 d'amitié).
 * @returns Le document User si l'item vient d'être ajouté, null s'il existait déjà.
 */
async function addUniqueItemOnce(userId, itemType, rarity) {
  return User.findOneAndUpdate(
    { _id: userId, 'inventory.itemType': { $ne: itemType } },
    { $push: { inventory: { itemType, rarity, quantity: 1 } } },
    { returnDocument: 'after' },
  );
}

/**
 * Purge les entrées d'inventaire tombées à 0 (une entrée épuisée disparaît).
 * @returns Le document User APRÈS purge.
 */
async function purgeEmptyEntries(userId) {
  return User.findOneAndUpdate(
    { _id: userId },
    { $pull: { inventory: { quantity: { $lte: 0 } } } },
    { returnDocument: 'after' },
  );
}

module.exports = { consumeItemAtomic, addItemAtomic, addUniqueItemOnce, purgeEmptyEntries };
