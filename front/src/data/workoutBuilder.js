// ─── Aide à la création d'une séance sur-mesure ───────────────────────────────
// Logique pure (testée) de l'écran WorkoutBuilder : préréglages en un geste,
// sélection par groupe, remplacement d'un exercice de l'aperçu.

import { MUSCLE_GROUPS } from '../constants/exerciseFilters';
import { filterCatalog, getCombinedCatalog } from './exerciseCatalog';

const group = (id) => MUSCLE_GROUPS.find((g) => g.id === id);
const subsOf = (id) => (group(id) ? group(id).subMuscles.map((s) => s.label) : []);

// Chaque préréglage = liste de sous-muscles (labels).
export const PRESETS = [
  { id: 'push', label: 'Push', hint: 'Pecs, épaules, triceps',
    subMuscles: [...subsOf('pectoraux'), ...subsOf('epaules'), 'Triceps'] },
  { id: 'pull', label: 'Pull', hint: 'Dos, biceps',
    subMuscles: [...subsOf('dos'), 'Biceps'] },
  { id: 'legs', label: 'Jambes', hint: 'Quadriceps, ischios, fessiers, mollets',
    subMuscles: subsOf('jambes') },
  { id: 'upper', label: 'Haut du corps', hint: 'Pecs, dos, épaules, bras',
    subMuscles: ['pectoraux', 'dos', 'epaules', 'bras'].flatMap(subsOf) },
  { id: 'full', label: 'Full body', hint: 'Tout le corps',
    subMuscles: MUSCLE_GROUPS.flatMap((g) => g.subMuscles.map((s) => s.label)) },
];

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export function activePresetId(selected) {
  const hit = PRESETS.find((p) => sameSet(p.subMuscles, selected));
  return hit ? hit.id : null;
}

// État d'un groupe dans la sélection : 'none' | 'partial' | 'all' (+ compteurs).
export function groupState(groupId, selected) {
  const subs = subsOf(groupId);
  const n = subs.filter((l) => selected.includes(l)).length;
  return { state: n === 0 ? 'none' : n === subs.length ? 'all' : 'partial', count: n, total: subs.length };
}

// Appui sur un groupe : tout sélectionner, ou tout retirer s'il est complet.
export function toggleGroup(groupId, selected) {
  const subs = subsOf(groupId);
  if (groupState(groupId, selected).state === 'all') return selected.filter((l) => !subs.includes(l));
  return Array.from(new Set([...selected, ...subs]));
}

// Remplace l'exercice `index` par un autre qui respecte les mêmes critères.
// Préfère le même muscle principal ; renvoie null s'il n'y a rien d'autre.
export function swapExercise(exercises, index, criteria, customExercises = [], rnd = Math.random) {
  const current = exercises[index];
  if (!current) return null;
  const used = new Set(exercises.map((e) => e.id));
  const pool = filterCatalog(getCombinedCatalog(customExercises), criteria).filter((e) => !used.has(e.id));
  if (pool.length === 0) return null;
  const same = pool.filter((e) => e.targetMuscle === current.targetMuscle);
  const from = same.length > 0 ? same : pool;
  const pick = from[Math.floor(rnd() * from.length)];
  return { ...pick, sets: current.sets.map(() => ({})), notes: '', groupId: null };
}
