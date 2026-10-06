import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing,
  ActivityIndicator, AccessibilityInfo,
} from 'react-native';
import { Colors } from '../../constants/theme';
import { haptics } from '../../services';
import { FrameStage, getColorDef, getShapeDef } from '../profile/AvatarFrame';

// ─── Briques partagées des écrans d'authentification ─────────────────────────
// Mouvement utile uniquement : entrée échelonnée (une fois, au montage),
// retour tactile du bouton, secousse sur erreur. Tout se coupe si l'appareil
// demande de réduire les animations.

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

// Entrée échelonnée : chaque bloc monte de 14 px en fondu, 70 ms d'écart.
export function useEntrance(count) {
  const values = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(70, values.map((v) => Animated.timing(v, {
      toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }))).start();
  }, [values]);
  return values.map((v) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  }));
}

// Secousse horizontale amortie (refus d'identifiants, champs invalides).
export function useShake() {
  const x = useRef(new Animated.Value(0)).current;
  const shake = () => {
    x.setValue(0);
    Animated.sequence([8, -7, 5, -3, 0].map((toValue) => Animated.timing(x, {
      toValue, duration: 55, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }))).start();
  };
  return [{ transform: [{ translateX: x }] }, shake];
}

// Bouton principal : s'enfonce légèrement sous le doigt (ressort), vibration
// de sélection, état de chargement qui garde la largeur du bouton.
export function PrimaryButton({ label, onPress, loading = false, disabled = false, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: v === 1 ? 6 : 0, useNativeDriver: true }).start();
  const inactive = loading || disabled;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={() => { haptics.selection(); onPress?.(); }}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: loading, disabled: inactive }}
        style={[s.primary, disabled && !loading && s.primaryDisabled]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>{label}</Text>}
      </Pressable>
    </Animated.View>
  );
}

// ─── Vitrine des cadres (écran de connexion) ─────────────────────────────────
// Montre la promesse d'Athly au lieu de la décrire : le même athlète passe de
// l'Acier au niveau 1 à la couronne ATHLY GOD au niveau 200.

const SHOWCASE = [
  { shapeId: 'hex',   colorId: 'iron',     level: 1 },
  { shapeId: 'spike', colorId: 'sapphire', level: 51 },
  { shapeId: 'crown', colorId: 'god',      level: 200 },
];
const STAGE_W = 132;
const STAGE_H = 118;

export function FrameShowcase() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(SHOWCASE.length - 1);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) return undefined;
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % SHOWCASE.length);
        Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    }, 2800);
    return () => clearInterval(id);
  }, [reduced, fade]);

  const item = SHOWCASE[index];
  const color = getColorDef(item.colorId);
  const tint = useMemo(() => color.colors[Math.floor(color.colors.length / 2)], [color]);
  const scale = fade.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <View style={s.showcase} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
        <FrameStage shapeId={item.shapeId} colorId={item.colorId} size={64} width={STAGE_W} height={STAGE_H} userInitial="A" />
      </Animated.View>
      <Animated.View style={[s.showcaseMeta, { opacity: fade }]}>
        <Text style={[s.showcaseLevel, { color: tint }]}>Niv. {item.level}</Text>
        <Text style={s.showcaseName}>{getShapeDef(item.shapeId).name} · {color.name}</Text>
      </Animated.View>
      <View style={s.dots}>
        {SHOWCASE.map((it, i) => (
          <View key={it.colorId} style={[s.dot, i === index && s.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  primary: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35, shadowRadius: 18, elevation: 8,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  showcase: { alignItems: 'center' },
  showcaseMeta: { alignItems: 'center', marginTop: 2 },
  showcaseLevel: { fontSize: 13, fontWeight: '900', letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
  showcaseName: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)' },
  dotActive: { width: 16, backgroundColor: Colors.primary },
});
