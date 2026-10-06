import { useCallback, useMemo } from 'react';
import { useWorkoutInProgress } from '../context/WorkoutInProgressContext';
import { useWorkoutLogs } from '../context/WorkoutLogsContext';
import { aggregateExercise } from '../services';
import { haptics } from '../services';

// ─── useSetLogging ────────────────────────────────────────────────────────────
// Saisie des séries d'un exercice de la séance en cours, partagée par l'écran
// d'exercice et la vue « Tout afficher ». Ajoute la mémoire de la dernière
// séance sur cet exercice :
//   - previousFor(i)  → la série i de la dernière fois (« 35 × 10 ») ;
//   - toggle(i)       → valider une série reprend la dernière performance pour
//                       chaque champ resté vide (un geste pour refaire pareil) ;
//   - suggestion      → charge conseillée (progression ou consolidation).

const toNum = (v) => (typeof v === 'number' ? v : Number(v) || 0);

export default function useSetLogging(exerciseIndex, exercise) {
  const { actions } = useWorkoutInProgress();
  const { sessionLogs } = useWorkoutLogs();

  const sets = useMemo(() => (exercise && Array.isArray(exercise.sets) ? exercise.sets : []), [exercise]);

  const history = useMemo(
    () => (exercise && exercise.name ? aggregateExercise(sessionLogs, { name: exercise.name }) : null),
    [sessionLogs, exercise?.name],
  );

  // Séries réellement faites la dernière fois (les séries non validées sont ignorées).
  const previous = useMemo(() => {
    const last = history?.lastSession;
    if (!last || !Array.isArray(last.sets)) return [];
    return last.sets
      .filter((s) => s && s.completed && (toNum(s.weight) > 0 || toNum(s.reps) > 0))
      .map((s) => ({ weight: toNum(s.weight), reps: toNum(s.reps) }));
  }, [history]);

  // Série i de la dernière fois ; au-delà, on reprend la dernière série faite.
  const previousFor = useCallback((i) => {
    if (previous.length === 0) return null;
    return previous[Math.min(i, previous.length - 1)];
  }, [previous]);

  const change = useCallback((i, patch) => {
    if (exerciseIndex < 0) return;
    const cur = sets[i] || {};
    const weight = patch.weight !== undefined ? patch.weight : cur.weight;
    const reps = patch.reps !== undefined ? patch.reps : cur.reps;
    actions.updateSet(exerciseIndex, i, { weight: toNum(weight), reps: toNum(reps) });
  }, [actions, exerciseIndex, sets]);

  // Renvoie true si la série vient d'être validée (utile pour lancer le repos).
  const toggle = useCallback((i) => {
    if (exerciseIndex < 0) return false;
    const cur = sets[i] || {};
    const completing = !cur.completed;
    // Chaque champ laissé vide reprend la valeur de la dernière fois.
    if (completing && (!toNum(cur.weight) || !toNum(cur.reps))) {
      const prev = previousFor(i);
      if (prev) {
        actions.updateSet(exerciseIndex, i, {
          weight: toNum(cur.weight) || prev.weight,
          reps: toNum(cur.reps) || prev.reps,
        });
      }
    }
    actions.toggleSet(exerciseIndex, i);
    return completing;
  }, [actions, exerciseIndex, sets, previousFor]);

  const usePrevious = useCallback((i) => {
    const prev = previousFor(i);
    if (!prev || exerciseIndex < 0 || sets[i]?.completed) return;
    haptics.selection();
    actions.updateSet(exerciseIndex, i, prev);
  }, [actions, exerciseIndex, sets, previousFor]);

  const addSet = useCallback(() => {
    if (exerciseIndex < 0) return;
    haptics.selection();
    actions.addSet(exerciseIndex);
  }, [actions, exerciseIndex]);

  // On ne retire que la dernière série, et seulement si elle n'est pas validée :
  // impossible d'effacer par erreur une série déjà faite.
  const canRemoveLast = sets.length > 1 && !sets[sets.length - 1]?.completed;
  const removeLast = useCallback(() => {
    if (exerciseIndex < 0 || !canRemoveLast) return;
    haptics.selection();
    actions.removeSet(exerciseIndex, sets.length - 1);
  }, [actions, exerciseIndex, canRemoveLast, sets.length]);

  const completedCount = sets.filter((s) => s && s.completed).length;

  return {
    sets,
    completedCount,
    previous,
    previousFor,
    hasHistory: previous.length > 0,
    lastDate: history?.lastSession?.date || null,
    suggestion: history?.suggestedNext || null,
    change,
    toggle,
    usePrevious,
    addSet,
    removeLast,
    canRemoveLast,
  };
}
