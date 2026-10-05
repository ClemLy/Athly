import { Platform, Easing } from 'react-native';
import { CardStyleInterpolators } from '@react-navigation/stack';

// ─── Transitions d'écran ──────────────────────────────────────────────────────
// Glissement horizontal façon iOS pour toutes les piles (y compris sur la PWA,
// où React Navigation désactive les animations par défaut). Courbe ease-out
// rapide : le nouvel écran arrive vite et se pose en douceur.
// Si l'utilisateur a demandé à réduire les animations (réglage système), on
// passe à un simple fondu, plus court.

const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const slideSpec = {
  animation: 'timing',
  config: { duration: 320, easing: EASE_OUT },
};

const fadeSpec = {
  animation: 'timing',
  config: { duration: 160, easing: Easing.out(Easing.quad) },
};

export const screenTransition = prefersReducedMotion
  ? {
      animation: 'fade',
      cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
      transitionSpec: { open: fadeSpec, close: fadeSpec },
    }
  : {
      animation: 'slide_from_right',
      cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      transitionSpec: { open: slideSpec, close: slideSpec },
      gestureEnabled: Platform.OS !== 'web',
      gestureDirection: 'horizontal',
    };
