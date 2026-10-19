import { catalogEntryFor } from './exerciseCatalog';
import { getExerciseDemo } from './exerciseMedia';
import { primaryMuscleLabel } from '../constants/exerciseFilters';
import { plural } from '../utils/format';

// ─── Détail d'une séance avant lancement ──────────────────────────────────────
// Ce que montre WorkoutPreviewSheet : pour chaque exercice, les séries et la
// fourchette visée, le muscle, le niveau (calisthénie) et la démonstration ;
// pour la séance, le matériel nécessaire et une durée estimée.

const NO_GEAR = new Set(['poids du corps', 'aucun', '']);

/**
 * Durée estimée d'une séance : 2 minutes par série, repos compris, plus la
 * mise en route. Même calcul sur la carte, le détail et l'écran de séance.
 * @param {object[]|number} exercises — exercices (avec leurs séries) ou nombre de séries
 */
export function estimateMinutes(exercises) {
  const sets = typeof exercises === 'number'
    ? exercises
    : exercises.reduce((n, ex) => n + (ex.sets?.length || 0), 0);
  if (!sets) return 0;
  return Math.max(10, Math.round((sets * 2 + 5) / 5) * 5);
}

/** « Faite il y a 3 j » pour la dernière fois qu'une séance a été faite. */
export function lastDoneLabel(date, now = Date.now()) {
  if (!date) return null;
  const days = Math.round((now - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "Faite aujourd'hui";
  if (days === 1) return 'Faite hier';
  return `Faite il y a ${days} j`;
}

/** Résumé d'un exercice : « 3 × 8 à 12 réps », muscle, niveau, matériel, démo. */
export function describeExercise(ex) {
  const entry = catalogEntryFor(ex) || {};
  const sets = ex.sets?.length || 0;
  const target = ex.target || entry.target;
  const tracking = ex.tracking || entry.tracking;
  const unit = tracking === 'time' ? 's' : 'réps';
  const side = (ex.unilateral ?? entry.unilateral) ? ' par côté' : '';
  const equipment = ex.equipment || entry.equipment || [];
  return {
    plan: target ? `${sets} × ${target[0]} à ${target[1]} ${unit}${side}` : plural(sets, 'série'),
    muscle: primaryMuscleLabel(ex) || primaryMuscleLabel(entry),
    level: entry.family ? entry.level : null,
    equipment: Array.isArray(equipment) ? equipment : [equipment],
    demo: getExerciseDemo(ex),
  };
}

/**
 * Détail complet d'une séance.
 * @param {object[]} exercises — exercices instanciés (avec leurs séries vides)
 */
export function buildPreview(exercises) {
  const infos = exercises.map(describeExercise);
  const gear = [...new Set(infos.flatMap((i) => i.equipment).filter((g) => !NO_GEAR.has(String(g || '').toLowerCase())))];
  const sets = exercises.reduce((n, ex) => n + (ex.sets?.length || 0), 0);
  return { exercises, infos, gear, sets, minutes: estimateMinutes(exercises) };
}
