import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUBMUSCLE_TO_GROUP, normalizeId } from '../constants/exerciseFilters';

// CRUD des exercices personnalisés. Persiste dans AsyncStorage sous une clé dédiée.
// Schéma d'un exo :
//   {
//     id, name,
//     targetMuscleGroup ('pectoraux' | 'dos' | …),    // dérivé de targetMuscle
//     targetMuscle (string, libellé du sous-muscle),
//     secondaryMuscles (string[] de sous-muscles),
//     equipment (string[]),
//     level,
//     isMachine, isFreeWeight,                          // dérivés de l'équipement
//     videoUrl, notes, isCustom: true,
//     createdAt, updatedAt,
//   }

const STORAGE_KEY = 'athly:customExercises:v1';

function deriveGroup(targetMuscle) {
  return SUBMUSCLE_TO_GROUP[normalizeId(targetMuscle || '')] || '';
}

function deriveEquipFlags(equipment) {
  const eqIds = (Array.isArray(equipment) ? equipment : []).map(normalizeId);
  return {
    isMachine: eqIds.some((e) => e === 'machine' || e === 'cable'),
    isFreeWeight: eqIds.some((e) => e === 'barre' || e === 'halteres' || e === 'poids-du-corps'),
  };
}

// Cohérent avec exerciseCatalog.js : un exo perso est "compound" si son groupe est
// poly-articulaire ET qu'il a >=2 muscles secondaires (sauf override explicite).
const COMPOUND_GROUPS = ['pectoraux', 'dos', 'jambes', 'epaules'];
function deriveCompound(group, secondaryMuscles, override) {
  if (typeof override === 'boolean') return override;
  const secCount = Array.isArray(secondaryMuscles) ? secondaryMuscles.length : 0;
  return secCount >= 2 && COMPOUND_GROUPS.includes(group);
}

function genId() {
  return `cx-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
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

export async function listCustomExercises() {
  return readAll();
}

export async function addCustomExercise(input) {
  const all = await readAll();
  const now = Date.now();
  const equipment = Array.isArray(input.equipment)
    ? input.equipment.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const targetMuscle = String(input.targetMuscle || '').trim();
  const targetMuscleGroup = input.targetMuscleGroup || deriveGroup(targetMuscle);
  const secondaryMuscles = Array.isArray(input.secondaryMuscles)
    ? input.secondaryMuscles.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const item = {
    id: genId(),
    name: String(input.name || '').trim(),
    targetMuscleGroup,
    targetMuscle,
    secondaryMuscles,
    equipment,
    level: input.level || '',
    ...deriveEquipFlags(equipment),
    isCompound: deriveCompound(targetMuscleGroup, secondaryMuscles, input.isCompound),
    videoUrl: String(input.videoUrl || '').trim(),
    notes: String(input.notes || '').trim(),
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  };
  if (!item.name) throw new Error('Le nom est requis');
  if (!item.targetMuscle) throw new Error('Le muscle principal est requis');
  const next = [item, ...all];
  await writeAll(next);
  return item;
}

export async function updateCustomExercise(id, patch) {
  const all = await readAll();
  const idx = all.findIndex((x) => x.id === id);
  if (idx < 0) throw new Error('Exercice introuvable');
  const equipment = Array.isArray(patch.equipment)
    ? patch.equipment.map((s) => String(s).trim()).filter(Boolean)
    : all[idx].equipment;
  const targetMuscle = patch.targetMuscle !== undefined
    ? String(patch.targetMuscle).trim()
    : all[idx].targetMuscle;
  const targetMuscleGroup = patch.targetMuscleGroup || deriveGroup(targetMuscle);
  const secondaryMuscles = Array.isArray(patch.secondaryMuscles)
    ? patch.secondaryMuscles.map((s) => String(s).trim()).filter(Boolean)
    : all[idx].secondaryMuscles;
  const updated = {
    ...all[idx],
    ...patch,
    name: patch.name !== undefined ? String(patch.name).trim() : all[idx].name,
    targetMuscle,
    targetMuscleGroup,
    secondaryMuscles,
    equipment,
    ...deriveEquipFlags(equipment),
    isCompound: deriveCompound(targetMuscleGroup, secondaryMuscles, patch.isCompound),
    isCustom: true,
    updatedAt: Date.now(),
  };
  if (!updated.name) throw new Error('Le nom est requis');
  if (!updated.targetMuscle) throw new Error('Le muscle principal est requis');
  const next = [...all];
  next[idx] = updated;
  await writeAll(next);
  return updated;
}

export async function removeCustomExercise(id) {
  const all = await readAll();
  const next = all.filter((x) => x.id !== id);
  await writeAll(next);
}

export async function clearCustomExercises() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
