import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';
import {
  primaryMuscleLabel,
  secondaryMusclesLabels,
  pickExerciseIcon,
} from '../../constants/exerciseFilters';
import SetTable from './SetTable';

// Bloc exercice pour la vue "Voir tous les exercices" (all-in-one).
// Affiche le titre, les muscles, le SetTable compact et le bouton [+ Série].
// La vidéo est volontairement masquée pour maximiser l'espace de saisie.
//
// Props :
//   - exercise          : objet exercice (avec .sets)
//   - exerciseIndex     : index dans state.exercises
//   - onRemoveExercise  : (exerciseIndex, exercise) => void
//   - onReplaceExercise : (exerciseIndex) => void

function InlineExerciseBlock({ exercise, exerciseIndex, onRemoveExercise, onReplaceExercise }) {
  const { actions } = useWorkoutInProgress();

  const title    = (exercise && (exercise.name || exercise.title)) || 'Exercice';
  const icon     = pickExerciseIcon(exercise);
  const primary  = primaryMuscleLabel(exercise);
  const secondary = secondaryMusclesLabels(exercise);
  const sets     = (exercise && Array.isArray(exercise.sets)) ? exercise.sets : [];
  const isDone   = !!exercise?.done;

  const completedCount = sets.filter((s) => !!s.completed).length;
  const allDone = sets.length > 0 && completedCount === sets.length;

  const handleToggle = useCallback((i) => {
    actions.toggleSet(exerciseIndex, i);
  }, [actions, exerciseIndex]);

  const handleChange = useCallback((i, patch) => {
    const cur    = sets[i] || {};
    const weight = patch.weight !== undefined ? patch.weight : cur.weight;
    const reps   = patch.reps   !== undefined ? patch.reps   : cur.reps;
    actions.updateSet(exerciseIndex, i, {
      weight: typeof weight === 'number' ? weight : Number(weight) || 0,
      reps:   typeof reps   === 'number' ? reps   : Number(reps)   || 0,
    });
  }, [actions, exerciseIndex, sets]);

  const handleAdd = useCallback(() => {
    actions.addSet(exerciseIndex);
  }, [actions, exerciseIndex]);

  const handleRemove = useCallback((i) => {
    actions.removeSet(exerciseIndex, i);
  }, [actions, exerciseIndex]);

  const showActions = useCallback(() => {
    try { Haptics.selectionAsync(); } catch (_) {}
    const opts = [];
    if (onReplaceExercise) {
      opts.push({ text: 'Remplacer', onPress: () => onReplaceExercise(exerciseIndex) });
    }
    if (onRemoveExercise) {
      opts.push({
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => onRemoveExercise(exerciseIndex, exercise),
      });
    }
    opts.push({ text: 'Annuler', style: 'cancel' });
    Alert.alert(title, null, opts);
  }, [title, onReplaceExercise, onRemoveExercise, exerciseIndex, exercise]);

  return (
    <View style={[styles.block, isDone && styles.blockDone]}>

      {/* ── En-tête exercice ──────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.blockHeader}
        onLongPress={showActions}
        activeOpacity={0.85}
        delayLongPress={280}
      >
        <View style={styles.iconBox}>
          <Text style={styles.icon}>{icon}</Text>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {(primary || secondary.length > 0) ? (
            <Text style={styles.muscles} numberOfLines={1}>
              {primary ? <Text style={styles.musclePrimary}>{primary}</Text> : null}
              {primary && secondary.length > 0 ? '  •  ' : null}
              {secondary.length > 0 ? (
                <Text style={styles.muscleSecondary}>{secondary.join(', ')}</Text>
              ) : null}
            </Text>
          ) : null}
        </View>

        {/* Compteur séries complétées */}
        <View style={[styles.progressBadge, allDone && styles.progressBadgeDone]}>
          {allDone
            ? <Ionicons name="checkmark-circle" size={14} color={Colors.valid} />
            : null}
          <Text style={[styles.progressText, allDone && styles.progressTextDone]}>
            {completedCount}/{sets.length}
          </Text>
        </View>

        <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} style={styles.menuIcon} />
      </TouchableOpacity>

      {/* ── Tableau des séries (compact = sans marge) ─────────────────── */}
      <SetTable
        sets={sets}
        onToggle={handleToggle}
        onChange={handleChange}
        onRemove={handleRemove}
        compact
      />

      {/* ── Ajouter une série ─────────────────────────────────────────── */}
      <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.8}>
        <Ionicons name="add" size={15} color={Colors.primary} />
        <Text style={styles.addBtnText}>Ajouter une série</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.cardDeep,
    overflow: 'hidden',
  },
  blockDone: {
    opacity: 0.6,
    borderColor: 'rgba(34,197,94,0.30)',
  },

  // ── En-tête ─────────────────────────────────────────────────────────────
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
    gap: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.cardInner,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  muscles: {
    marginTop: 2,
    fontSize: 12,
  },
  musclePrimary: {
    color: Colors.primary,
    fontWeight: '600',
  },
  muscleSecondary: {
    color: Colors.textSecondary,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  progressBadgeDone: {
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  progressText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTextDone: {
    color: Colors.valid,
  },
  menuIcon: {
    marginLeft: 2,
  },

  // ── Footer "+ Série" ─────────────────────────────────────────────────────
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  addBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default React.memo(InlineExerciseBlock);
