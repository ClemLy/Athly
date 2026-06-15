import React, { useEffect, useRef } from 'react';
import { Image, Animated, Easing, StyleSheet } from 'react-native';

// Référentiel officiel des assets
// type='full'  + color='orange' → logo-orange.png            (logo complet, couleur principale)
// type='full'  + color='violet' → logo-violet.png            (logo complet, gamification)
// type='icon'  + color='orange' → minimalist-logo-orange.png (icône "A" seule)
// type='icon'  + color='violet' → minimalist-logo-violet.png (icône "A" seule)
const SOURCES = {
  full: {
    orange: require('../../../assets/logo-orange.png'),
    violet: require('../../../assets/logo-violet.png'),
  },
  icon: {
    orange: require('../../../assets/minimalist-logo-orange.png'),
    violet: require('../../../assets/minimalist-logo-violet.png'),
  },
};

// Props :
//   type     — 'full' (logo complet texte+icône) | 'icon' (icône "A" seule)
//   color    — 'orange' | 'violet'
//   width    — largeur explicite pour type="full" (défaut 180)
//   height   — hauteur explicite pour type="full" (défaut : width × 0.67)
//   size     — taille carrée pour type="icon" (défaut 40)
//   animate  — FadeInUp au montage (AuthScreen)
//   pulse    — respiration légère en boucle (états de chargement)
//   style    — styles de positionnement uniquement (margin, alignSelf…)
export default function AthlyLogo({
  type = 'full',
  color = 'orange',
  width = 180,
  height,
  size = 40,
  animate = false,
  pulse = false,
  style,
}) {
  const opacity    = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animate ? 14 : 0)).current;
  const scale      = useRef(new Animated.Value(1)).current;

  // FadeInUp — déclenché une seule fois au montage
  useEffect(() => {
    if (!animate) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 520, delay: 80,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 520, delay: 80,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Pulse loop — activé/désactivé par la prop `pulse`
  useEffect(() => {
    if (!pulse) { scale.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.07, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const source = (SOURCES[type] || SOURCES.full)[color] || SOURCES.full.orange;

  const bounds =
    type === 'icon'
      ? { width: size, height: size }
      : { width, height: height ?? Math.round(width * 0.67) };

  return (
    <Animated.View
      style={[
        bounds,
        { opacity, transform: [{ translateY }, { scale }] },
        style,
      ]}
    >
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        accessible
        accessibilityLabel="Logo Athly"
      />
    </Animated.View>
  );
}
