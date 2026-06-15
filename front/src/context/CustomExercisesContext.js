import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  listCustomExercises,
  addCustomExercise,
  updateCustomExercise,
  removeCustomExercise,
} from '../services/customExercises.service';

// Context global pour les exercices personnalisés.
// - Charge la liste depuis AsyncStorage au montage
// - Expose addExercise / updateExercise / removeExercise / refresh
// - Met à jour l'état local immédiatement après chaque action (UI réactive)

const CustomExercisesContext = createContext(null);

export function CustomExercisesProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listCustomExercises();
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
    const item = await addCustomExercise(input);
    setItems((prev) => [item, ...prev]);
    return item;
  }, []);

  const update = useCallback(async (id, patch) => {
    const item = await updateCustomExercise(id, patch);
    setItems((prev) => prev.map((x) => (x.id === id ? item : x)));
    return item;
  }, []);

  const remove = useCallback(async (id) => {
    await removeCustomExercise(id);
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
    <CustomExercisesContext.Provider value={value}>
      {children}
    </CustomExercisesContext.Provider>
  );
}

export function useCustomExercises() {
  const ctx = useContext(CustomExercisesContext);
  if (!ctx) {
    throw new Error('useCustomExercises must be used inside <CustomExercisesProvider>');
  }
  return ctx;
}
