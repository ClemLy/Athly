'use strict';

const { xpForLevel, levelFromXP } = require('../utils/levelHelpers');

// ─────────────────────────────────────────────────────────────────────────────
// xpForLevel — valeurs de référence et comportement aux limites
// ─────────────────────────────────────────────────────────────────────────────
describe('xpForLevel', () => {
  it('niveau 0 → 0 XP', () => {
    expect(xpForLevel(0)).toBe(0);
  });

  it('niveau 1 → ~140 XP', () => {
    // 4665 * (1.03^1 - 1) = 4665 * 0.03 ≈ 139.95 → 140
    expect(xpForLevel(1)).toBe(140);
  });

  it('niveau 10 → ~1 604 XP', () => {
    // valeur de référence issue du commentaire dans levelHelpers.js
    const xp = xpForLevel(10);
    expect(xp).toBeGreaterThan(1_500);
    expect(xp).toBeLessThan(1_800);
  });

  it('niveau 100 → ~85 000 XP (objectif de calibration)', () => {
    const xp = xpForLevel(100);
    // tolérance ±5 000 XP autour de la valeur cible
    expect(xp).toBeGreaterThan(80_000);
    expect(xp).toBeLessThan(90_000);
  });

  it('niveau 200 (max) → ~1 720 000 XP', () => {
    const xp = xpForLevel(200);
    expect(xp).toBeGreaterThan(1_600_000);
    expect(xp).toBeLessThan(1_900_000);
  });

  it('niveau > 200 est plafonné à xpForLevel(200)', () => {
    expect(xpForLevel(201)).toBe(xpForLevel(200));
    expect(xpForLevel(999)).toBe(xpForLevel(200));
  });

  it('valeurs négatives → 0 XP', () => {
    expect(xpForLevel(-1)).toBe(0);
    expect(xpForLevel(-100)).toBe(0);
  });

  it('la courbe est strictement croissante de 1 à 200', () => {
    for (let n = 1; n < 200; n++) {
      expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// levelFromXP — cohérence et arrondis
// ─────────────────────────────────────────────────────────────────────────────
describe('levelFromXP', () => {
  it('0 XP → niveau 0', () => {
    expect(levelFromXP(0)).toBe(0);
  });

  it('XP négatif → niveau 0', () => {
    expect(levelFromXP(-500)).toBe(0);
    expect(levelFromXP(NaN)).toBe(0);
    expect(levelFromXP(null)).toBe(0);
    expect(levelFromXP(undefined)).toBe(0);
  });

  it('1 XP → niveau 0 (en-dessous du seuil du niveau 1)', () => {
    expect(levelFromXP(1)).toBe(0);
  });

  // ── Cohérence bijective : levelFromXP( xpForLevel(n) ) === n ─────────────
  const niveauxCles = [1, 5, 10, 25, 50, 75, 100, 150, 200];

  test.each(niveauxCles)(
    'levelFromXP( xpForLevel(%i) ) === %i',
    (n) => {
      expect(levelFromXP(xpForLevel(n))).toBe(n);
    },
  );

  it('1 XP de plus que le seuil d\'un niveau → ce niveau', () => {
    // Le seuil exact donne le niveau ; 1 XP de plus aussi
    const seuil = xpForLevel(10);
    expect(levelFromXP(seuil)).toBe(10);
    expect(levelFromXP(seuil + 1)).toBe(10);
  });

  it('1 XP de moins que le seuil → niveau inférieur', () => {
    const seuil = xpForLevel(10);
    expect(levelFromXP(seuil - 1)).toBe(9);
  });

  it('XP > xpForLevel(200) → plafonné au niveau 200', () => {
    const beyond = xpForLevel(200) + 1_000_000;
    expect(levelFromXP(beyond)).toBe(200);
  });

  // ── Exemple concret du rapport ────────────────────────────────────────────
  it('~85 000 XP → niveau 100 (objectif de calibration)', () => {
    expect(levelFromXP(85_000)).toBe(100);
  });
});
