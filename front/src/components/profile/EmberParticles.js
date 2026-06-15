import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

// ─── EmberParticles ───────────────────────────────────────────────────────────
// Braises ascendantes pour les rangs Légende (171+) et ATHLY GOD (200).
// 8 particules indépendantes avec positions, vitesses et couleurs aléatoirisées.
// Entièrement piloté par Animated + useNativeDriver:true.
//
// Props :
//   visible bool — active/désactive les animations
//   color   string — couleur de base des braises (#C084FC pour Légende, #FFD700 pour God)

const PARTICLE_COUNT = 8;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default function EmberParticles({ visible = false, color = '#C084FC' }) {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      y:       new Animated.Value(0),
      opacity: new Animated.Value(0),
      xOffset: randomBetween(-30, 30),
      size:    randomBetween(3, 6),
      delay:   i * 350,
      duration: randomBetween(2200, 3800),
      leftPct: 10 + (i * 11) % 80,
    })),
  ).current;

  useEffect(() => {
    if (!visible) {
      particles.forEach((p) => {
        p.y.setValue(0);
        p.opacity.setValue(0);
      });
      return;
    }

    const animations = particles.map((p) => {
      const animate = () => {
        p.y.setValue(0);
        p.opacity.setValue(0);
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.parallel([
            Animated.timing(p.y, {
              toValue: -220,
              duration: p.duration,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 0.85, duration: 300,        useNativeDriver: true }),
              Animated.timing(p.opacity, { toValue: 0,    duration: p.duration - 300, useNativeDriver: true }),
            ]),
          ]),
        ]).start(() => animate()); // boucle infinie
      };
      animate();
      return p;
    });

    return () => {
      animations.forEach((p) => {
        p.y.stopAnimation();
        p.opacity.stopAnimation();
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            bottom: 0,
            left: `${p.leftPct}%`,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: color,
            transform: [
              { translateY: p.y },
              { translateX: p.xOffset },
            ],
            opacity: p.opacity,
          }}
        />
      ))}
    </View>
  );
}
