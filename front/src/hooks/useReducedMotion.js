import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// ─── Préférence système "Réduire les animations" ──────────────────────────────
// iOS, Android et navigateurs (prefers-reduced-motion) : quand elle est active,
// les animations en boucle (pulsations, reflets, particules) sont coupées et
// les entrées deviennent de simples fondus.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setReduced(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduced;
}
