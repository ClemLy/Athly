import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../../constants/theme';

// ─── BirthdayConfetti ─────────────────────────────────────────────────────────
// Pluie de confettis en surimpression pour la modale d'anniversaire.
// Même approche que EmberParticles.js (Animated + useNativeDriver), mais joue
// une seule fois (pas de boucle) quand `active` passe à true.

const { height: SCREEN_H } = Dimensions.get('window');
const CONFETTI_COUNT = 32;
const PALETTE = [Colors.rankViolet, Colors.gold, Colors.primary, Colors.success, Colors.legendAccent];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default function BirthdayConfetti({ active = false }) {
  const pieces = useRef(
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      fall:     new Animated.Value(-40),
      spin:     new Animated.Value(0),
      opacity:  new Animated.Value(0),
      leftPct:  Math.random() * 100,
      size:     randomBetween(6, 12),
      color:    PALETTE[i % PALETTE.length],
      square:   Math.random() > 0.5,
      duration: randomBetween(2600, 4200),
      delay:    randomBetween(0, 900),
    })),
  ).current;

  useEffect(() => {
    if (!active) {
      pieces.forEach((p) => {
        p.fall.setValue(-40);
        p.spin.setValue(0);
        p.opacity.setValue(0);
      });
      return;
    }

    const animations = pieces.map((p) => {
      p.fall.setValue(-40);
      p.spin.setValue(0);
      p.opacity.setValue(0);
      return Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.fall, { toValue: SCREEN_H + 40, duration: p.duration, useNativeDriver: true }),
          Animated.timing(p.spin, { toValue: 1, duration: p.duration, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 1, duration: Math.max(p.duration - 700, 0), useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0, duration: 450, useNativeDriver: true }),
          ]),
        ]),
      ]);
    });

    Animated.parallel(animations).start();

    return () => animations.forEach((a) => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        const rotate = p.spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '900deg'] });
        return (
          <Animated.View
            key={i}
            style={{
              position:     'absolute',
              top:          0,
              left:         `${p.leftPct}%`,
              width:        p.size,
              height:       p.square ? p.size : p.size * 1.6,
              borderRadius: p.square ? 2 : p.size / 2,
              backgroundColor: p.color,
              opacity:      p.opacity,
              transform:    [{ translateY: p.fall }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
