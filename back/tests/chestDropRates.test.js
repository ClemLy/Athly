// Vérifie que les taux de drop réellement obtenus correspondent à ceux
// annoncés dans l'app (Inventaire : 60 / 25 / 12 / 3 %).
const { drawChestItem, DROP_TABLE } = require('../services/chest.service');

const ANNOUNCED = { common: 60, rare: 25, epic: 12, legendary: 3 };
const DRAWS = 200000;

describe('Taux de drop des coffres', () => {
  it('la table annonce exactement les taux affichés (somme = 100)', () => {
    const table = Object.fromEntries(DROP_TABLE.map((t) => [t.rarity, t.weight]));
    expect(table).toEqual(ANNOUNCED);
    expect(DROP_TABLE.reduce((s, t) => s + t.weight, 0)).toBe(100);
  });

  it(`${DRAWS} tirages donnent les taux annoncés (à 0,4 point près)`, () => {
    const byRarity = {};
    const byItem = {};
    for (let i = 0; i < DRAWS; i++) {
      const { itemType, rarity } = drawChestItem();
      byRarity[rarity] = (byRarity[rarity] || 0) + 1;
      byItem[itemType] = (byItem[itemType] || 0) + 1;
    }
    for (const [rarity, pct] of Object.entries(ANNOUNCED)) {
      expect(Math.abs((byRarity[rarity] / DRAWS) * 100 - pct)).toBeLessThan(0.4);
    }
    // Au sein d'une rareté, chaque objet a la même chance.
    for (const tier of DROP_TABLE) {
      const share = tier.weight / tier.items.length;
      for (const item of tier.items) {
        expect(Math.abs((byItem[item] / DRAWS) * 100 - share)).toBeLessThan(0.4);
      }
    }
  });

  it('les tirages extrêmes du générateur restent dans la table', () => {
    const spy = jest.spyOn(Math, 'random');
    spy.mockReturnValue(0);
    expect(drawChestItem().rarity).toBe('common');
    spy.mockReturnValue(0.9999999);
    expect(drawChestItem().rarity).toBe('legendary');
    spy.mockRestore();
  });
});
