import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import useSetLogging from '../../hooks/useSetLogging';
import {
  primaryMuscleLabel,
  secondaryMusclesLabels,
  pickExerciseIcon,
} from '../../constants/exerciseFilters';
import SetTable from './SetTable';
import ActionSheetModal from '../common/ActionSheetModal';

// Bloc exercice pour la vue "Voir tous les exercices" (all-in-one).
// Affiche le titre, les muscles et le SetTable compact (avec « + Série »).
// La vidéo est volontairement masquée pour maximiser l'espace de saisie.
//
// Props :
//   - exercise          : objet exercice (avec .sets)
//   - exerciseIndex     : index dans state.exercises
//   - onRemoveExercise  : (exerciseIndex, exercise) => void
//   - onReplaceExercise : (exerciseIndex) => void

function InlineExerciseBlock({ exercise, exerciseIndex, onRemoveExercise, onReplaceExercise }) {
  const title    = (exercise && (exercise.name || exercise.title)) || 'Exercice';
  const icon     = pickExerciseIcon(exercise);
  const primary  = primaryMuscleLabel(exercise);
  const secondary = secondaryMusclesLabels(exercise);
  const isDone   = !!exercise?.done;

  const log = useSetLogging(exerciseIndex, exercise);
  const sets = log.sets;
  const completedCount = log.completedCount;
  const allDone = sets.length > 0 && completedCount === sets.length;

  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  const showActions = useCallback(() => {
    try { Haptics.selectionAsync(); } catch (_) {}
    setActionSheetVisible(true);
  }, []);

  const actionOptions = [
    ...(onReplaceExercise ? [{ label: 'Remplacer', onPress: () => onReplaceExercise(exerciseIndex) }] : []),
    ...(onRemoveExercise ? [{
      label: 'Supprimer',
      destructive: true,
      onPress: () => onRemoveExercise(exerciseIndex, exercise),
    }] : []),
  ];

  return (
    <View style={[styles.block, isDone && styles.blockDone]}>

      {/* ── En-tête exercice ──────────────────────────────────────────── */}
      <TouchableOpacity accessibilityRole="button"
        style={styles.blockHeader}
        onLongPress={showActions}
        activeOpacity={0.85}
        delayLongPress={280}
      >
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={20} color={Colors.primary} />
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
        onToggle={log.toggle}
        onChange={log.change}
        previousFor={log.previousFor}
        onUsePrevious={log.usePrevious}
        onAdd={log.addSet}
        onRemoveLast={log.canRemoveLast ? log.removeLast : null}
        compact
      />

      <ActionSheetModal
        visible={actionSheetVisible}
        title={title}
        options={actionOptions}
        onClose={() => setActionSheetVisible(false)}
      />
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

});

export default React.memo(InlineExerciseBlock);
