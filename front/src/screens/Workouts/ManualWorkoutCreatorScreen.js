import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import {
  pickExerciseIcon,
  primaryMuscleLabel,
  secondaryMusclesLabels,
  primaryEquipmentLabel,
} from '../../constants/exerciseFilters';
import AddExerciseSheet from '../../components/workouts/AddExerciseSheet';
import { useSavedWorkouts } from '../../context/SavedWorkoutsContext';

// Construction manuelle d'une séance.
// L'utilisateur :
//   1. Donne un nom à sa séance
//   2. Ajoute ses exercices un par un (depuis catalogue + custom via AddExerciseSheet)
//   3. Définit le nombre de sets et reps cibles par exercice
//   4. Sauvegarde → SavedWorkoutsContext avec flag isManual: true
//
// Pas d'algorithme, pas de filtres : c'est l'utilisateur qui décide tout.
//
function ExerciseRow({ exercise, index, onRemove, onSetsChange, onRepsChange }) {
  const icon = pickExerciseIcon(exercise);
  const primary = primaryMuscleLabel(exercise);
  const secondary = secondaryMusclesLabels(exercise);
  const equipment = primaryEquipmentLabel(exercise);
  const setsCount = Array.isArray(exercise.sets) ? exercise.sets.length : 4;
  const targetReps = exercise.sets && exercise.sets[0] && exercise.sets[0].reps
    ? exercise.sets[0].reps
    : '';

  return (
    <View style={styles.exoCard}>
      <View style={styles.exoHeader}>
        <View style={styles.exoIcon}>
          <Text style={styles.exoEmoji}>{icon}</Text>
        </View>
        <View style={styles.exoContent}>
          <Text style={styles.exoName} numberOfLines={1}>{exercise.name}</Text>
          <Text style={styles.exoMuscle} numberOfLines={1}>
            <Text style={styles.exoPrimary}>{primary}</Text>
            {secondary.length > 0 ? (
              <Text style={styles.exoSecondary}>{`  •  ${secondary.join(', ')}`}</Text>
            ) : null}
          </Text>
          {equipment ? <Text style={styles.exoEquip}>{equipment}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => onRemove(index)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.exoRemove}
        >
          <Ionicons name="close-circle" size={22} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.exoTargets}>
        <View style={styles.targetField}>
          <Text style={styles.targetLabel}>Sets</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => onSetsChange(index, Math.max(1, setsCount - 1))}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{setsCount}</Text>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => onSetsChange(index, Math.min(20, setsCount + 1))}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.targetField}>
          <Text style={styles.targetLabel}>Reps cibles</Text>
          <TextInput
            value={targetReps ? String(targetReps) : ''}
            onChangeText={(t) => {
              const n = t === '' ? 0 : Math.max(0, Math.min(99, Number(t) || 0));
              onRepsChange(index, n);
            }}
            keyboardType="numeric"
            placeholder="—"
            placeholderTextColor={Colors.textMuted}
            style={styles.repsInput}
            maxLength={2}
            underlineColorAndroid="transparent"
            selectTextOnFocus
          />
        </View>
      </View>
    </View>
  );
}

export default function ManualWorkoutCreatorScreen({ navigation }) {
  const { create: createSavedWorkout } = useSavedWorkouts();

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildSets = (count, reps) => {
    const c = Math.max(1, Math.min(20, count || 4));
    return Array.from({ length: c }, () => ({
      reps: Math.max(0, Math.min(99, reps || 0)),
      weight: 0,
      completed: false,
    }));
  };

  const handleAddExercise = useCallback((catalogExo) => {
    if (!catalogExo) return;
    setExercises((prev) => [
      ...prev,
      {
        ...catalogExo,
        sets: buildSets(4, 10), // valeurs par défaut éditables
        notes: '',
        groupId: null,
      },
    ]);
  }, []);

  const handleRemoveExercise = useCallback((index) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSetsChange = useCallback((index, newCount) => {
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== index) return ex;
      const reps = (ex.sets && ex.sets[0] && ex.sets[0].reps) || 0;
      return { ...ex, sets: buildSets(newCount, reps) };
    }));
  }, []);

  const handleRepsChange = useCallback((index, newReps) => {
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== index) return ex;
      const setsArr = Array.isArray(ex.sets) ? ex.sets : [];
      return {
        ...ex,
        sets: setsArr.map((s) => ({ ...s, reps: newReps, weight: 0, completed: false })),
      };
    }));
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Nom requis', 'Donne un nom à ta séance.');
      return;
    }
    if (exercises.length === 0) {
      Alert.alert('Au moins un exercice', 'Ajoute au moins un exercice avant de sauvegarder.');
      return;
    }
    setSaving(true);
    try {
      await createSavedWorkout({
        name: trimmed,
        description: '',
        exercises,
        isManual: true,
      });
      Alert.alert(
        'Séance créée',
        `"${trimmed}" est dans tes séances. Tu peux la lancer depuis la page Séances.`,
        [
          { text: 'OK', onPress: () => navigation && navigation.goBack() },
        ],
      );
    } catch (e) {
      Alert.alert('Erreur', e && e.message ? e.message : 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  }, [name, exercises, createSavedWorkout, navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation && navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer une séance</Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={styles.label}>Nom de la séance</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex. Push lourd, Jambes lundi…"
              placeholderTextColor={Colors.textMuted}
              style={styles.nameInput}
              underlineColorAndroid="transparent"
              autoCorrect
            />
          </View>

          <View style={styles.field}>
            <View style={styles.exoSectionHeader}>
              <Text style={styles.label}>Exercices</Text>
              <Text style={styles.labelCount}>
                {exercises.length === 0 ? 'Aucun pour l\'instant' : `${exercises.length} ajouté${exercises.length > 1 ? 's' : ''}`}
              </Text>
            </View>

            {exercises.length === 0 ? (
              <View style={styles.emptyExos}>
                <Ionicons name="layers-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyExosText}>
                  Construis ta séance en ajoutant tes exercices un par un.
                </Text>
              </View>
            ) : (
              exercises.map((ex, i) => (
                <ExerciseRow
                  key={`${ex.id || 'ex'}-${i}`}
                  exercise={ex}
                  index={i}
                  onRemove={handleRemoveExercise}
                  onSetsChange={handleSetsChange}
                  onRepsChange={handleRepsChange}
                />
              ))
            )}

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addBtnText}>Ajouter un exercice</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerSpacer} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, (saving || exercises.length === 0 || !name.trim()) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || exercises.length === 0 || !name.trim()}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="bookmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Enregistrer la séance</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <AddExerciseSheet
          visible={sheetVisible}
          mode="add"
          onClose={() => setSheetVisible(false)}
          onSelect={handleAddExercise}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f27',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSide: { width: 26 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  field: {
    marginBottom: 22,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  labelCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  nameInput: {
    backgroundColor: Colors.card,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },

  exoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  emptyExos: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginBottom: 12,
  },
  emptyExosText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },

  exoCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  exoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exoIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0e0e12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exoEmoji: { fontSize: 22 },
  exoContent: { flex: 1 },
  exoName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  exoMuscle: {
    fontSize: 12,
    marginTop: 2,
  },
  exoPrimary: {
    color: Colors.primary,
    fontWeight: '600',
  },
  exoSecondary: {
    color: Colors.textSecondary,
  },
  exoEquip: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  exoRemove: {
    marginLeft: 6,
  },

  exoTargets: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#23232b',
  },
  targetField: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e0e12',
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  repsInput: {
    backgroundColor: '#0e0e12',
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderRadius: 10,
    minWidth: 56,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  addBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },

  footerSpacer: { height: 100 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 26,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1f1f27',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});
