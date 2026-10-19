import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePref } from '../services/cloudPrefs.service';

// ─── « Ma pratique » : salle, calisthénie ou les deux ─────────────────────────
// Oriente les séances proposées, le générateur et la recommandation de
// l'accueil. Partagé entre les écrans (un changement se voit partout) et
// sauvegardé dans le compte.

const KEY = 'athly:pref:practice:v1';
export const PRACTICES = [
  { id: 'salle', label: 'Salle' },
  { id: 'calisthenie', label: 'Calisthénie' },
  { id: 'mixte', label: 'Les deux' },
];

let shared = 'salle';
let loaded = false;
const listeners = new Set();
const publish = (v) => { shared = v; listeners.forEach((l) => l(v)); };

export function reloadPractice() {
  AsyncStorage.getItem(KEY)
    .then((v) => { loaded = true; publish(PRACTICES.some((p) => p.id === v) ? v : 'salle'); })
    .catch(() => {});
}

export function usePractice() {
  const [practice, setState] = useState(shared);
  useEffect(() => {
    listeners.add(setState);
    if (!loaded || listeners.size === 1) reloadPractice(); else setState(shared);
    return () => { listeners.delete(setState); };
  }, []);
  const setPractice = useCallback((id) => {
    publish(id);
    AsyncStorage.setItem(KEY, id).catch(() => {});
    savePref('practice', id).catch(() => {});
  }, []);
  return { practice, setPractice };
}
