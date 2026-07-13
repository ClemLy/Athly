import API from '../api/api';

// ─── Cycle de vie des séances côté backend ────────────────────────────────────
// Draft (auto-save pendant la séance) → finalize (calcul XP/records serveur)
// → complete (marquage léger fire-and-forget). Consommé par useWorkoutState
// (draft/finalize) et WorkoutScreen (complete) — les écrans et hooks ne
// touchent jamais l'API brute directement.

// Crée le brouillon serveur de la séance en cours (première sauvegarde).
export async function createWorkoutDraft({ name, exercises, notes }) {
  const res = await API.post('/workouts/draft', {
    name, exercises, notes, status: 'draft',
  });
  const data = res && res.data ? res.data : res;
  return data && data.workout ? data.workout : null;
}

// Met à jour le brouillon serveur existant (auto-save débouncé).
export async function updateWorkoutDraft(id, { exercises, notes, durationSeconds }) {
  const res = await API.patch(`/workouts/${id}/draft`, {
    exercises, notes, durationSeconds,
  });
  const data = res && res.data ? res.data : res;
  return data && data.workout ? data.workout : data;
}

// Finalise la séance : le backend recalcule XP, records et stats (anti-cheat).
export async function finalizeWorkout(id, payload) {
  const res = await API.post(`/workouts/${id}/finalize`, payload);
  return res && res.data ? res.data : res;
}

// Marque la séance comme terminée — best-effort, jamais bloquant.
export function completeWorkout(id) {
  return API.post(`/workouts/${id}/complete`);
}
