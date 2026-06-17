'use strict';

// ─── Table de drop ────────────────────────────────────────────────────────────
// Poids sur 100. Les items d'une même rareté sont tirés à égalité de probabilité.

const DROP_TABLE = [
  { rarity: 'common',    weight: 60, items: ['ENERGY_DRINK'] },
  { rarity: 'rare',      weight: 25, items: ['STREAK_FREEZE', 'DOUBLE_XP'] },
  { rarity: 'epic',      weight: 12, items: ['SUPER_STREAK_FREEZE', 'TRIPLE_XP'] },
  { rarity: 'legendary', weight:  3, items: ['LEVEL_COUPON', 'QUINTUPLE_XP'] },
];

// ─── Algorithme de tirage pondéré ─────────────────────────────────────────────

/**
 * Tire un item aléatoire selon les poids de DROP_TABLE.
 * Étape 1 : tirage de la rareté (roll [0, 100)).
 * Étape 2 : tirage de l'item dans la liste de la rareté (équiprobable).
 *
 * @returns {{ itemType: string, rarity: string }}
 */
function drawChestItem() {
  const roll = Math.random() * 100;
  let cursor = 0;

  for (const tier of DROP_TABLE) {
    cursor += tier.weight;
    if (roll < cursor) {
      const itemType = tier.items[Math.floor(Math.random() * tier.items.length)];
      return { itemType, rarity: tier.rarity };
    }
  }

  // Fallback théoriquement impossible (somme des poids = 100)
  return { itemType: 'ENERGY_DRINK', rarity: 'common' };
}

module.exports = { drawChestItem, DROP_TABLE };
