import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { subscribeSlowRequests } from '../../api/api';

// ─── Bandeau d'état de connexion ──────────────────────────────────────────────
// Deux situations expliquées en clair, sans bloquer l'écran :
//  - hors ligne : l'app continue de fonctionner, les séances restent sur le téléphone ;
//  - serveur lent : il se réveille (hébergement gratuit), quelques secondes de patience.

function useOnline() {
  const [online, setOnline] = useState(
    Platform.OS !== 'web' || typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export default function ConnectionBanner() {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const [slow, setSlow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => subscribeSlowRequests(setSlow), []);

  const state = !online ? 'offline' : slow ? 'slow' : null;
  const [shown, setShown] = useState(state);

  useEffect(() => {
    if (state) setShown(state);
    Animated.timing(anim, {
      toValue: state ? 1 : 0,
      duration: state ? 220 : 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => { if (finished && !state) setShown(null); });
  }, [state, anim]);

  if (!shown) return null;

  const offline = shown === 'offline';
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        s.wrap,
        { top: insets.top + 8 },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        },
      ]}
    >
      <View style={[s.pill, offline ? s.pillOffline : s.pillSlow]}>
        <Ionicons
          name={offline ? 'cloud-offline-outline' : 'hourglass-outline'}
          size={15}
          color={offline ? Colors.warningAmber : Colors.textPrimary}
        />
        <Text style={s.txt} numberOfLines={2}>
          {offline
            ? 'Hors ligne : tes séances restent enregistrées sur ton téléphone.'
            : 'Le serveur démarre, encore quelques secondes…'}
        </Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 440,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  pillOffline: { backgroundColor: Colors.modalBg, borderColor: `${Colors.warningAmber}73` },
  pillSlow: { backgroundColor: Colors.modalBg, borderColor: Colors.separator },
  txt: { flexShrink: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
