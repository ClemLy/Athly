import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { haptics } from '../../services';

// ─── RestTimerBar ─────────────────────────────────────────────────────────────
// Minuteur de repos qui apparaît après chaque série validée : compte à rebours,
// −15 s / +15 s / Passer, vibration et « C'est reparti ! » à la fin.
//
// Props : endsAt (timestamp ms | null), total (s), onAdjust(deltaSec), onSkip, onDone

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export default function RestTimerBar({ endsAt, total, onAdjust, onSkip, onDone }) {
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  const active = !!endsAt;
  const remaining = active ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: active || finished ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, finished, enter]);

  useEffect(() => {
    if (!active) return undefined;
    setFinished(false);
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active, endsAt]);

  // Fin du repos : vibration + message bref, puis on se retire.
  useEffect(() => {
    if (!active || remaining > 0) return undefined;
    haptics.success();
    setFinished(true);
    onDone?.();
    const t = setTimeout(() => setFinished(false), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, remaining]);

  if (!active && !finished) return null;

  const progress = total > 0 ? Math.min(1, remaining / total) : 0;
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View
      style={[styles.wrap, finished && styles.wrapDone, { opacity: enter, transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
    >
      {finished ? (
        <View style={styles.doneRow}>
          <Ionicons name="flash" size={18} color={Colors.valid} />
          <Text style={styles.doneText}>C'est reparti !</Text>
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <Ionicons name="timer-outline" size={20} color={Colors.primary} />
            <View style={styles.label}>
              <Text style={styles.caption}>Repos</Text>
              <Text style={styles.time} accessibilityLabel={`Repos, ${remaining} secondes restantes`}>{fmt(remaining)}</Text>
            </View>
            <Pressable style={styles.chip} onPress={() => onAdjust?.(-15)} accessibilityRole="button" accessibilityLabel="Retirer 15 secondes">
              <Text style={styles.chipText}>−15</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => onAdjust?.(15)} accessibilityRole="button" accessibilityLabel="Ajouter 15 secondes">
              <Text style={styles.chipText}>+15</Text>
            </Pressable>
            <Pressable style={[styles.chip, styles.skip]} onPress={onSkip} accessibilityRole="button" accessibilityLabel="Passer le repos">
              <Text style={styles.skipText}>Passer</Text>
            </Pressable>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: '#1D1A22',
    borderWidth: 1,
    borderColor: 'rgba(254,116,57,0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  wrapDone: { borderColor: 'rgba(34,197,94,0.45)', backgroundColor: '#14201A' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  label: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  caption: { color: Colors.textSecondary, fontSize: 13.5, fontWeight: '600' },
  time: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chip: {
    minWidth: 44, height: 36, borderRadius: 10, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipText: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  skip: { backgroundColor: 'rgba(254,116,57,0.16)' },
  skipText: { color: Colors.primary, fontSize: 13.5, fontWeight: '800' },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)' },
  fill: { height: '100%', backgroundColor: Colors.primary },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  doneText: { color: Colors.valid, fontSize: 15, fontWeight: '800' },
});
