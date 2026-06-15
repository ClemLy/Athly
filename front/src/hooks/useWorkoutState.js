import { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import API from '../api/api';

// ---------------------------------------------------------------------------
// useWorkoutState
// ---------------------------------------------------------------------------
// Source de vérité pour l'écran "séance en cours".
// Gère :
//   - les exercices et leurs sets (CRUD local)
//   - le statut superset (groupId) côté front uniquement (le backend ne le persiste pas
//     pour l'instant — décision produit : fallback front-only)
//   - le replace d'un exercice (conserve le nb de sets + reps cibles, reset poids + completed)
//   - la sauvegarde debouncée en draft (3s) et la finalisation
// ---------------------------------------------------------------------------

const ACTIONS = {
  SET_WORKOUT: 'SET_WORKOUT',
  UPDATE_SET: 'UPDATE_SET',
  TOGGLE_SET: 'TOGGLE_SET',
  ADD_SET: 'ADD_SET',
  REMOVE_SET: 'REMOVE_SET',
  UPDATE_EXERCISE_NOTES: 'UPDATE_EXERCISE_NOTES',
  ADD_EXERCISE: 'ADD_EXERCISE',
  REPLACE_EXERCISE: 'REPLACE_EXERCISE',
  REMOVE_EXERCISE: 'REMOVE_EXERCISE',
  TOGGLE_SUPERSET_WITH_NEXT: 'TOGGLE_SUPERSET_WITH_NEXT',
  UNSET_SUPERSET: 'UNSET_SUPERSET',
  MARK_FINISHED: 'MARK_FINISHED',
  MARK_EXERCISE_DONE: 'MARK_EXERCISE_DONE',
  RESET_WORKOUT: 'RESET_WORKOUT',
};

const INITIAL_STATE = {
  id: null,
  user: null,
  name: 'Séance',
  exercises: [],
  notes: '',
  status: 'in_progress',
  durationSeconds: 0,
};

function makeGroupId() {
  return `gs-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_WORKOUT:
      return { ...state, ...action.payload };

    case ACTIONS.UPDATE_SET: {
      const { exerciseIndex, setIndex, weight, reps } = action.payload;
      const exercises = [...state.exercises];
      const target = exercises[exerciseIndex];
      if (!target) return state;
      const sets = [...(target.sets || [])];
      sets[setIndex] = { ...sets[setIndex], weight, reps };
      exercises[exerciseIndex] = { ...target, sets };
      return { ...state, exercises };
    }

    case ACTIONS.TOGGLE_SET: {
      const { exerciseIndex, setIndex } = action.payload;
      const exercises = [...state.exercises];
      const target = exercises[exerciseIndex];
      if (!target) return state;
      const sets = [...(target.sets || [])];
      const s = sets[setIndex] || { weight: 0, reps: 0, completed: false };
      sets[setIndex] = {
        ...s,
        completed: !s.completed,
        timestamp: !s.completed ? new Date() : s.timestamp,
      };
      exercises[exerciseIndex] = { ...target, sets };
      return { ...state, exercises };
    }

    case ACTIONS.ADD_SET: {
      const { exerciseIndex } = action.payload;
      const exercises = [...state.exercises];
      const target = exercises[exerciseIndex];
      if (!target) return state;
      const sets = [...(target.sets || [])];
      sets.push({ weight: 0, reps: 0, completed: false });
      exercises[exerciseIndex] = { ...target, sets };
      return { ...state, exercises };
    }

    case ACTIONS.REMOVE_SET: {
      const { exerciseIndex, setIndex } = action.payload;
      const exercises = [...state.exercises];
      const target = exercises[exerciseIndex];
      if (!target) return state;
      const sets = [...(target.sets || [])];
      sets.splice(setIndex, 1);
      exercises[exerciseIndex] = { ...target, sets };
      return { ...state, exercises };
    }

    case ACTIONS.UPDATE_EXERCISE_NOTES: {
      const { exerciseIndex, notes } = action.payload;
      const exercises = [...state.exercises];
      const target = exercises[exerciseIndex];
      if (!target) return state;
      exercises[exerciseIndex] = { ...target, notes };
      return { ...state, exercises };
    }

    case ACTIONS.REPLACE_EXERCISE: {
      const { exerciseIndex, exercise } = action.payload;
      const exercises = [...state.exercises];
      const old = exercises[exerciseIndex];
      if (!old) return state;
      const oldSets = Array.isArray(old.sets) ? old.sets : [];
      // On conserve le nombre de sets et les reps cibles, on remet à zéro le poids et la complétion.
      const sets = oldSets.length > 0
        ? oldSets.map((s) => ({ weight: 0, reps: Number(s.reps) || 0, completed: false }))
        : [{ weight: 0, reps: 0, completed: false }];
      exercises[exerciseIndex] = {
        ...exercise,
        groupId: old.groupId || null,
        notes: old.notes || '',
        sets,
      };
      return { ...state, exercises };
    }

    case ACTIONS.ADD_EXERCISE: {
      const { exercise } = action.payload || {};
      if (!exercise) return state;
      const sets = Array.isArray(exercise.sets) && exercise.sets.length > 0
        ? exercise.sets
        : [{}, {}, {}, {}];
      const exercises = [
        ...state.exercises,
        { ...exercise, sets, notes: exercise.notes || '', groupId: exercise.groupId || null },
      ];
      return { ...state, exercises };
    }

    case ACTIONS.REMOVE_EXERCISE: {
      const { exerciseIndex } = action.payload;
      const exercises = [...state.exercises];
      exercises.splice(exerciseIndex, 1);
      return { ...state, exercises };
    }

    case ACTIONS.TOGGLE_SUPERSET_WITH_NEXT: {
      const { exerciseIndex } = action.payload;
      const exercises = [...state.exercises];
      const cur = exercises[exerciseIndex];
      const next = exercises[exerciseIndex + 1];
      if (!cur || !next) return state;
      const sameGroup = cur.groupId && cur.groupId === next.groupId;
      if (sameGroup) {
        // Dégroupage : on retire next du groupe ; si cur se retrouve seul, on retire son groupId aussi.
        const hasPrevInGroup = exerciseIndex > 0 && exercises[exerciseIndex - 1].groupId === cur.groupId;
        const hasFurtherInGroup = exerciseIndex + 2 < exercises.length
          && exercises[exerciseIndex + 2].groupId === cur.groupId;
        exercises[exerciseIndex + 1] = { ...next, groupId: null };
        if (!hasPrevInGroup && !hasFurtherInGroup) {
          exercises[exerciseIndex] = { ...cur, groupId: null };
        }
      } else {
        const gid = cur.groupId || makeGroupId();
        exercises[exerciseIndex] = { ...cur, groupId: gid };
        exercises[exerciseIndex + 1] = { ...next, groupId: gid };
      }
      return { ...state, exercises };
    }

    case ACTIONS.UNSET_SUPERSET: {
      const { exerciseIndex } = action.payload;
      const exercises = [...state.exercises];
      const cur = exercises[exerciseIndex];
      if (!cur || !cur.groupId) return state;
      exercises[exerciseIndex] = { ...cur, groupId: null };
      return { ...state, exercises };
    }

    case ACTIONS.MARK_FINISHED:
      return { ...state, status: 'finished' };

    case ACTIONS.MARK_EXERCISE_DONE: {
      const { exerciseIndex, done } = action.payload;
      const exercises = [...state.exercises];
      const target = exercises[exerciseIndex];
      if (!target) return state;
      exercises[exerciseIndex] = { ...target, done };
      return { ...state, exercises };
    }

    case ACTIONS.RESET_WORKOUT:
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

export default function useWorkoutState(initial = {}) {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    id: initial.id || initial._id || null,
    user: initial.user || null,
    name: initial.name || 'Séance',
    exercises: Array.isArray(initial.exercises) ? initial.exercises : [],
    notes: initial.notes || '',
    status: initial.status || 'in_progress',
    durationSeconds: initial.durationSeconds || 0,
  });

  const saveTimeout = useRef(null);
  const isSaving = useRef(false);

  const saveDraft = useCallback(async () => {
    if (isSaving.current) return null;
    isSaving.current = true;
    try {
      if (!state.id) {
        const res = await API.post('/workouts/draft', {
          name: state.name,
          exercises: state.exercises,
          notes: state.notes,
          status: 'draft',
        });
        const data = res && res.data ? res.data : res;
        const workout = data && data.workout ? data.workout : null;
        if (workout) {
          dispatch({ type: ACTIONS.SET_WORKOUT, payload: { id: workout._id } });
          return workout;
        }
        return null;
      }
      const res = await API.patch(`/workouts/${state.id}/draft`, {
        exercises: state.exercises,
        notes: state.notes,
        durationSeconds: state.durationSeconds,
      });
      const data = res && res.data ? res.data : res;
      return data && data.workout ? data.workout : data;
    } catch (error) {
      // Pas de Alert ici pour éviter le spam — on le centralise dans finalize/handler explicite.
      return null;
    } finally {
      isSaving.current = false;
    }
  }, [state]);

  const debouncedSave = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => { saveDraft(); }, 3000);
  }, [saveDraft]);

  const finalize = useCallback(async (options = {}) => {
    const saved = await saveDraft();
    const workoutId = state.id || (saved && (saved._id || saved.id));
    if (!workoutId) throw new Error('no_id');
    const res = await API.post(`/workouts/${workoutId}/finalize`, {
      exercises: state.exercises,
      notes: state.notes,
      durationSeconds: state.durationSeconds,
      ...options,
    });
    const data = res && res.data ? res.data : res;
    if (data && data.stats) {
      dispatch({ type: ACTIONS.MARK_FINISHED });
      return data.stats;
    }
    throw new Error('unexpected_response');
  }, [state, saveDraft]);

  const reset = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_WORKOUT });
  }, []);

  // Wrappers d'action
  const updateSet = useCallback((exerciseIndex, setIndex, { weight, reps }) => {
    dispatch({ type: ACTIONS.UPDATE_SET, payload: { exerciseIndex, setIndex, weight, reps } });
    debouncedSave();
  }, [debouncedSave]);

  const toggleSet = useCallback((exerciseIndex, setIndex) => {
    dispatch({ type: ACTIONS.TOGGLE_SET, payload: { exerciseIndex, setIndex } });
    debouncedSave();
  }, [debouncedSave]);

  const addSet = useCallback((exerciseIndex) => {
    dispatch({ type: ACTIONS.ADD_SET, payload: { exerciseIndex } });
    debouncedSave();
  }, [debouncedSave]);

  const removeSet = useCallback((exerciseIndex, setIndex) => {
    dispatch({ type: ACTIONS.REMOVE_SET, payload: { exerciseIndex, setIndex } });
    debouncedSave();
  }, [debouncedSave]);

  const updateExerciseNotes = useCallback((exerciseIndex, notes) => {
    dispatch({ type: ACTIONS.UPDATE_EXERCISE_NOTES, payload: { exerciseIndex, notes } });
    debouncedSave();
  }, [debouncedSave]);

  const replaceExercise = useCallback((exerciseIndex, exercise) => {
    dispatch({ type: ACTIONS.REPLACE_EXERCISE, payload: { exerciseIndex, exercise } });
    debouncedSave();
  }, [debouncedSave]);

  const addExercise = useCallback((exercise) => {
    dispatch({ type: ACTIONS.ADD_EXERCISE, payload: { exercise } });
    debouncedSave();
  }, [debouncedSave]);

  const removeExercise = useCallback((exerciseIndex) => {
    dispatch({ type: ACTIONS.REMOVE_EXERCISE, payload: { exerciseIndex } });
    debouncedSave();
  }, [debouncedSave]);

  const toggleSupersetWithNext = useCallback((exerciseIndex) => {
    dispatch({ type: ACTIONS.TOGGLE_SUPERSET_WITH_NEXT, payload: { exerciseIndex } });
    debouncedSave();
  }, [debouncedSave]);

  const unsetSuperset = useCallback((exerciseIndex) => {
    dispatch({ type: ACTIONS.UNSET_SUPERSET, payload: { exerciseIndex } });
    debouncedSave();
  }, [debouncedSave]);

  const markExerciseDone = useCallback((exerciseIndex, done) => {
    dispatch({ type: ACTIONS.MARK_EXERCISE_DONE, payload: { exerciseIndex, done } });
    debouncedSave();
  }, [debouncedSave]);

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  const stats = useMemo(() => {
    let totalVolume = 0;
    let setsCompleted = 0;
    if (Array.isArray(state.exercises)) {
      state.exercises.forEach((ex) => {
        if (!Array.isArray(ex.sets)) return;
        ex.sets.forEach((s) => {
          const w = Number(s.weight) || 0;
          const r = Number(s.reps) || 0;
          if (w && r) totalVolume += w * r;
          if (s.completed) setsCompleted += 1;
        });
      });
    }
    const xpEstimated = Math.floor(totalVolume / 100) + setsCompleted * 2;
    return { totalVolume, setsCompleted, xpEstimated };
  }, [state.exercises]);

  return {
    state,
    dispatch,
    actions: {
      updateSet,
      toggleSet,
      addSet,
      removeSet,
      updateExerciseNotes,
      replaceExercise,
      addExercise,
      removeExercise,
      toggleSupersetWithNext,
      unsetSuperset,
      markExerciseDone,
      saveDraft,
      finalize,
      reset,
    },
    stats,
  };
}
