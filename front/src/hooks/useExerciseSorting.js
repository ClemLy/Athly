import { useMemo } from 'react';
import { normalizeId } from '../constants/exerciseFilters';

// Filtre/trie une liste d'exercices selon les critères { muscles, levels, equipment }.
// Retourne un nouveau tableau (réf stable via useMemo si les inputs ne changent pas).
export default function useExerciseSorting(exercises = [], filters = {}) {
  const muscles = Array.isArray(filters.muscles) ? filters.muscles : [];
  const levels = Array.isArray(filters.levels) ? filters.levels : [];
  const equipment = Array.isArray(filters.equipment) ? filters.equipment : [];

  return useMemo(() => {
    if (!Array.isArray(exercises)) return [];
    if (muscles.length === 0 && levels.length === 0 && equipment.length === 0) {
      return exercises;
    }
    return exercises.filter((ex) => {
      if (!ex) return false;
      // Muscle (principal + secondaires)
      if (muscles.length > 0) {
        const candidates = [];
        if (ex.targetMuscle) candidates.push(ex.targetMuscle);
        if (ex.muscle) candidates.push(ex.muscle);
        if (Array.isArray(ex.muscles)) candidates.push(...ex.muscles);
        if (Array.isArray(ex.secondaryMuscles)) candidates.push(...ex.secondaryMuscles);
        const ids = candidates.map(normalizeId);
        if (!ids.some((id) => muscles.includes(id))) return false;
      }
      // Niveau
      if (levels.length > 0) {
        const lvl = normalizeId(ex.level || ex.difficulty || '');
        if (!levels.includes(lvl)) return false;
      }
      // Matériel
      if (equipment.length > 0) {
        const list = Array.isArray(ex.equipment)
          ? ex.equipment
          : (ex.equipment ? [ex.equipment] : []);
        const ids = list.map(normalizeId);
        if (!ids.some((id) => equipment.includes(id))) return false;
      }
      return true;
    });
  }, [exercises, muscles.join('|'), levels.join('|'), equipment.join('|')]);
}

// Indique si au moins un filtre est actif.
export function isFiltering(filters = {}) {
  const m = Array.isArray(filters.muscles) ? filters.muscles.length : 0;
  const l = Array.isArray(filters.levels) ? filters.levels.length : 0;
  const e = Array.isArray(filters.equipment) ? filters.equipment.length : 0;
  return m + l + e > 0;
}
