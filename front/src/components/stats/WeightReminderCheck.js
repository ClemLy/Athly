import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { getWeightHistory } from '../../services';
import WeightReminderModal from './WeightReminderModal';
import WeightEntryModal from '../common/WeightEntryModal';

const DISMISSED_AT_KEY = 'athly:weight:reminder:dismissed_at:v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ─── WeightReminderCheck ──────────────────────────────────────────────────────
// À monter une fois dans l'arbre authentifié (AppNavigator), au même niveau
// que BirthdayCelebration / ActivityFeedModal. Vérifie au démarrage si la
// dernière pesée enregistrée date de plus de 7 jours et, si oui, propose la
// modale de rappel — sauf si l'utilisateur a déjà cliqué "Plus tard" au
// cours des 7 derniers jours (pas de spam avant la semaine suivante).

export default function WeightReminderCheck() {
  const { userToken } = useAuth();
  const [reminderVisible, setReminderVisible] = useState(false);
  const [entryVisible, setEntryVisible]       = useState(false);

  useEffect(() => {
    if (!userToken) return;
    (async () => {
      try {
        const dismissedAtRaw = await AsyncStorage.getItem(DISMISSED_AT_KEY);
        if (dismissedAtRaw) {
          const elapsed = Date.now() - new Date(dismissedAtRaw).getTime();
          if (elapsed < SEVEN_DAYS_MS) return; // déjà repoussé cette semaine
        }

        const res = await getWeightHistory();
        const history = Array.isArray(res.history) ? res.history : [];
        const lastEntry = history[history.length - 1];
        const lastWeighInAge = lastEntry ? Date.now() - new Date(lastEntry.date).getTime() : Infinity;

        if (lastWeighInAge >= SEVEN_DAYS_MS) {
          setReminderVisible(true);
        }
      } catch (_) {
        // Best-effort — ne doit jamais bloquer le démarrage de l'app.
      }
    })();
  }, [userToken]);

  const handleLater = useCallback(async () => {
    setReminderVisible(false);
    try { await AsyncStorage.setItem(DISMISSED_AT_KEY, new Date().toISOString()); } catch (_) {}
  }, []);

  const handleEnter = useCallback(() => {
    setReminderVisible(false);
    setEntryVisible(true);
  }, []);

  return (
    <>
      <WeightReminderModal visible={reminderVisible} onEnter={handleEnter} onLater={handleLater} />
      <WeightEntryModal visible={entryVisible} onClose={() => setEntryVisible(false)} />
    </>
  );
}
