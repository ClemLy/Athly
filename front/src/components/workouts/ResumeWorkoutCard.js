import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';

// ─── Carte "Reprendre ta séance" ──────────────────────────────────────────────
// Visible quand une séance a été interrompue (app fermée en pleine séance).
// Affichée sur l'accueil et sur la liste des séances.

function formatAgo(ts) {
  const min = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `il y a ${h} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;
}

export default function ResumeWorkoutCard({ onResume, style }) {
  const { resumable, resumeWorkout, discardResumable } = useWorkoutInProgress();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!resumable) return;
    Animated.timing(enter, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [resumable, enter]);

  if (!resumable) return null;

  const exercises = resumable.state.exercises || [];
  const doneSets = exercises.reduce(
    (n, ex) => n + (Array.isArray(ex.sets) ? ex.sets.filter((s) => s.completed).length : 0), 0,
  );

  const handleResume = () => {
    const info = resumeWorkout();
    onResume?.(info || {});
  };

  return (
    <Animated.View
      style={[
        s.card,
        style,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      <View style={s.head}>
        <View style={s.iconWrap}>
          <Ionicons name="play-circle" size={22} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Séance en pause</Text>
          <Text style={s.meta} numberOfLines={1}>
            {resumable.state.name || 'Séance'} · {exercises.length} exercice{exercises.length > 1 ? 's' : ''}
            {doneSets > 0 ? ` · ${doneSets} série${doneSets > 1 ? 's' : ''} faite${doneSets > 1 ? 's' : ''}` : ''}
          </Text>
          <Text style={s.ago}>Commencée {formatAgo(resumable.startedAt)}</Text>
        </View>
      </View>
      <View style={s.actions}>
        <TouchableOpacity
          style={s.discardBtn}
          onPress={discardResumable}
          accessibilityRole="button"
          accessibilityLabel="Abandonner la séance en pause"
        >
          <Text style={s.discardTxt}>Abandonner</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.resumeBtn}
          onPress={handleResume}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={s.resumeTxt}>Reprendre</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(254,116,57,0.35)',
    padding: 16,
  },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(254,116,57,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  meta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  ago: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  discardBtn: {
    flex: 1, height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.separator,
    alignItems: 'center', justifyContent: 'center',
  },
  discardTxt: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  resumeBtn: {
    flex: 1.4, height: 44, borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  resumeTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
