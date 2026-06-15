// Liste des exos "phares" affichés dans la section Records Personnels du Profil.
// Le matching se fait par `name` via aggregateExercise() — case + accents tolérants
// (cf. normalizeId).
//
// Ordre = ordre d'affichage (priorité visuelle décroissante).
// Garde la liste courte (6-8 exos max) pour préserver la lisibilité du profil.

export const MAJOR_EXERCISES = [
  { name: 'Développé couché', group: 'pectoraux', icon: 'barbell-outline' },
  { name: 'Squat', group: 'jambes', icon: 'barbell-outline' },
  { name: 'Soulevé de terre', group: 'dos', icon: 'barbell-outline' },
  { name: 'Tractions', group: 'dos', icon: 'arrow-up-outline' },
  { name: 'Développé militaire', group: 'epaules', icon: 'barbell-outline' },
  { name: 'Rowing barre', group: 'dos', icon: 'barbell-outline' },
  { name: 'Curl barre', group: 'bras', icon: 'fitness-outline' },
];

// Helper : retourne l'exo majeur correspondant à un nom donné (matching tolérant).
// Utilisé pour afficher l'icône / groupe dans le profil quand on a des PRs.
export function findMajorExerciseByName(name) {
  if (!name) return null;
  const target = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return MAJOR_EXERCISES.find((m) => {
    const k = String(m.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    return k === target;
  }) || null;
}
