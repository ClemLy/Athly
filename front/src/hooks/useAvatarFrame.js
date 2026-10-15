import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateEquippedFrame } from '../services/profile.service';

const SHAPE_KEY = 'athly:avatarShape:v1';
const COLOR_KEY = 'athly:avatarColor:v1';
const DEFAULT = { shapeId: 'circle', colorId: 'none' };

// État partagé entre tous les écrans : un cadre équipé depuis l'inventaire
// apparaît aussitôt sur le profil (avant, chaque écran gardait sa propre copie
// lue au montage, et le changement ne se voyait qu'au redémarrage).
let shared = DEFAULT;
const listeners = new Set();

function publish(next) {
  shared = next;
  listeners.forEach((l) => l(next));
}

// Relu depuis le stockage quand le premier écran abonné apparaît (démarrage,
// ou reconnexion avec un autre compte : les clés sont propres à chaque compte).
function loadFromStorage() {
  Promise.all([AsyncStorage.getItem(SHAPE_KEY), AsyncStorage.getItem(COLOR_KEY)])
    .then(([shape, color]) => publish({ shapeId: shape || DEFAULT.shapeId, colorId: color || DEFAULT.colorId }))
    .catch(() => {});
}

export function useAvatarFrame() {
  const [frame, setFrame] = useState(shared);

  useEffect(() => {
    const first = listeners.size === 0;
    listeners.add(setFrame);
    if (first) loadFromStorage(); else setFrame(shared);
    return () => { listeners.delete(setFrame); };
  }, []);

  // Fire-and-forget : la synchro backend ne doit jamais bloquer/casser
  // l'affichage local (source de vérité pour soi-même).
  const select = useCallback(async (patch, key, value) => {
    const next = { ...shared, ...patch };
    publish(next);
    try { await AsyncStorage.setItem(key, value); } catch (e) {}
    updateEquippedFrame(next.shapeId, next.colorId).catch(() => {});
  }, []);

  const selectShape = useCallback((id) => select({ shapeId: id }, SHAPE_KEY, id), [select]);
  const selectColor = useCallback((id) => select({ colorId: id }, COLOR_KEY, id), [select]);

  return { shapeId: frame.shapeId, colorId: frame.colorId, selectShape, selectColor };
}
