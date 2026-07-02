import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { checkBirthday } from '../../services/reward.service';
import BirthdayModal from './BirthdayModal';

const SHOWN_KEY = 'athly:birthday:shown_date:v1';

function todayKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
}

// ─── BirthdayCelebration ──────────────────────────────────────────────────────
// À monter une fois dans l'arbre authentifié (AppNavigator). Vérifie au
// démarrage si c'est le jour d'anniversaire de l'utilisateur et affiche la
// modale festive + confettis (BirthdayModal). Dédupliqué par jour via
// AsyncStorage pour ne pas rejouer l'animation à chaque changement d'écran —
// seulement une fois par ouverture de l'app le jour J.

export default function BirthdayCelebration() {
  const { userToken } = useAuth();
  const [state, setState] = useState({ visible: false, pseudo: null, rewarded: false });

  useEffect(() => {
    if (!userToken) return;

    (async () => {
      try {
        const already = await AsyncStorage.getItem(SHOWN_KEY);
        if (already === todayKey()) return;

        const res = await checkBirthday();
        if (!res?.isBirthday) return;

        await AsyncStorage.setItem(SHOWN_KEY, todayKey());
        setState({ visible: true, pseudo: res.pseudo || null, rewarded: !!res.rewarded });
      } catch (_) {
        // Silencieux : ne doit jamais bloquer le démarrage de l'app.
      }
    })();
  }, [userToken]);

  const handleClose = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  if (!state.visible) return null;

  return (
    <BirthdayModal
      visible={state.visible}
      pseudo={state.pseudo}
      rewarded={state.rewarded}
      onClose={handleClose}
    />
  );
}
