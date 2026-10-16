import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// ─── Écran de démarrage ───────────────────────────────────────────────────────
// Réplique exacte de l'écran HTML de public/index.html (logo + barre qui
// glisse) : sur le web, React prend le relais sans saut visuel ; sur iOS et
// Android, il suit l'écran de lancement natif avec le même logo.

const BAR_W = 120;
const SEG_W = BAR_W * 0.4;
const LOGO  = require('../../../assets/boot-logo.png');

export default function BootScreen() {
  const reduced = useReducedMotion();
  const slide = useRef(new Animated.Value(0)).current;
  // Sur le web, l'écran HTML a déjà joué l'entrée du logo : pas de deuxième fois.
  const enter = useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 420, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true,
    }).start();
    if (reduced) return undefined;
    const loop = Animated.loop(Animated.timing(slide, {
      toValue: 1, duration: 1100, easing: Easing.bezier(0.65, 0, 0.35, 1), useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [reduced, slide, enter]);

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-SEG_W, BAR_W] });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <View
      style={s.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement d'Athly"
      accessibilityState={{ busy: true }}
    >
      <Animated.Image source={LOGO} style={[s.logo, { opacity: enter, transform: [{ scale }] }]} />
      <View style={s.track}>
        <Animated.View
          style={[s.segment, reduced ? s.segmentStill : { transform: [{ translateX }] }]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    backgroundColor: Colors.backgroundDeep,
  },
  logo: { width: 88, height: 88, borderRadius: 22 },
  track: {
    width: BAR_W,
    height: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  segment: { width: SEG_W, height: 3, borderRadius: 3, backgroundColor: Colors.primary },
  segmentStill: { marginLeft: (BAR_W - SEG_W) / 2 },
});
