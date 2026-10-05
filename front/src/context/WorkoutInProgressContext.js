import React, { createContext, useContext, useCallback, useMemo, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWorkoutState } from '../hooks';
import { useWorkoutLogs } from './WorkoutLogsContext';
import { useQuests } from './QuestContext';
import { buildLogFromWorkout, findNewPRsInLog } from '../services';

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

// ─── Reprise de séance ────────────────────────────────────────────────────────
// La séance en cours est sauvegardée en continu sur l'appareil. Si l'app est
// fermée en pleine séance (iOS ferme les PWA en arrière-plan, batterie vide,
// rechargement), elle peut être reprise là où elle s'était arrêtée, avec le
// bon chronomètre. Au-delà de 12 h, la sauvegarde est considérée abandonnée.
const RESUME_KEY = 'athly:workout:inprogress:v1';
const MAX_RESUME_AGE_MS = 12 * 60 * 60 * 1000;

export function WorkoutInProgressProvider({ children }) {
  const bundle = useWorkoutState({});
  const workoutLogs = useWorkoutLogs();
  const questContext = useQuests();

  const [startedAt, setStartedAt] = useState(null);
  const [lobbyId, setLobbyId] = useState(null);
  const [resumable, setResumable] = useState(null); // { state, startedAt, lobbyId, savedAt }
  const [restoreChecked, setRestoreChecked] = useState(false);
  const startedAtRef = useRef(null);
  startedAtRef.current = startedAt;

  // Lecture de la sauvegarde au lancement
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RESUME_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        const valid = saved
          && saved.state
          && Array.isArray(saved.state.exercises)
          && saved.state.exercises.length > 0
          && Date.now() - (saved.startedAt || 0) < MAX_RESUME_AGE_MS;
        if (!cancelled && valid) setResumable(saved);
        else if (raw) await AsyncStorage.removeItem(RESUME_KEY);
      } catch (_) {
        // Sauvegarde illisible : on repart proprement
      } finally {
        if (!cancelled) setRestoreChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sauvegarde continue tant qu'une séance est en cours
  useEffect(() => {
    if (!startedAt || bundle.state.status === 'finished') return undefined;
    if (!Array.isArray(bundle.state.exercises) || bundle.state.exercises.length === 0) return undefined;
    const t = setTimeout(() => {
      AsyncStorage.setItem(RESUME_KEY, JSON.stringify({
        state: bundle.state,
        startedAt,
        lobbyId,
        savedAt: Date.now(),
      })).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [bundle.state, startedAt, lobbyId]);

  const clearSaved = useCallback(() => {
    AsyncStorage.removeItem(RESUME_KEY).catch(() => {});
  }, []);

  const resumeWorkout = useCallback(() => {
    if (!resumable) return null;
    bundle.dispatch({ type: 'SET_WORKOUT', payload: resumable.state });
    setStartedAt(resumable.startedAt);
    setLobbyId(resumable.lobbyId || null);
    const info = { lobbyId: resumable.lobbyId || null };
    setResumable(null);
    return info;
  }, [resumable, bundle.dispatch]);

  const discardResumable = useCallback(() => {
    setResumable(null);
    clearSaved();
  }, [clearSaved]);

  const resetWorkout = useCallback(() => {
    bundle.actions.reset();
    setStartedAt(null);
    setLobbyId(null);
    clearSaved();
  }, [bundle.actions, clearSaved]);

  const loadWorkout = useCallback((workout, options = {}) => {
    if (!workout) return;
    // Une nouvelle séance remplace toute séance interrompue non reprise
    setResumable(null);
    setStartedAt(Date.now());
    setLobbyId(options.lobbyId || null);
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
    // La séance est enregistrée dans l'historique : plus rien à reprendre
    clearSaved();

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
  }, [bundle.state, bundle.actions, workoutLogs, questContext, clearSaved]);

  const value = useMemo(() => ({
    ...bundle,
    actions: {
      ...bundle.actions,
      finalize: finalizeWithLog,
      reset: resetWorkout,
    },
    loadWorkout,
    addExerciseToWorkout,
    startedAt,
    resumable,
    restoreChecked,
    resumeWorkout,
    discardResumable,
  }), [bundle, finalizeWithLog, resetWorkout, loadWorkout, addExerciseToWorkout,
    startedAt, resumable, restoreChecked, resumeWorkout, discardResumable]);

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
