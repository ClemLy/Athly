import React, { createContext, useContext, useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// ─── Skeletons ────────────────────────────────────────────────────────────────
// Silhouette du contenu à venir pendant un chargement. Un SkeletonGroup porte
// une seule pulsation partagée par tous ses blocs (ils respirent ensemble) et
// s'annonce comme "Chargement" aux lecteurs d'écran. Sans animation quand
// "Réduire les animations" est actif.

const PulseContext = createContext(null);
const BLOCK_BG = 'rgba(255,255,255,0.07)';

export function SkeletonGroup({ children, style, label = 'Chargement' }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) { pulse.setValue(1); return undefined; }
    const ease = Easing.inOut(Easing.quad);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.45, duration: 750, easing: ease, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 750, easing: ease, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, pulse]);

  return (
    <PulseContext.Provider value={pulse}>
      <View
        style={style}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityState={{ busy: true }}
      >
        {children}
      </View>
    </PulseContext.Provider>
  );
}

// Bloc gris arrondi. `w` accepte un nombre ou un pourcentage ('60%').
export function Skeleton({ w = '100%', h = 12, r = 6, style }) {
  const pulse = useContext(PulseContext);
  return (
    <Animated.View
      style={[{ width: w, height: h, borderRadius: r, backgroundColor: BLOCK_BG }, pulse && { opacity: pulse }, style]}
    />
  );
}

// Lignes de liste : rond (avatar ou icône) + deux lignes de texte.
export function SkeletonRows({ count = 4, avatar = 40, style, label }) {
  return (
    <SkeletonGroup style={[sk.rows, style]} label={label}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={sk.row}>
          <Skeleton w={avatar} h={avatar} r={avatar / 2} />
          <View style={sk.rowText}>
            <Skeleton w={i % 2 ? '45%' : '60%'} h={13} />
            <Skeleton w={i % 2 ? '30%' : '38%'} h={10} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

const sk = StyleSheet.create({
  rows: { gap: 18, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 8 },
});
