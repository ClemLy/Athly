import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../constants/theme';
import {
  primaryMuscleLabel,
  secondaryMusclesLabels,
} from '../../constants/exerciseFilters';
import useEffortTimer from '../../hooks/useEffortTimer';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';
import ExerciseHeader from '../../components/workouts/ExerciseHeader';
import SetTable from '../../components/workouts/SetTable';

// Détail d'un exercice (maquette 2). Lit l'exo depuis le contexte global de la séance
// via `exerciseIndex` reçu en nav param. Plus de passage d'`actions` via params : tout
// passe par useWorkoutInProgress().
export default function ExerciseDetailScreen({ route, navigation }) {
  const params = (route && route.params) || {};
  const exerciseIndex = typeof params.exerciseIndex === 'number' ? params.exerciseIndex : -1;

  const { state, actions } = useWorkoutInProgress();
  const exercise = useMemo(() => {
    if (exerciseIndex < 0) return null;
    return state.exercises && state.exercises[exerciseIndex] ? state.exercises[exerciseIndex] : null;
  }, [state.exercises, exerciseIndex]);

  const title = (exercise && (exercise.name || exercise.title)) || 'Exercice';
  const primary = primaryMuscleLabel(exercise);
  const secondary = secondaryMusclesLabels(exercise);
  const videoUrl = (exercise && exercise.videoUrl) || null;
  const sets = (exercise && Array.isArray(exercise.sets)) ? exercise.sets : [];
  const notes = (exercise && exercise.notes) || '';

  const timer = useEffortTimer({ autoStart: true });

  useFocusEffect(
    useCallback(() => {
      timer.start();
      return () => { timer.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleToggle = useCallback((i) => {
    if (exerciseIndex < 0) return;
    actions.toggleSet(exerciseIndex, i);
  }, [actions, exerciseIndex]);

  const handleChange = useCallback((i, patch) => {
    if (exerciseIndex < 0) return;
    const cur = sets[i] || {};
    const weight = patch.weight !== undefined ? patch.weight : cur.weight;
    const reps = patch.reps !== undefined ? patch.reps : cur.reps;
    actions.updateSet(exerciseIndex, i, {
      weight: typeof weight === 'number' ? weight : Number(weight) || 0,
      reps: typeof reps === 'number' ? reps : Number(reps) || 0,
    });
  }, [actions, exerciseIndex, sets]);

  const handleAdd = useCallback(() => {
    if (exerciseIndex < 0) return;
    actions.addSet(exerciseIndex);
  }, [actions, exerciseIndex]);

  const handleNotes = useCallback((text) => {
    if (exerciseIndex < 0) return;
    actions.updateExerciseNotes(exerciseIndex, text);
  }, [actions, exerciseIndex]);

  const handleBack = useCallback(() => {
    if (navigation) navigation.goBack();
  }, [navigation]);

  const handleFinishExercise = useCallback(() => {
    if (exerciseIndex < 0) return;
    actions.markExerciseDone(exerciseIndex, true);
    if (navigation) navigation.goBack();
  }, [actions, exerciseIndex, navigation]);

  const handleUndoneExercise = useCallback(() => {
    if (exerciseIndex < 0) return;
    actions.markExerciseDone(exerciseIndex, false);
  }, [actions, exerciseIndex]);

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Exercice introuvable.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backRow}>
            <TouchableOpacity
              onPress={handleBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!navigation || !exercise) return;
                navigation.navigate('ExerciseStats', {
                  exerciseRef: { id: exercise.id, name: exercise.name },
                });
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.historyBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="stats-chart" size={16} color={Colors.primary} />
              <Text style={styles.historyBtnText}>Historique</Text>
            </TouchableOpacity>
          </View>

          <ExerciseHeader timer={timer.formatted} videoUrl={videoUrl} />

          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {(primary || secondary.length > 0) ? (
              <Text style={styles.muscleLine} numberOfLines={1}>
                {primary ? <Text style={styles.musclePrimary}>{primary}</Text> : null}
                {primary && secondary.length > 0 ? <Text style={styles.muscleDot}>{'  •  '}</Text> : null}
                {secondary.length > 0 ? (
                  <Text style={styles.muscleSecondary}>{secondary.join(', ')}</Text>
                ) : null}
              </Text>
            ) : null}
          </View>

          <SetTable
            sets={sets}
            onToggle={handleToggle}
            onChange={handleChange}
          />

          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAdd}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color={Colors.primary} />
            <Text style={styles.addBtnText}>Ajouter une série</Text>
          </TouchableOpacity>

          {/* ── Terminer / Rouvrir exercice ── */}
          {exercise.done ? (
            <View style={styles.doneBar}>
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark-circle" size={15} color={Colors.valid} />
                <Text style={styles.doneBadgeText}>Exercice terminé</Text>
              </View>
              <TouchableOpacity style={styles.undoneBtn} onPress={handleUndoneExercise} activeOpacity={0.8}>
                <Text style={styles.undoneBtnText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.finishBtn} onPress={handleFinishExercise} activeOpacity={0.85}>
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={styles.finishBtnText}>Terminer l'exercice</Text>
            </TouchableOpacity>
          )}

          <View style={styles.notesBlock}>
            <Text style={styles.notesTitle}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={handleNotes}
              placeholder="Ajouter des notes..."
              placeholderTextColor={Colors.textMuted}
              style={styles.notesInput}
              multiline
              textAlignVertical="top"
              underlineColorAndroid="transparent"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40 },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 0,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(254, 116, 57, 0.45)',
    backgroundColor: 'rgba(254, 116, 57, 0.08)',
  },
  historyBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },

  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  muscleLine: {
    marginTop: 6,
    fontSize: 14,
  },
  musclePrimary: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  muscleDot: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  muscleSecondary: {
    color: Colors.textSecondary,
    fontSize: 14,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  addBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },

  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: Colors.valid,
    shadowColor: Colors.valid,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  finishBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  doneBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  doneBadgeText: {
    color: Colors.valid,
    fontSize: 14,
    fontWeight: '700',
  },
  undoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  undoneBtnText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  notesBlock: {
    marginTop: 22,
    paddingHorizontal: 20,
  },
  notesTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
  },
  notesInput: {
    minHeight: 96,
    backgroundColor: Colors.card,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 14,
  },

  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  notFoundText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 18,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
