// ─── Calculs des chronos de rituels ───────────────────────────────────────────
// Tout est dérivé du temps écoulé (en secondes) : le chrono reste juste même
// si le téléphone est verrouillé ou l'onglet mis en arrière-plan.

export const BREATH_IN = 4;
export const BREATH_OUT = 6;
export const BREATH_CYCLE = BREATH_IN + BREATH_OUT;

/** "mm:ss" à partir d'un nombre de secondes. */
export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Phase de respiration à l'instant `elapsed`.
 * @returns {{ inhale: boolean, phaseLeft: number, phaseRemaining: number, cycle: number, phaseKey: number }}
 *   phaseLeft : secondes affichées (entier) ; phaseRemaining : secondes exactes restantes ;
 *   cycle : numéro du cycle en cours (1-based) ; phaseKey : identifiant unique de la phase.
 */
export function breathPhaseAt(elapsed) {
  const t = Math.max(0, elapsed);
  const index = Math.floor(t / BREATH_CYCLE);
  const inCycle = t - index * BREATH_CYCLE;
  const inhale = inCycle < BREATH_IN;
  const phaseRemaining = (inhale ? BREATH_IN : BREATH_CYCLE) - inCycle;
  const phaseLeft = Math.max(1, Math.ceil(phaseRemaining));
  return { inhale, phaseLeft, phaseRemaining, cycle: index + 1, phaseKey: index * 2 + (inhale ? 0 : 1) };
}

/**
 * Étape en cours d'un rituel guidé (étapes de durée égale).
 * @returns {{ index: number, stepLeft: number, stepDuration: number }}
 */
export function guidedStepAt(elapsed, stepCount, totalSeconds) {
  const count = Math.max(1, stepCount);
  const stepDuration = totalSeconds / count;
  const index = Math.min(count - 1, Math.floor(Math.max(0, elapsed) / stepDuration));
  const stepLeft = Math.max(0, (index + 1) * stepDuration - elapsed);
  return { index, stepLeft, stepDuration };
}

/**
 * Couleur de texte lisible sur un fond plein `hex` (#RRGGBB) : sombre ou blanc,
 * celle qui offre le meilleur contraste (WCAG).
 */
export function readableOn(hex, dark = '#0B0B12', light = '#FFFFFF') {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return light;
  const n = parseInt(m[1], 16);
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const contrastWithLight = 1.05 / (L + 0.05);
  const contrastWithDark = (L + 0.05) / 0.0536; // luminance de #0B0B12 ≈ 0.0036
  return contrastWithDark >= contrastWithLight ? dark : light;
}
