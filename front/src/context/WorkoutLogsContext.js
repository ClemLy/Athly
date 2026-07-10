import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import { listLogs, addLog, removeLog, totalCumulativeXP, addRitualLog, addBonusXpLog } from '../services/stats.service';
import { syncXp, retryPendingXpSync } from '../services/xpSync.service';

// Context global pour l'historique des séances finalisées (logs).
// Source de vérité unique pour StatsScreen, ExerciseStatsScreen, ProfileScreen.

const WorkoutLogsContext = createContext(null);

export function WorkoutLogsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const appState = useRef(AppState.currentState);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listLogs();
      setItems(list);
      // Check-up de cohérence au démarrage (Section X) : pousse le total XP
      // local vers le backend, fire-and-forget — voir xpSync.service.js.
      syncXp(totalCumulativeXP(list));
    } catch (e) {
      setError(e && e.message ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Pas de détection réseau active dans ce projet (pas de NetInfo) : le retour
  // au premier plan de l'app est le proxy le plus proche de "le réseau est
  // peut-être revenu" — ne retente que si un sync précédent a échoué
  // (isXpSynced: false), pour ne pas spammer l'API à chaque changement d'onglet.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        retryPendingXpSync(totalCumulativeXP(items));
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [items]);

  const create = useCallback(async (log) => {
    const item = await addLog(log);
    // Insertion en tête (logs triés par date desc)
    let newTotal;
    setItems((prev) => {
      const next = [item, ...prev];
      newTotal = totalCumulativeXP(next);
      return next;
    });
    // Événement clé (Section X) : fin de séance (solo ou Multi) — sync fire-and-forget.
    syncXp(newTotal);
    return item;
  }, []);

  const remove = useCallback(async (id) => {
    await removeLog(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const totalXP = useMemo(() => totalCumulativeXP(items), [items]);

  // sessionLogs : séances uniquement (pas de quêtes, pas de rituels, pas de bonus) — pour l'historique.
  const sessionLogs = useMemo(
    () => items.filter((l) => l.type !== 'quest_reward' && l.type !== 'ritual' && l.type !== 'item_bonus'),
    [items],
  );

  // activityLogs : toute activité valide pour le streak (pas de quêtes, pas de bonus, pas de shortSession).
  // item_bonus (objet consommé, bonus de groupe) ne doit jamais compter comme une séance.
  const activityLogs = useMemo(
    () => items.filter((l) => l.type !== 'quest_reward' && l.type !== 'item_bonus' && !l.shortSession),
    [items],
  );

  const clearAll = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  const addRitual = useCallback(async (ritualId, ritualLabel, durationSeconds, xpEarned) => {
    const item = await addRitualLog(ritualId, ritualLabel, durationSeconds, xpEarned);
    if (!item) return null;
    let newTotal;
    setItems((prev) => {
      const next = [item, ...prev];
      newTotal = totalCumulativeXP(next);
      return next;
    });
    syncXp(newTotal);
    return item;
  }, []);

  // Synchronise l'XP/niveau affiché localement (Profil, Accueil) avec un gain
  // accordé côté backend hors séance : objet d'inventaire consommé, bonus de
  // streak de groupe... Voir addBonusXpLog (stats.service.js).
  const addBonusXp = useCallback(async (source, xpEarned) => {
    const item = await addBonusXpLog(source, xpEarned);
    if (!item) return null;
    let newTotal;
    setItems((prev) => {
      const next = [item, ...prev];
      newTotal = totalCumulativeXP(next);
      return next;
    });
    // Événement clé (Section X) : bonus XP (ex: bonus de groupe Multi) — sync fire-and-forget.
    syncXp(newTotal);
    return item;
  }, []);

  const value = useMemo(
    () => ({ items, sessionLogs, activityLogs, loading, error, refresh, create, remove, addRitual, addBonusXp, totalXP, clearAll }),
    [items, sessionLogs, activityLogs, loading, error, refresh, create, remove, addRitual, addBonusXp, totalXP, clearAll],
  );

  return (
    <WorkoutLogsContext.Provider value={value}>
      {children}
    </WorkoutLogsContext.Provider>
  );
}

export function useWorkoutLogs() {
  const ctx = useContext(WorkoutLogsContext);
  if (!ctx) {
    throw new Error('useWorkoutLogs must be used inside <WorkoutLogsProvider>');
  }
  return ctx;
}
