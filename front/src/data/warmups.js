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
