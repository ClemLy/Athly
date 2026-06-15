import React, { createContext, useContext, useCallback, useMemo } from 'react';
import useWorkoutState from '../hooks/useWorkoutState';
import { useWorkoutLogs } from './WorkoutLogsContext';
import { useQuests } from './QuestContext';
import { buildLogFromWorkout, findNewPRsInLog } from '../services/stats.service';

// Context global pour la séance en cours.
// Centralise useWorkoutState : tous les écrans consomment le même état + actions
// sans passer via les nav params.
//
// Wrappe également `actions.finalize` :
//   1. Construit un log local (toujours, même offline)
//   2. Persiste dans WorkoutLogsContext (AsyncStorage)
//   3. Tente la sync backend (best-effort, ne bloque pas)
//   4. Renvoie les stats locales calculées (compatibles avec l'UI existante)

const WorkoutInProgressContext = createContext(null);

export function WorkoutInProgressProvider({ children }) {
  const bundle = useWorkoutState({});
  const workoutLogs = useWorkoutLogs();
  const questContext = useQuests();

  const loadWorkout = useCallback((workout) => {
    if (!workout) return;
    bundle.dispatch({
      type: 'SET_WORKOUT',
      payload: {
        id: workout._id || workout.id || null,
        user: workout.user || null,
        name: workout.name || 'Séance',
        exercises: Array.isArray(workout.exercises) ? workout.exercises : [],
        notes: workout.notes || '',
        status: workout.status || 'in_progress',
        durationSeconds: workout.durationSeconds || 0,
      },
    });
  }, [bundle.dispatch]);

  const addExerciseToWorkout = useCallback((exercise) => {
    if (!exercise) return;
    bundle.dispatch({
      type: 'ADD_EXERCISE',
      payload: { exercise },
    });
  }, [bundle.dispatch]);

  // Wrapper de finalize : log local AVANT tentative serveur. Même si le serveur échoue,
  // l'utilisateur voit ses stats et l'historique est préservé.
  // Renvoie aussi le `log` complet et la liste des `newPRs` battus dans cette séance,
  // pour alimenter directement le WorkoutRecapModal.
  const finalizeWithLog = useCallback(async (options = {}) => {
    const stateSnapshot = bundle.state;
    const log = buildLogFromWorkout({
      ...stateSnapshot,
      notes: (options && options.notes) || stateSnapshot.notes || '',
      durationSeconds: (options && options.durationSeconds != null)
        ? options.durationSeconds
        : (stateSnapshot.durationSeconds || 0),
    }, workoutLogs.items); // prevLogs pour calcul streak + multiplicateur XP

    // Anti-cheat 5 min : séance forcée trop courte → 0 XP + flag shortSession
    if (options && options.shortSession) {
      log.xpEarned = 0;
      log.shortSession = true;
    }

    // Détection des PRs battus AVANT que le log ne soit ajouté à l'historique.
    // findNewPRsInLog filtre par id, donc passer [...prev, log] ou prev marche pareil.
    const previousLogs = workoutLogs.items;
    const newPRs = findNewPRsInLog(log, [...previousLogs, log]);

    // 1. Persistance locale (synchronisée avec UI via context)
    let savedLog = log;
    try {
      savedLog = await workoutLogs.create(log);
    } catch (e) {
      // Si AsyncStorage casse on continue : l'utilisateur ne doit pas être bloqué.
    }

    // Détecte si l'anti-cheat quotidien a annulé l'XP (max 2 séances XP/jour).
    const dailyCapReached = log.xpEarned > 0 && savedLog.xpEarned === 0;

    // 2. Vérification des quêtes quotidiennes (best-effort, ne bloque pas)
    // Les séances trop courtes (shortSession) ne valident aucune quête.
    let completedQuests = [];
    let bonusUnlocked = false;
    let questXP = 0;
    if (!savedLog.shortSession) {
      try {
        const questResult = await questContext.checkAndUpdateQuests(savedLog, newPRs);
        completedQuests = questResult.completedQuests || [];
        bonusUnlocked   = questResult.bonusUnlocked   || false;
        questXP         = questResult.questXP         || 0;
      } catch (_) {}
    }

    // 3. Sync serveur best-effort (ne renvoie pas son erreur — le local est sauvé)
    try {
      await bundle.actions.finalize(options);
    } catch (e) {
      // Backend KO → on ignore, on a le local.
    }

    return {
      totalVolume: savedLog.totalVolume,
      setsCompleted: savedLog.setsCompleted,
      xp: savedLog.xpEarned,
      questXP,
      completedQuests,
      bonusUnlocked,
      durationSeconds: savedLog.durationSeconds,
      log: savedLog,
      newPRs,
      dailyCapReached,
    };
  }, [bundle.state, bundle.actions, workoutLogs, questContext]);

  const value = useMemo(() => ({
    ...bundle,
    actions: {
      ...bundle.actions,
      finalize: finalizeWithLog,
    },
    loadWorkout,
    addExerciseToWorkout,
  }), [bundle, finalizeWithLog, loadWorkout, addExerciseToWorkout]);

  return (
    <WorkoutInProgressContext.Provider value={value}>
      {children}
    </WorkoutInProgressContext.Provider>
  );
}

export function useWorkoutInProgress() {
  const ctx = useContext(WorkoutInProgressContext);
  if (!ctx) {
    throw new Error('useWorkoutInProgress must be used inside <WorkoutInProgressProvider>');
  }
  return ctx;
}
