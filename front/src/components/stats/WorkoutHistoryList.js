import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Animated, Alert, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CARD_BG       = 'rgba(255,255,255,0.045)';
const CARD_BG_OPEN  = 'rgba(254,116,57,0.06)';
const BORDER        = 'rgba(255,255,255,0.08)';
const BORDER_OPEN   = 'rgba(254,116,57,0.22)';
const DIVIDER       = 'rgba(255,255,255,0.06)';
const ANIM_MS       = 220;

// ─── SetRow ───────────────────────────────────────────────────────────────────

function SetRow({ set, index }) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setIndex}>S{index + 1}</Text>
      <Text style={styles.setReps}>{set.reps}</Text>
      <Text style={styles.setUnit}> reps</Text>
      <Text style={styles.setX}> × </Text>
      <Text style={styles.setWeight}>
        {set.weight > 0 ? `${set.weight} kg` : '—'}
      </Text>
    </View>
  );
}

// ─── ExerciseBlock ────────────────────────────────────────────────────────────

function ExerciseBlock({ exercise, isLast }) {
  const completedSets = useMemo(
    () => (exercise.sets ?? []).filter((s) => s.completed),
    [exercise.sets],
  );
  if (completedSets.length === 0) return null;

  return (
    <View style={[styles.exerciseBlock, !isLast && styles.exerciseBlockBorder]}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseDot} />
        <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
        <Text style={styles.exerciseSetsCount}>
          {completedSets.length} série{completedSets.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.setsWrap}>
        {completedSets.map((set, i) => (
          <SetRow key={i} set={set} index={i} />
        ))}
      </View>
    </View>
  );
}

// ─── SessionCard ──────────────────────────────────────────────────────────────

function SessionCard({ log, onDelete }) {
  const [expanded,      setExpanded]      = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
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

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer la séance',
      `Supprimer "${log.name}" de l'historique ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(log.id) },
      ],
    );
  }, [log, onDelete]);

  const exercises = useMemo(
    () => (log.exercises ?? []).filter((ex) =>
      (ex.sets ?? []).some((s) => s.completed),
    ),
    [log.exercises],
  );

  const dateStr = useMemo(() => {
    try {
      return new Date(log.date).toLocaleDateString('fr-FR', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {
      return log.date?.slice(0, 10) ?? '—';
    }
  }, [log.date]);

  const durationMin = log.durationSeconds
    ? Math.round(log.durationSeconds / 60)
    : null;

  const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 2000] });

  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>

      {/* ── Header ── */}
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.75}
        style={styles.cardHeader}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.sessionName} numberOfLines={1}>{log.name}</Text>
          <Text style={styles.sessionMeta}>
            {dateStr}
            {durationMin ? ` · ${durationMin} min` : ''}
            {' · '}{exercises.length} exercice{exercises.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <View style={styles.xpPill}>
            <Text style={styles.xpText}>+{log.xpEarned} XP</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={expanded ? Colors.primary : Colors.textMuted}
            style={styles.chevron}
          />
        </View>
      </TouchableOpacity>

      {/* ── Accordion body ── */}
      <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
        {contentVisible && (
          <View style={styles.body}>
            <View style={styles.divider} />

            {exercises.length === 0 ? (
              <Text style={styles.noDetail}>
                Détail des exercices non disponible.
              </Text>
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
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                activeOpacity={0.75}
              >
                <Ionicons name="trash-outline" size={13} color={Colors.error} />
                <Text style={styles.deleteTxt}>Supprimer cette séance</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>
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
      <Text style={styles.empty}>
        Aucune séance enregistrée pour le moment.{'\n'}
        Termine une séance pour voir ton historique apparaître.
      </Text>
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
  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  cardExpanded: {
    backgroundColor: CARD_BG_OPEN,
    borderColor: BORDER_OPEN,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  cardLeft: { flex: 1 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },

  sessionName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  sessionMeta: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },

  xpPill: {
    backgroundColor: 'rgba(254,116,57,0.14)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  xpText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  chevron: { marginLeft: 2 },

  // ── Body ──────────────────────────────────────────────────────────────────
  body:    { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginBottom: 12 },
  noDetail:{ color: Colors.textMuted, fontSize: 12, fontStyle: 'italic' },

  // ── Exercise block ────────────────────────────────────────────────────────
  exerciseBlock: { paddingVertical: 8 },
  exerciseBlockBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  exerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    opacity: 0.7,
    flexShrink: 0,
  },
  exerciseName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseSetsCount: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 0,
  },

  // ── Sets ──────────────────────────────────────────────────────────────────
  setsWrap: { paddingLeft: 14, gap: 4 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  setIndex: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    width: 22,
    letterSpacing: 0.3,
  },
  setReps: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  setUnit: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  setX: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  setWeight: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
    alignSelf: 'flex-start',
  },
  deleteTxt: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── List ──────────────────────────────────────────────────────────────────
  sep:   { height: 8 },
  empty: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
