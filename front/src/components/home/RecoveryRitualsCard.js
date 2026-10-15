import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { RITUAL_TYPES } from '../../data/ritualTypes';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import RitualSheet from './rituals/RitualSheet';

// ─── Récupération active ──────────────────────────────────────────────────────
// Les jours sans séance : un rituel court (mobilité, marche, respiration…)
// rapporte de l'XP et garde la série en vie. Un seul rituel validé par jour.

export default function RecoveryRitualsCard() {
  const { addRitual, items } = useWorkoutLogs();
  const [activeRitual, setActiveRitual] = useState(null);
  const [justCompleted, setJustCompleted] = useState(false);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ritualToday = useMemo(
    () => items.find((l) => l.type === 'ritual' && l.date && l.date.slice(0, 10) === todayKey),
    [items, todayKey],
  );

  const onValidate = useCallback(async (ritual) => {
    setActiveRitual(null);
    setJustCompleted(true);
    await addRitual(ritual.id, ritual.name, ritual.durationSeconds, ritual.xpEarned);
  }, [addRitual]);

  if (ritualToday) {
    return <DoneCard log={ritualToday} animate={justCompleted} />;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.intro}>
        Pas de séance aujourd'hui ? Un rituel de 5 à 15 min te fait gagner de l'XP et garde ta série active.
      </Text>

      <View style={styles.list}>
        {RITUAL_TYPES.map((ritual) => (
          <RitualRow key={ritual.id} ritual={ritual} onPress={() => setActiveRitual(ritual)} />
        ))}
      </View>

      {activeRitual ? (
        <RitualSheet
          key={activeRitual.id}
          ritual={activeRitual}
          onClose={() => setActiveRitual(null)}
          onValidate={onValidate}
        />
      ) : null}
    </View>
  );
}

// ─── Ligne de rituel ──────────────────────────────────────────────────────────

function RitualRow({ ritual, onPress }) {
  const xp = ritual.xpEarned || 20;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${ritual.name}, ${ritual.timerLabel}, ${xp} XP`}
      accessibilityHint="Ouvre le rituel"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${ritual.color}1F` }]}>
        <Ionicons name={ritual.icon} size={20} color={ritual.color} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={2}>{ritual.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={2}>{ritual.timerLabel} · {ritual.subtitle}</Text>
      </View>
      <Text style={[styles.rowXp, xp > 20 && styles.rowXpHigh]}>+{xp} XP</Text>
    </Pressable>
  );
}

// ─── Rituel du jour validé ────────────────────────────────────────────────────

function DoneCard({ log, animate }) {
  const ritual = RITUAL_TYPES.find((r) => r.id === log.ritualId);
  const color = ritual?.color || Colors.valid;
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(enter, {
      toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [animate, enter]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 8, 0] });

  return (
    <Animated.View style={[styles.doneCard, { opacity: enter, transform: [{ translateY }] }]}>
      <View style={[styles.rowIcon, { backgroundColor: `${color}1F` }]}>
        <Ionicons name={ritual?.icon || 'leaf-outline'} size={20} color={color} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName}>Rituel du jour validé</Text>
        <Text style={styles.doneMeta}>
          {ritual?.name || log.name} · +{log.xpEarned || 20} XP. Le prochain sera disponible demain.
        </Text>
      </View>
      <Ionicons name="checkmark-circle" size={24} color={Colors.valid} accessibilityLabel="Validé" />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: 12,
  },
  intro: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
    paddingTop: 4,
    marginBottom: 12,
  },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  rowXp: { color: Colors.textSecondary, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rowXpHigh: { color: Colors.primary },

  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.cardDeep,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `${Colors.valid}40`,
    padding: 14,
  },
  doneMeta: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
});
