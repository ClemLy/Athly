import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../constants/theme';
import {
  primaryMuscleLabel,
  secondaryMusclesLabels,
} from '../../constants/exerciseFilters';
import { useEffortTimer } from '../../hooks';
import useSetLogging from '../../hooks/useSetLogging';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';
import { haptics } from '../../services';
import ExerciseDemoCard from '../../components/workouts/ExerciseDemoCard';
import SetTable from '../../components/workouts/SetTable';
import RestTimerBar from '../../components/workouts/RestTimerBar';

// Écran d'un exercice de la séance en cours. Lit l'exo depuis le contexte
// global via `exerciseIndex` (nav param) ; toutes les actions passent par
// useWorkoutInProgress() / useSetLogging().
//
// Parcours pensé pour la salle : on voit la dernière performance et l'objectif
// du jour, on valide chaque série d'un geste (une série vide reprend la
// dernière fois), le repos se lance tout seul, et « Exercice suivant »
// enchaîne sans repasser par la liste.

const fmtKg = (n) => String(n).replace('.', ',');

function daysAgoLabel(date) {
  if (!date) return '';
  const days = Math.round((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days} j`;
}

export default function ExerciseDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const params = (route && route.params) || {};
  const exerciseIndex = typeof params.exerciseIndex === 'number' ? params.exerciseIndex : -1;

  const { state, actions } = useWorkoutInProgress();
  const allExercises = Array.isArray(state.exercises) ? state.exercises : [];
  const exercise = exerciseIndex >= 0 ? allExercises[exerciseIndex] || null : null;

  const title = (exercise && (exercise.name || exercise.title)) || 'Exercice';
  const primary = primaryMuscleLabel(exercise);
  const secondary = secondaryMusclesLabels(exercise);
  const notes = (exercise && exercise.notes) || '';

  const log = useSetLogging(exerciseIndex, exercise);
  const timer = useEffortTimer({ autoStart: true });
  const [notesOpen, setNotesOpen] = useState(!!notes);

  // ── Repos automatique après chaque série validée ──────────────────────────
  const restTotal = exercise && exercise.isCompound ? 120 : 90;
  const [rest, setRest] = useState(null); // { endsAt, total }

  useFocusEffect(
    useCallback(() => {
      timer.start();
      return () => { timer.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleToggle = useCallback((i) => {
    const completed = log.toggle(i);
    const remainingAfter = log.sets.filter((s, k) => (k === i ? completed : s.completed)).length < log.sets.length;
    // Pas de repos après la dernière série de l'exercice.
    if (completed && remainingAfter) setRest({ endsAt: Date.now() + restTotal * 1000, total: restTotal });
    if (!completed) setRest(null);
  }, [log, restTotal]);

  const adjustRest = useCallback((delta) => {
    haptics.selection();
    setRest((r) => (r ? { ...r, endsAt: Math.max(Date.now() + 1000, r.endsAt + delta * 1000), total: Math.max(r.total + delta, 15) } : r));
  }, []);

  // ── Objectif du jour ──────────────────────────────────────────────────────
  const suggestion = log.suggestion;
  const applySuggestion = useCallback(() => {
    if (!suggestion || exerciseIndex < 0) return;
    haptics.selection();
    log.sets.forEach((s, i) => {
      if (s.completed) return;
      actions.updateSet(exerciseIndex, i, { weight: suggestion.weight, reps: Number(s.reps) || log.previousFor(i)?.reps || 0 });
    });
  }, [suggestion, exerciseIndex, log, actions]);

  // ── Enchaînement ──────────────────────────────────────────────────────────
  const nextIndex = useMemo(() => {
    const after = allExercises.findIndex((ex, i) => i > exerciseIndex && !ex.done);
    if (after >= 0) return after;
    const before = allExercises.findIndex((ex, i) => i !== exerciseIndex && !ex.done);
    return before >= 0 ? before : null;
  }, [allExercises, exerciseIndex]);
  const nextExercise = nextIndex != null ? allExercises[nextIndex] : null;

  const handleBack = useCallback(() => {
    if (navigation) navigation.goBack();
  }, [navigation]);

  const handleFinishExercise = useCallback(() => {
    if (exerciseIndex < 0 || !navigation) return;
    haptics.success();
    actions.markExerciseDone(exerciseIndex, true);
    if (nextIndex != null) navigation.replace('ExerciseDetail', { exerciseIndex: nextIndex });
    else navigation.goBack();
  }, [actions, exerciseIndex, navigation, nextIndex]);

  const handleReopen = useCallback(() => {
    if (exerciseIndex < 0) return;
    haptics.selection();
    actions.markExerciseDone(exerciseIndex, false);
  }, [actions, exerciseIndex]);

  const handleNotes = useCallback((text) => {
    if (exerciseIndex < 0) return;
    actions.updateExerciseNotes(exerciseIndex, text);
  }, [actions, exerciseIndex]);

  const openHistory = useCallback(() => {
    if (!navigation || !exercise) return;
    navigation.navigate('ExerciseStats', { exerciseRef: { id: exercise.id, name: exercise.name } });
  }, [navigation, exercise]);

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Exercice introuvable.</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.backBtnFallback} onPress={handleBack}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // « 35 kg × 10 · 9 · 8 » si la charge est la même partout, sinon « 35×10 · 37,5×8 ».
  const prev = log.previous;
  const sameWeight = prev.length > 0 && prev.every((p) => p.weight === prev[0].weight);
  const lastSummary = !prev.length ? '' : sameWeight
    ? (prev[0].weight ? `${fmtKg(prev[0].weight)} kg × ` : '') + prev.map((p) => p.reps).join(' · ') + (prev[0].weight ? '' : ' réps')
    : prev.map((p) => `${fmtKg(p.weight)}×${p.reps}`).join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Barre du haut ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            accessibilityLabel="Retour à la séance"
            accessibilityRole="button"
            onPress={handleBack}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.position}>
            Exercice {exerciseIndex + 1} sur {allExercises.length}
          </Text>
          <View style={styles.topRight}>
            <View style={styles.chrono} accessibilityLabel={`Temps sur cet exercice : ${timer.formatted}`}>
              <Ionicons name="stopwatch-outline" size={15} color={Colors.primary} />
              <Text style={styles.chronoText}>{timer.formatted}</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Voir ma progression sur cet exercice"
              onPress={openHistory}
              style={styles.iconBtn}
            >
              <Ionicons name="stats-chart" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{title}</Text>
            {(primary || secondary.length > 0) ? (
              <Text style={styles.muscleLine} numberOfLines={2}>
                {primary ? <Text style={styles.musclePrimary}>{primary}</Text> : null}
                {primary && secondary.length > 0 ? <Text style={styles.muscleDot}>{'  ·  '}</Text> : null}
                {secondary.length > 0 ? <Text style={styles.muscleSecondary}>{secondary.join(', ')}</Text> : null}
              </Text>
            ) : null}
          </View>

          <ExerciseDemoCard exercise={exercise} />

          {/* ── Dernière fois / objectif du jour ── */}
          {log.hasHistory ? (
            <View style={styles.memory}>
              <View style={styles.memoryRow}>
                <Text style={styles.memoryLabel}>Dernière fois</Text>
                <Text style={styles.memoryWhen}>{daysAgoLabel(log.lastDate)}</Text>
              </View>
              <Text style={styles.memoryValue} numberOfLines={2}>{lastSummary}</Text>
              {suggestion ? (
                <View style={styles.goal}>
                  <Ionicons name={suggestion.reason === 'progress' ? 'trending-up' : 'repeat'} size={18} color={Colors.primary} />
                  <View style={styles.goalText}>
                    <Text style={styles.goalTitle}>
                      Objectif : {fmtKg(suggestion.weight)} kg
                      {suggestion.delta ? <Text style={styles.goalDelta}>{`  +${fmtKg(suggestion.delta)} kg`}</Text> : null}
                    </Text>
                    <Text style={styles.goalSub}>
                      {suggestion.reason === 'progress' ? 'Toutes tes séries étaient faites : on monte.' : 'On consolide avant de monter.'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={applySuggestion}
                    style={({ pressed }) => [styles.goalBtn, pressed && { opacity: 0.8 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Appliquer ${fmtKg(suggestion.weight)} kilos aux séries restantes`}
                  >
                    <Text style={styles.goalBtnText}>Appliquer</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.firstTime}>
              <Ionicons name="sparkles-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.firstTimeText}>Première fois sur cet exercice : choisis une charge confortable.</Text>
            </View>
          )}

          <SetTable
            sets={log.sets}
            onToggle={handleToggle}
            onChange={log.change}
            previousFor={log.previousFor}
            onUsePrevious={log.usePrevious}
            onAdd={log.addSet}
            onRemoveLast={log.canRemoveLast ? log.removeLast : null}
          />

          {/* ── Notes (repliées par défaut) ── */}
          {notesOpen ? (
            <View style={styles.notesBlock}>
              <Text style={styles.notesTitle}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={handleNotes}
                placeholder="Réglage machine, sensations, douleur…"
                placeholderTextColor={Colors.textMuted}
                style={styles.notesInput}
                multiline
                textAlignVertical="top"
                underlineColorAndroid="transparent"
                autoFocus={!notes}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => setNotesOpen(true)}
              style={({ pressed }) => [styles.addNote, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <Ionicons name="create-outline" size={17} color={Colors.textSecondary} />
              <Text style={styles.addNoteText}>Ajouter une note</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* ── Bas d'écran : repos + action principale ── */}
        <View style={[styles.bottom, { paddingBottom: 12 + Math.min(insets.bottom, 8) }]}>
          <RestTimerBar
            endsAt={rest?.endsAt ?? null}
            total={rest?.total ?? restTotal}
            onAdjust={adjustRest}
            onSkip={() => { haptics.selection(); setRest(null); }}
            onDone={() => setRest(null)}
          />
          {exercise.done ? (
            <View style={styles.doneBar}>
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.valid} />
                <Text style={styles.doneBadgeText}>Exercice terminé</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" style={styles.reopenBtn} onPress={handleReopen} activeOpacity={0.8}>
                <Text style={styles.reopenText}>Rouvrir</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Pressable
              onPress={handleFinishExercise}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              accessibilityRole="button"
              accessibilityLabel={nextExercise ? `Exercice suivant : ${nextExercise.name}` : "Terminer l'exercice"}
            >
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>{nextExercise ? 'Exercice suivant' : "Terminer l'exercice"}</Text>
                {nextExercise ? <Text style={styles.ctaSub} numberOfLines={1}>{nextExercise.name}</Text> : null}
              </View>
              <Ionicons name={nextExercise ? 'arrow-forward' : 'checkmark-done'} size={20} color="#fff" />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  position: { flex: 1, color: Colors.textMuted, fontSize: 13.5, fontWeight: '600', marginLeft: 2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chrono: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    backgroundColor: Colors.cardDeep,
  },
  chronoText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  titleBlock: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  muscleLine: { marginTop: 6, fontSize: 14.5, lineHeight: 20 },
  musclePrimary: { color: Colors.primary, fontWeight: '700' },
  muscleDot: { color: Colors.textMuted },
  muscleSecondary: { color: Colors.textSecondary },

  memory: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: Colors.cardDeep,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  memoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  memoryLabel: { color: Colors.textSecondary, fontSize: 13.5, fontWeight: '600' },
  memoryWhen: { color: Colors.textMuted, fontSize: 13 },
  memoryValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  goalText: { flex: 1 },
  goalTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  goalDelta: { color: Colors.primary, fontWeight: '800' },
  goalSub: { color: Colors.textMuted, fontSize: 12.5, marginTop: 2 },
  goalBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(254,116,57,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBtnText: { color: Colors.primary, fontSize: 13.5, fontWeight: '800' },

  firstTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 14,
  },
  firstTimeText: { flex: 1, color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19 },

  addNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 10,
  },
  addNoteText: { color: Colors.textSecondary, fontSize: 14.5, fontWeight: '600' },
  notesBlock: { marginTop: 18, paddingHorizontal: 20 },
  notesTitle: { color: Colors.textSecondary, fontSize: 13.5, fontWeight: '600', marginBottom: 8 },
  notesInput: {
    minHeight: 88,
    backgroundColor: Colors.cardDeep,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 14,
  },

  bottom: {
    paddingTop: 10,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    minHeight: 58,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaText: { flex: 1 },
  ctaTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 1 },
  doneBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneBadgeText: { color: Colors.valid, fontSize: 15, fontWeight: '700' },
  reopenBtn: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)' },
  reopenText: { color: Colors.textSecondary, fontSize: 13.5, fontWeight: '700' },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  notFoundText: { color: Colors.textMuted, fontSize: 14, marginBottom: 18 },
  backBtnFallback: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 22 },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
