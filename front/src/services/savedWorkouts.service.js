import AsyncStorage from '@react-native-async-storage/async-storage';

// CRUD des séances sauvegardées (favorites / réutilisables).
// Schéma :
//   { id, name, description, exercises[], createdAt, updatedAt }

const STORAGE_KEY = 'athly:savedWorkouts:v1';

function genId() {
  return `sw-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function writeAll(items) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Renvoie les exos "épurés" pour stockage en MODÈLE : on conserve la structure
// (name, muscles, equipment) ET les reps cibles éventuelles (utiles pour les séances
// manuelles), mais on remet weight/completed à zéro pour repartir propre à chaque
// instantiation.
function sanitizeExercises(exercises) {
  if (!Array.isArray(exercises)) return [];
  return exercises.map((ex) => {
    const setsArr = Array.isArray(ex.sets) && ex.sets.length > 0 ? ex.sets : [{}, {}, {}, {}];
    return {
      ...ex,
      sets: setsArr.map((s) => ({
        reps: Number(s && s.reps) || 0,
        weight: 0,
        completed: false,
      })),
      notes: '',
      groupId: null,
    };
  });
}

export async function listSavedWorkouts() {
  return readAll();
}

export async function saveWorkout(input) {
  const all = await readAll();
  const now = Date.now();
  const item = {
    id: genId(),
    name: String(input.name || 'Séance').trim() || 'Séance',
    description: String(input.description || '').trim(),
    exercises: sanitizeExercises(input.exercises),
    isManual: !!input.isManual,
    createdAt: now,
    updatedAt: now,
  };
  if (item.exercises.length === 0) throw new Error('La séance doit contenir au moins un exercice');
  const next = [item, ...all];
  await writeAll(next);
  return item;
}

export async function updateSavedWorkout(id, patch) {
  const all = await readAll();
  const idx = all.findIndex((x) => x.id === id);
  if (idx < 0) throw new Error('Séance introuvable');
  const updated = {
    ...all[idx],
    ...patch,
    name: patch.name !== undefined ? String(patch.name).trim() : all[idx].name,
    description: patch.description !== undefined ? String(patch.description).trim() : all[idx].description,
    exercises: patch.exercises !== undefined ? sanitizeExercises(patch.exercises) : all[idx].exercises,
    updatedAt: Date.now(),
  };
  const next = [...all];
  next[idx] = updated;
  await writeAll(next);
  return updated;
}

export async function removeSavedWorkout(id) {
  const all = await readAll();
  await writeAll(all.filter((x) => x.id !== id));
}

export async function clearSavedWorkouts() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// Construit un workout instanciable depuis une séance sauvegardée.
// Les sets sont remis à vide → le user repart sur un modèle propre.
export function instantiateSavedWorkout(saved) {
  if (!saved) return null;
  return {
    name: saved.name,
    description: saved.description || '',
    exercises: sanitizeExercises(saved.exercises),
    notes: '',
    status: 'in_progress',
    durationSeconds: 0,
  };
}
