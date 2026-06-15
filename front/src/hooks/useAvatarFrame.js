import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHAPE_KEY = 'athly:avatarShape:v1';
const COLOR_KEY = 'athly:avatarColor:v1';

export function useAvatarFrame() {
  const [shapeId, setShapeId] = useState('circle');
  const [colorId, setColorId] = useState('none');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SHAPE_KEY),
      AsyncStorage.getItem(COLOR_KEY),
    ]).then(([shape, color]) => {
      if (shape) setShapeId(shape);
      if (color) setColorId(color);
    }).catch(() => {});
  }, []);

  const selectShape = useCallback(async (id) => {
    setShapeId(id);
    try { await AsyncStorage.setItem(SHAPE_KEY, id); } catch (e) {}
  }, []);

  const selectColor = useCallback(async (id) => {
    setColorId(id);
    try { await AsyncStorage.setItem(COLOR_KEY, id); } catch (e) {}
  }, []);

  return { shapeId, colorId, selectShape, selectColor };
}
