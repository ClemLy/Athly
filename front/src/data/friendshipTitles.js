// Titres de Relation (Titres d'Amitié) — cosmétique textuel affiché sous le
// niveau d'amitié entre deux amis. Purement déclaratif côté front : le niveau
// d'amitié (1-5) est calculé par le backend (voir groupStreak.controller.js
// → computeFriendshipLevel), ce fichier ne fait que le traduire en libellé.

export const FRIENDSHIP_TITLES = {
  1: { label: 'Nouveaux Partenaires' },
  2: { label: 'Assisteurs de Confiance' },
  3: { label: 'Frères de Fonte' },
  4: { label: 'Rivaux Légendaires' },
  5: { label: 'Âmes Sœurs de Muscle' },
};

/** Renvoie { label } pour un niveau d'amitié donné (1-5, clampé). */
export function getFriendshipTitle(level) {
  const clamped = Math.min(5, Math.max(1, Number(level) || 1));
  return FRIENDSHIP_TITLES[clamped];
}
