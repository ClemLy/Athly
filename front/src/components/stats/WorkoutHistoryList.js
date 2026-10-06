import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, Pressable, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, MUSCLE_GROUP_COLORS } from '../../constants/theme';
import ConfirmModal from '../common/ConfirmModal';

const CARD_BG       = Colors.cardDeep;
const BORDER        = 'rgba(255,255,255,0.06)';
const BORDER_OPEN   = 'rgba(254,116,57,0.28)';
const DIVIDER       = 'rgba(255,255,255,0.06)';
const ANIM_MS       = 220;

const GROUP_LABELS = {
  pectoraux: 'Pectoraux', dos: 'Dos', epaules: 'Épaules', bras: 'Bras', jambes: 'Jambes', abdos: 'Abdos', other: 'Autre',
};

const fmtKg = (n) => String(n).replace('.', ',');

// 8 420 → « 8,4 t » ; 640 → « 640 kg »
function fmtVolume(v) {
  const n = Number(v) || 0;
  if (n >= 1000) return `${(Math.round(n / 100) / 10).toString().replace('.', ',')} t`;
  return `${Math.round(n)} kg`;
}

// ─── Barre des muscles travaillés (part du volume) ───────────────────────────

function MuscleBar({ distribution }) {
  const parts = useMemo(() => {
    const entries = Object.entries(distribution || {}).filter(([, v]) => Number(v) > 0);
    const total = entries.reduce((n, [, v]) => n + Number(v), 0);
    if (!total) return [];
    return entries
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([k, v]) => ({ key: k, share: Number(v) / total }));
  }, [distribution]);
  if (parts.length === 0) return null;

  const label = parts.slice(0, 3).map((p) => GROUP_LABELS[p.key] || p.key).join(' · ');
  return (
    <View style={styles.muscleWrap} accessibilityLabel={`Muscles travaillés : ${label}`}>
      <View style={styles.muscleBar}>
        {parts.map((p) => (
          <View key={p.key} style={{ flex: p.share, backgroundColor: MUSCLE_GROUP_COLORS[p.key] || MUSCLE_GROUP_COLORS.other }} />
        ))}
      </View>
      <Text style={styles.muscleLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── ExerciseBlock ────────────────────────────────────────────────────────────

function ExerciseBlock({ exercise, isLast }) {
  const completedSets = useMemo(
    () => (exercise.sets ?? []).filter((s) => s.completed),
    [exercise.sets],
  );
  // Meilleure série = plus lourde (puis plus de répétitions à poids égal).
  const bestIndex = useMemo(() => {
    let best = -1;
    completedSets.forEach((s, i) => {
      const b = completedSets[best];
      if (!b || s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps)) best = i;
    });
    return completedSets.length > 1 ? best : -1;
  }, [completedSets]);
  if (completedSets.length === 0) return null;

  return (
    <View style={[styles.exerciseBlock, !isLast && styles.exerciseBlockBorder]}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
        <Text style={styles.exerciseSetsCount}>
          {completedSets.length} série{completedSets.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.setsWrap}>
        {completedSets.map((set, i) => (
          <View key={i} style={[styles.setChip, i === bestIndex && styles.setChipBest]}>
            {i === bestIndex ? <Ionicons name="trophy" size={11} color={Colors.gold} /> : null}
            <Text style={[styles.setChipText, i === bestIndex && styles.setChipTextBest]}>
              {set.weight > 0 ? `${fmtKg(set.weight)} kg × ${set.reps}` : `${set.reps} réps`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── SessionCard ──────────────────────────────────────────────────────────────

function SessionCard({ log, onDelete }) {
  const [expanded,      setExpanded]      = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = useCallback(() => {
    const next = !expanded;
    if (next) setContentVisible(true);
    setExpanded(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: ANIM_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !next) setContentVisible(false);
    });
  }, [expanded, anim]);

  const handleDelete = useCallback(() => setDeleteConfirmVisible(true), []);
  const confirmDelete = useCallback(() => {
    setDeleteConfirmVisible(false);
    onDelete(log.id);
  }, [log, onDelete]);

  const exercises = useMemo(
    () => (log.exercises ?? []).filter((ex) => (ex.sets ?? []).some((s) => s.completed)),
    [log.exercises],
  );

  const date = useMemo(() => new Date(log.date), [log.date]);
  const valid = !Number.isNaN(date.getTime());
  const day = valid ? date.getDate() : '–';
  const month = valid ? date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : '';
  const weekday = valid ? date.toLocaleDateString('fr-FR', { weekday: 'long' }) : '';

  const durationMin = log.durationSeconds ? Math.round(log.durationSeconds / 60) : null;
  const meta = [
    durationMin ? `${durationMin} min` : null,
    `${exercises.length} exercice${exercises.length !== 1 ? 's' : ''}`,
    log.totalVolume ? fmtVolume(log.totalVolume) : null,
  ].filter(Boolean).join('  ·  ');

  const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 2000] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${log.name}, ${weekday} ${day} ${month}. ${meta}`}
        onPress={toggle}
        style={({ pressed }) => [styles.cardHeader, pressed && styles.cardHeaderPressed]}
      >
        <View style={styles.dateTile}>
          <Text style={styles.dateDay}>{day}</Text>
          <Text style={styles.dateMonth}>{month}</Text>
        </View>

        <View style={styles.cardMain}>
          <View style={styles.titleRow}>
            <Text style={styles.sessionName} numberOfLines={1}>{log.name}</Text>
            {log.xpEarned ? (
              <View style={styles.xpPill}>
                <Text style={styles.xpText}>+{log.xpEarned} XP</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.sessionMeta} numberOfLines={1}>{meta}</Text>
          <MuscleBar distribution={log.muscleDistribution} />
        </View>

        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-down" size={18} color={expanded ? Colors.primary : Colors.textMuted} />
        </Animated.View>
      </Pressable>

      <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
        {contentVisible && (
          <View style={styles.body}>
            <View style={styles.divider} />

            {exercises.length === 0 ? (
              <Text style={styles.noDetail}>Détail des exercices non disponible.</Text>
            ) : (
              exercises.map((ex, i) => (
                <ExerciseBlock
                  key={ex.id || `${ex.name}-${i}`}
                  exercise={ex}
                  isLast={i === exercises.length - 1}
                />
              ))
            )}

            {onDelete && (
              <TouchableOpacity accessibilityRole="button"
                style={styles.deleteBtn}
                onPress={handleDelete}
                activeOpacity={0.75}
              >
                <Ionicons name="trash-outline" size={15} color={Colors.error} />
                <Text style={styles.deleteTxt}>Supprimer cette séance</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      <ConfirmModal
        visible={deleteConfirmVisible}
        icon="trash-outline"
        title="Supprimer la séance"
        body={`Supprimer "${log.name}" de l'historique ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmVisible(false)}
      />
    </View>
  );
}

// ─── WorkoutHistoryList ───────────────────────────────────────────────────────

export default function WorkoutHistoryList({ logs, onDelete }) {
  const sorted = useMemo(
    () => [...logs].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [logs],
  );

  if (sorted.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="calendar-clear-outline" size={30} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Pas encore de séance</Text>
        <Text style={styles.empty}>Termine ta première séance : elle apparaîtra ici avec le détail de tes séries.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <SessionCard log={item} onDelete={onDelete} />
      )}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      scrollEnabled={false}
      removeClippedSubviews={false}
      initialNumToRender={20}
      maxToRenderPerBatch={15}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  cardExpanded: { borderColor: BORDER_OPEN },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  cardHeaderPressed: { backgroundColor: 'rgba(255,255,255,0.03)' },

  dateTile: {
    width: 50,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { color: Colors.textPrimary, fontSize: 21, fontWeight: '800', lineHeight: 24, fontVariant: ['tabular-nums'] },
  dateMonth: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  cardMain: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionName: { flexShrink: 1, color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  sessionMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 3, fontVariant: ['tabular-nums'] },

  xpPill: {
    backgroundColor: 'rgba(254,116,57,0.14)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  xpText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },

  muscleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  muscleBar: {
    flexDirection: 'row',
    width: 64,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
  },
  muscleLabel: { flex: 1, color: Colors.textMuted, fontSize: 12.5 },

  body:    { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginBottom: 6 },
  noDetail:{ color: Colors.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },

  exerciseBlock: { paddingVertical: 10 },
  exerciseBlockBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER },
  exerciseHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  exerciseName: { flex: 1, color: Colors.textPrimary, fontSize: 14.5, fontWeight: '700' },
  exerciseSetsCount: { color: Colors.textMuted, fontSize: 12.5, fontWeight: '600' },

  setsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  setChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  setChipBest: { backgroundColor: 'rgba(255,215,0,0.1)' },
  setChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  setChipTextBest: { color: Colors.textPrimary },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  deleteTxt: { color: Colors.error, fontSize: 13.5, fontWeight: '600' },

  sep:   { height: 10 },
  emptyWrap: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 4 },
  empty: { color: Colors.textSecondary, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
});
