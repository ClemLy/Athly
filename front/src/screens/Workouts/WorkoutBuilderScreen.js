import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import {
  EQUIPMENTS,
  LEVELS,
  pickExerciseIcon,
} from '../../constants/exerciseFilters';
import SelectableChip from '../../components/workouts/SelectableChip';
import MuscleHierarchyPicker from '../../components/workouts/MuscleHierarchyPicker';
import { useCustomExercises } from '../../context/CustomExercisesContext';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';
import { useSavedWorkouts } from '../../context/SavedWorkoutsContext';
import { generateWorkout } from '../../data/exerciseCatalog';

const DURATIONS = [
  { id: 30, label: '30 min' },
  { id: 45, label: '45 min' },
  { id: 60, label: '60 min' },
  { id: 75, label: '75 min' },
  { id: 90, label: '90 min' },
];

export default function WorkoutBuilderScreen({ navigation }) {
  const { items: customExercises } = useCustomExercises();
  const { loadWorkout } = useWorkoutInProgress();
  const { create: createSavedWorkout } = useSavedWorkouts();

  const [subMuscles, setSubMuscles] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [level, setLevel] = useState('');
  const [duration, setDuration] = useState(60);
  const [regenKey, setRegenKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const toggleArr = useCallback((arr, value) => (
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
  ), []);

  // Régénère le preview à chaque changement de critère + à chaque tap sur ↻
  const preview = useMemo(() => {
    if (subMuscles.length === 0) return null;
    return generateWorkout({
      subMuscles,
      equipment,
      level,
      durationMin: duration,
      customExercises,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subMuscles.join('|'), equipment.join('|'), level, duration, customExercises, regenKey]);

  const onRegenerate = useCallback(() => {
    setRegenKey((k) => k + 1);
  }, []);

  const onLaunch = useCallback(() => {
    if (!preview || preview.exercises.length === 0) return;
    loadWorkout(preview);
    if (navigation) navigation.navigate('Workout', { workout: preview });
  }, [preview, loadWorkout, navigation]);

  const onSave = useCallback(async () => {
    if (!preview || preview.exercises.length === 0) return;
    setSaving(true);
    try {
      await createSavedWorkout({
        name: preview.name,
        description: preview.description,
        exercises: preview.exercises,
      });
      Alert.alert(
        'Sauvegardé',
        `"${preview.name}" est dans tes séances. Retrouve-la dans la page Séances.`,
        [{ text: 'OK' }],
      );
    } catch (e) {
      Alert.alert('Erreur', e && e.message ? e.message : 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  }, [preview, createSavedWorkout]);

  const totalSelectedCount = subMuscles.length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation && navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crée ta séance</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Section
          title="Muscles à travailler"
          subtitle={totalSelectedCount === 0
            ? 'Choisis un groupe puis affine'
            : `${totalSelectedCount} sous-muscle${totalSelectedCount > 1 ? 's' : ''} sélectionné${totalSelectedCount > 1 ? 's' : ''}`}
        >
          <MuscleHierarchyPicker
            mode="multi"
            selected={subMuscles}
            onChange={setSubMuscles}
            showSelectAll
          />
        </Section>

        <Section title="Équipement disponible" subtitle="Optionnel">
          <View style={styles.chipsWrap}>
            {EQUIPMENTS.map((eq) => (
              <SelectableChip
                key={eq.id}
                label={eq.label}
                selected={equipment.includes(eq.label)}
                onPress={() => setEquipment((s) => toggleArr(s, eq.label))}
              />
            ))}
          </View>
        </Section>

        <Section title="Niveau" subtitle="Filtre les exos trop difficiles">
          <View style={styles.chipsWrap}>
            {LEVELS.map((lv) => (
              <SelectableChip
                key={lv.id}
                label={lv.label}
                selected={level === lv.id}
                onPress={() => setLevel(level === lv.id ? '' : lv.id)}
              />
            ))}
          </View>
        </Section>

        <Section title="Durée cible">
          <View style={styles.chipsWrap}>
            {DURATIONS.map((d) => (
              <SelectableChip
                key={d.id}
                label={d.label}
                selected={duration === d.id}
                onPress={() => setDuration(d.id)}
              />
            ))}
          </View>
        </Section>

        <View style={styles.previewBlock}>
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderLeft}>
              <Text style={styles.previewTitle}>Aperçu</Text>
              {preview ? (
                <Text style={styles.previewCount}>
                  {preview.exercises.length} exercices • ~{duration} min
                </Text>
              ) : null}
            </View>
            {preview && preview.exercises.length > 0 ? (
              <View style={styles.previewActions}>
                <TouchableOpacity
                  onPress={onSave}
                  style={[styles.previewActionBtn, saving && styles.previewActionDisabled]}
                  activeOpacity={0.85}
                  disabled={saving}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="bookmark-outline" size={15} color={Colors.primary} />
                  <Text style={styles.previewActionText}>{saving ? '...' : 'Sauver'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onRegenerate}
                  style={styles.previewActionBtn}
                  activeOpacity={0.85}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="shuffle" size={15} color={Colors.primary} />
                  <Text style={styles.previewActionText}>Mélanger</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {!preview ? (
            <View style={styles.previewEmpty}>
              <Ionicons name="construct-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.previewEmptyText}>
                Sélectionne au moins un sous-muscle pour générer la séance.
              </Text>
            </View>
          ) : preview.exercises.length === 0 ? (
            <View style={styles.previewEmpty}>
              <Ionicons name="alert-circle-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.previewEmptyText}>
                Aucun exercice ne correspond. Élargis ta sélection ou retire des contraintes.
              </Text>
            </View>
          ) : (
            preview.exercises.map((ex, i) => (
              <View key={`prev-${i}-${ex.id || ''}`} style={styles.previewItem}>
                <View style={styles.previewIconBox}>
                  <Text style={styles.previewIcon}>{pickExerciseIcon(ex)}</Text>
                </View>
                <View style={styles.previewItemContent}>
                  <Text style={styles.previewItemName} numberOfLines={1}>{ex.name}</Text>
                  <Text style={styles.previewItemMuscle} numberOfLines={1}>
                    <Text style={styles.previewItemPrimary}>{ex.targetMuscle}</Text>
                    {Array.isArray(ex.secondaryMuscles) && ex.secondaryMuscles.length > 0
                      ? `  •  ${ex.secondaryMuscles.join(', ')}`
                      : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.launchBtn, (!preview || preview.exercises.length === 0) && styles.launchBtnDisabled]}
          onPress={onLaunch}
          disabled={!preview || preview.exercises.length === 0}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={styles.launchBtnText}>Lancer la séance</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  section: {
    marginBottom: 26,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    flexShrink: 1,
    marginLeft: 8,
    textAlign: 'right',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  previewBlock: {
    marginTop: 4,
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  previewHeaderLeft: { flex: 1 },
  previewTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  previewCount: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(254, 116, 57, 0.45)',
    backgroundColor: 'rgba(254, 116, 57, 0.08)',
    marginLeft: 6,
  },
  previewActionDisabled: { opacity: 0.5 },
  previewActionText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  previewEmpty: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  previewEmptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  previewIconBox: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#0e0e12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  previewIcon: { fontSize: 18 },
  previewItemContent: { flex: 1 },
  previewItemName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  previewItemMuscle: {
    fontSize: 12,
    marginTop: 2,
  },
  previewItemPrimary: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footerSpacer: { height: 110 },
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
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  launchBtnDisabled: { opacity: 0.45 },
  launchBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});
