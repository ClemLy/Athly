'use strict';

// ── Courbe de progression exponentielle ──────────────────────────────────────
// Formule identique au front-end (stats.service.js).
//
//   xpForLevel(n)  → XP cumulatif total requis pour atteindre le niveau n
//   levelFromXP(x) → niveau correspondant à x XP cumulatifs (binary search)
//
// Repères :  L1 ≈ 140 XP  |  L10 ≈ 1 604 XP  |  L100 ≈ 85 000 XP  |  L200 ≈ 1 720 000 XP
// Objectif : niveau 100 atteignable en ~1 an avec entraînement régulier + streaks.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_LEVEL_XP = 4665;
const XP_RATE       = 1.03;
const MAX_LEVEL     = 200;

function xpForLevel(n) {
  if (n <= 0) return 0;
  return Math.round(BASE_LEVEL_XP * (Math.pow(XP_RATE, Math.min(MAX_LEVEL, n)) - 1));
}

function levelFromXP(totalXP) {
  if (!totalXP || totalXP <= 0) return 0;
  let lo = 0, hi = MAX_LEVEL, level = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (xpForLevel(mid) <= totalXP) { level = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return level;
}

module.exports = { xpForLevel, levelFromXP };
