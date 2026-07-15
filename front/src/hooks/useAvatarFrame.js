import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateEquippedFrame } from '../services/profile.service';

const SHAPE_KEY = 'athly:avatarShape:v1';
const COLOR_KEY = 'athly:avatarColor:v1';

export function useAvatarFrame() {
  const [shapeId, setShapeId] = useState('circle');
  const [colorId, setColorId] = useState('none');
  // Toujours à jour de façon synchrone (contrairement au state React) pour
  // envoyer la paire {shapeId, colorId} complète au backend, même quand un
  // seul des deux vient de changer.
  const latest = useRef({ shapeId: 'circle', colorId: 'none' });

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SHAPE_KEY),
      AsyncStorage.getItem(COLOR_KEY),
    ]).then(([shape, color]) => {
      if (shape) setShapeId(shape);
      if (color) setColorId(color);
      latest.current = { shapeId: shape || 'circle', colorId: color || 'none' };
    }).catch(() => {});
  }, []);

  // Fire-and-forget : la synchro backend ne doit jamais bloquer/casser
  // l'affichage local (source de vérité pour soi-même).
  const syncBackend = useCallback((next) => {
    latest.current = next;
    updateEquippedFrame(next.shapeId, next.colorId).catch(() => {});
  }, []);

  const selectShape = useCallback(async (id) => {
    setShapeId(id);
    try { await AsyncStorage.setItem(SHAPE_KEY, id); } catch (e) {}
    syncBackend({ ...latest.current, shapeId: id });
  }, [syncBackend]);

  const selectColor = useCallback(async (id) => {
    setColorId(id);
    try { await AsyncStorage.setItem(COLOR_KEY, id); } catch (e) {}
    syncBackend({ ...latest.current, colorId: id });
  }, [syncBackend]);

  return { shapeId, colorId, selectShape, selectColor };
}
