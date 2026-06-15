import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  listSavedWorkouts,
  saveWorkout,
  updateSavedWorkout,
  removeSavedWorkout,
} from '../services/savedWorkouts.service';

// Context global pour les séances sauvegardées (favoris / réutilisables).
// Chargement initial depuis AsyncStorage, mise à jour optimiste après chaque action.

const SavedWorkoutsContext = createContext(null);

export function SavedWorkoutsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listSavedWorkouts();
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

  const create = useCallback(async (input) => {
    const item = await saveWorkout(input);
    setItems((prev) => [item, ...prev]);
    return item;
  }, []);

  const update = useCallback(async (id, patch) => {
    const item = await updateSavedWorkout(id, patch);
    setItems((prev) => prev.map((x) => (x.id === id ? item : x)));
    return item;
  }, []);

  const remove = useCallback(async (id) => {
    await removeSavedWorkout(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ items, loading, error, refresh, create, update, remove, clearAll }),
    [items, loading, error, refresh, create, update, remove, clearAll],
  );

  return (
    <SavedWorkoutsContext.Provider value={value}>
      {children}
    </SavedWorkoutsContext.Provider>
  );
}

export function useSavedWorkouts() {
  const ctx = useContext(SavedWorkoutsContext);
  if (!ctx) {
    throw new Error('useSavedWorkouts must be used inside <SavedWorkoutsProvider>');
  }
  return ctx;
}
