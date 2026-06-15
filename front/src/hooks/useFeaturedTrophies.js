import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FEATURED_KEY = 'athly:pref:featuredTrophies:v1';
export const MAX_FEATURED = 3;

export function useFeaturedTrophies() {
  const [featuredIds, setFeaturedIds] = useState([]);

  const reload = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(FEATURED_KEY);
      setFeaturedIds(raw ? JSON.parse(raw) : []);
    } catch (_) {}
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const toggleFeatured = useCallback((trophyId) => {
    setFeaturedIds((prev) => {
      let next;
      if (prev.includes(trophyId)) {
        next = prev.filter((id) => id !== trophyId);
      } else if (prev.length < MAX_FEATURED) {
        next = [...prev, trophyId];
      } else {
        // FIFO : remplace le plus ancien
        next = [...prev.slice(1), trophyId];
      }
      AsyncStorage.setItem(FEATURED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isFeatured = useCallback((id) => featuredIds.includes(id), [featuredIds]);

  return { featuredIds, toggleFeatured, isFeatured, reload, MAX_FEATURED };
}
