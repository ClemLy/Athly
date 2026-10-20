import { ROUTINES, WARMUP_DRILLS } from './calisthenics';
import { catalogEntryFor, isCalisthenics } from './exerciseCatalog';
import { resolveMuscleGroup } from '../constants/exerciseFilters';

// ─── Choix de l'échauffement selon la séance ──────────────────────────────────
// Salle : cardio léger, mobilité puis séries d'approche. Calisthénie : haut du
// corps et poignets, bas du corps, ou complet selon les exercices prévus.

const UPPER = new Set(['pectoraux', 'dos', 'epaules', 'bras']);

export function suggestRoutine(exercises = []) {
  const list = Array.isArray(exercises) ? exercises : [];
  if (!list.length) return ROUTINES.base;
  const entries = list.map((ex) => catalogEntryFor(ex) || ex);
  const gym = entries.filter((e) => !isCalisthenics(e)).length;
  if (gym > entries.length / 2) return ROUTINES.salle;
  let upper = 0; let lower = 0;
  entries.forEach((e) => {
    const g = e.targetMuscleGroup || resolveMuscleGroup(e.targetMuscle);
    if (UPPER.has(g)) upper += 1;
    else if (g === 'jambes') lower += 1;
  });
  if (upper && !lower) return ROUTINES.haut;
  if (lower && !upper) return ROUTINES.bas;
  const beginner = entries.every((e) => !e.level || e.level === 'debutant');
  return beginner ? ROUTINES.base : ROUTINES.complet;
}

// Durée d'un mouvement en secondes (répétitions ≈ 3 s, les deux côtés comptés)
export function drillSeconds(drill) {
  const sides = drill.perSide ? 2 : 1;
  const base = drill.seconds ? drill.seconds : (drill.reps || 8) * 3;
  return base * sides;
}

export function routineMinutes(routine) {
  const total = routine.drills.reduce((s, id) => s + drillSeconds(WARMUP_DRILLS[id]) + 8, 0);
  return Math.max(2, Math.round(total / 60));
}

export const drillsOf = (routine) => routine.drills.map((id) => WARMUP_DRILLS[id]).filter(Boolean);
export const WARMUP_ROUTINES = Object.values(ROUTINES).filter((r) => r.kind === 'warmup');
export const COOLDOWN = ROUTINES.calme;

// ─── Échauffement sur mesure d'une séance ─────────────────────────────────────
// Une séance enregistrée peut porter son propre échauffement : une liste de
// mouvements (ids de WARMUP_DRILLS), proposée selon les muscles travaillés puis
// modifiable. Au lancement, elle remplace la routine conseillée.

export const CUSTOM_ROUTINE_ID = 'perso';
export const MAX_PLAN_DRILLS = 12;

// Mouvements qui préparent chaque groupe musculaire, du plus utile au moins utile
const DRILLS_BY_GROUP = {
  pectoraux: ['pompes-scapula', 'cercles-bras', 'dislocations', 'ecartes-elastique'],
  dos: ['chat-vache', 'suspension-active', 'glisses-mur', 'fil-aiguille'],
  epaules: ['cercles-epaules', 'cercles-bras', 'dislocations', 'glisses-mur'],
  bras: ['poignets', 'cercles-bras', 'ecartes-elastique'],
  jambes: ['balances-jambe', 'squat-profond', 'cercles-bassin', 'fente-basse', 'montees-pointes'],
  abdos: ['chat-vache', 'livre-ouvert', 'cercles-bassin'],
};

/** Groupes musculaires travaillés (ids), les plus présents d'abord. */
export function groupsOfExercises(exercises = []) {
  const counts = {};
  (Array.isArray(exercises) ? exercises : []).forEach((ex) => {
    const e = catalogEntryFor(ex) || ex || {};
    const g = e.targetMuscleGroup || resolveMuscleGroup(e.targetMuscle || ex?.targetMuscle);
    if (g) counts[g] = (counts[g] || 0) + 1;
  });
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
}

/** Même chose depuis des sous-muscles choisis (écran de création). */
export function groupsOfSubMuscles(subMuscles = []) {
  const seen = [];
  subMuscles.forEach((m) => {
    const g = resolveMuscleGroup(m);
    if (g && !seen.includes(g)) seen.push(g);
  });
  return seen;
}

/**
 * Échauffement conseillé : un peu de cardio, un ou deux mouvements par groupe
 * travaillé, puis la montée en charge (séries d'approche en salle, série légère
 * en calisthénie). Court : 5 à 9 mouvements.
 */
export function suggestDrillIds(groups = [], { cali = false } = {}) {
  const ids = ['marche-sur-place'];
  const known = groups.filter((g) => DRILLS_BY_GROUP[g]);
  const perGroup = known.length <= 2 ? 3 : known.length === 3 ? 2 : 1;
  known.forEach((g) => {
    DRILLS_BY_GROUP[g].slice(0, perGroup).forEach((id) => { if (!ids.includes(id)) ids.push(id); });
  });
  if (known.length === 0) ids.push('chat-vache', 'cercles-epaules', 'cercles-bassin');
  ids.push(cali ? 'serie-legere' : 'series-approche');
  return ids.slice(0, MAX_PLAN_DRILLS);
}

/** Nettoie une liste reçue (ids inconnus ou en double retirés). */
export function cleanPlan(plan) {
  const list = Array.isArray(plan) ? plan : [];
  const out = [];
  list.forEach((id) => { if (WARMUP_DRILLS[id] && !out.includes(id)) out.push(id); });
  return out.slice(0, MAX_PLAN_DRILLS);
}

/** Routine utilisable par le guide pas à pas, à partir d'une liste de mouvements. */
export function routineFromPlan(plan) {
  const drills = cleanPlan(plan);
  if (!drills.length) return null;
  return {
    id: CUSTOM_ROUTINE_ID, title: 'Ton échauffement', kind: 'warmup',
    about: 'L’échauffement que tu as préparé pour cette séance.',
    drills,
  };
}

// Mouvements qu'on peut ajouter à un échauffement (le retour au calme est à part)
const COOLDOWN_IDS = new Set(ROUTINES.calme.drills);
export const PICKABLE_DRILLS = Object.values(WARMUP_DRILLS).filter((d) => !COOLDOWN_IDS.has(d.id));
