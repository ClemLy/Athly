import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { listLogs, addLog, removeLog, totalCumulativeXP, addRitualLog, addBonusXpLog } from '../services/stats.service';

// Context global pour l'historique des séances finalisées (logs).
// Source de vérité unique pour StatsScreen, ExerciseStatsScreen, ProfileScreen.

const WorkoutLogsContext = createContext(null);

export function WorkoutLogsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listLogs();
      setItems(list);
    } catch (e) {
      setError(e && e.message ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (log) => {
    const item = await addLog(log);
    // Insertion en tête (logs triés par date desc)
    setItems((prev) => [item, ...prev]);
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
    setItems((prev) => [item, ...prev]);
    return item;
  }, []);

  // Synchronise l'XP/niveau affiché localement (Profil, Accueil) avec un gain
  // accordé côté backend hors séance : objet d'inventaire consommé, bonus de
  // streak de groupe... Voir addBonusXpLog (stats.service.js).
  const addBonusXp = useCallback(async (source, xpEarned) => {
    const item = await addBonusXpLog(source, xpEarned);
    if (!item) return null;
    setItems((prev) => [item, ...prev]);
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
