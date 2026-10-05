// ─── Formats d'affichage partagés ─────────────────────────────────────────────

// Espace fine insécable entre milliers (typographie française), jamais coupée
const nf = new Intl.NumberFormat('fr-FR');
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** 950 → "950", 12 500 → "12 500" */
export function formatNumber(n) {
  return nf.format(Math.round(Number(n) || 0));
}

/**
 * Charge ou volume, compact pour tenir dans les petites cartes :
 *   850 → "850 kg", 9 850 → "9 850 kg", 13 300 → "13,3 t", 1 250 000 → "1 250 t"
 */
export function formatWeight(kg) {
  const v = Number(kg) || 0;
  if (Math.abs(v) < 10000) return `${nf.format(Math.round(v))} kg`;
  const t = v / 1000;
  return `${t >= 100 ? nf.format(Math.round(t)) : nf1.format(t)} t`;
}

/** Accord simple : plural(1, 'jour') → "1 jour", plural(3, 'jour') → "3 jours" */
export function plural(n, singular, pluralForm = `${singular}s`) {
  return `${n} ${Math.abs(n) >= 2 ? pluralForm : singular}`;
}

/** Variante sans le nombre : pluralWord(3, 'jour') → "jours" */
export function pluralWord(n, singular, pluralForm = `${singular}s`) {
  return Math.abs(n) >= 2 ? pluralForm : singular;
}
