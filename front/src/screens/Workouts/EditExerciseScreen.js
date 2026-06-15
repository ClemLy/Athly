import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { EQUIPMENTS, LEVELS } from '../../constants/exerciseFilters';
import SelectableChip from '../../components/workouts/SelectableChip';
import MuscleHierarchyPicker from '../../components/workouts/MuscleHierarchyPicker';
import { useCustomExercises } from '../../context/CustomExercisesContext';

// Form add/edit d'un exercice perso. Aligné sur la structure du catalogue (sous-muscles
// précis), donc directement compatible avec le Builder et l'algo de tri.
//
// route.params :
//   - mode : 'create' | 'edit'
//   - exerciseId : id si mode === 'edit'
//
export default function EditExerciseScreen({ route, navigation }) {
  const params = (route && route.params) || {};
  const mode = params.mode === 'edit' ? 'edit' : 'create';
  const exerciseId = params.exerciseId || null;

  const { items, create, update, remove } = useCustomExercises();
  const existing = useMemo(
    () => (exerciseId ? items.find((x) => x.id === exerciseId) : null),
    [items, exerciseId],
  );

  const [name, setName] = useState(existing ? existing.name : '');
  const [targetMuscle, setTargetMuscle] = useState(existing ? existing.targetMuscle : '');
  const [secondaryMuscles, setSecondaryMuscles] = useState(
    existing && Array.isArray(existing.secondaryMuscles) ? existing.secondaryMuscles : [],
  );
  const [equipment, setEquipment] = useState(
    existing && Array.isArray(existing.equipment) ? existing.equipment : [],
  );
  const [level, setLevel] = useState(existing ? existing.level || '' : '');
  const [videoUrl, setVideoUrl] = useState(existing ? existing.videoUrl || '' : '');
  const [notes, setNotes] = useState(existing ? existing.notes || '' : '');
  const [saving, setSaving] = useState(false);

  const toggle = useCallback((arr, value) => (
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
  ), []);

  // Auto-clean des secondaires : si on change le muscle principal, retirer ce muscle
  // des secondaires (s'il y était).
  const handleTargetChange = useCallback((label) => {
    setTargetMuscle(label);
    if (label) {
      setSecondaryMuscles((s) => s.filter((x) => x !== label));
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Donne un nom à ton exercice.');
      return;
    }
    if (!targetMuscle.trim()) {
      Alert.alert('Muscle principal requis', 'Sélectionne le sous-muscle principal travaillé.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        targetMuscle: targetMuscle.trim(),
        secondaryMuscles,
        equipment,
        level,
        videoUrl: videoUrl.trim(),
        notes: notes.trim(),
      };
      if (mode === 'edit' && exerciseId) {
        await update(exerciseId, payload);
      } else {
        await create(payload);
      }
      if (navigation) navigation.goBack();
    } catch (e) {
      Alert.alert('Erreur', e && e.message ? e.message : 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  }, [name, targetMuscle, secondaryMuscles, equipment, level, videoUrl, notes, mode, exerciseId, create, update, navigation]);

  const handleDelete = useCallback(() => {
    if (!exerciseId) return;
    Alert.alert(
      'Supprimer',
      `Supprimer "${name || 'cet exercice'}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(exerciseId);
              if (navigation) navigation.goBack();
            } catch (e) {
              Alert.alert('Erreur', e && e.message ? e.message : 'Suppression impossible');
            }
          },
        },
      ],
    );
  }, [exerciseId, name, remove, navigation]);

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
          <Text style={styles.headerTitle}>
            {mode === 'edit' ? 'Modifier' : 'Nouvel exercice'}
          </Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Field label="Nom de l'exercice">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex. Développé couché incliné prise serrée"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              underlineColorAndroid="transparent"
              autoCorrect
            />
          </Field>

          <Field
            label="Muscle principal"
            subtitle="(sélectionne un sous-muscle précis)"
          >
            <MuscleHierarchyPicker
              mode="single"
              selected={targetMuscle}
              onChange={handleTargetChange}
              autoExpandSelected
            />
          </Field>

          <Field
            label="Muscles secondaires"
            subtitle="(optionnel, plusieurs possibles)"
          >
            <MuscleHierarchyPicker
              mode="multi"
              selected={secondaryMuscles}
              onChange={setSecondaryMuscles}
              excludeLabels={targetMuscle ? [targetMuscle] : []}
              showSelectAll={false}
              autoExpandSelected
            />
          </Field>

          <Field label="Équipement" subtitle="(plusieurs possibles)">
            <View style={styles.chipsWrap}>
              {EQUIPMENTS.map((eq) => (
                <SelectableChip
                  key={eq.id}
                  label={eq.label}
                  selected={equipment.includes(eq.label)}
                  onPress={() => setEquipment((s) => toggle(s, eq.label))}
                />
              ))}
            </View>
          </Field>

          <Field label="Niveau">
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
          </Field>

          <Field label="Lien vidéo (YouTube)" subtitle="(optionnel)">
            <TextInput
              value={videoUrl}
              onChangeText={setVideoUrl}
              placeholder="https://youtube.com/..."
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              underlineColorAndroid="transparent"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Field>

          <Field label="Notes" subtitle="(optionnel)">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Astuces, technique, à éviter..."
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
              underlineColorAndroid="transparent"
            />
          </Field>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {mode === 'edit' ? 'Enregistrer' : "Créer l'exercice"}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'edit' ? (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDelete}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
              <Text style={styles.deleteBtnText}>Supprimer</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, subtitle, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {subtitle ? <Text style={styles.subtitle}>{`  ${subtitle}`}</Text> : null}
      </Text>
      {children}
    </View>
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
    paddingBottom: 60,
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
  subtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.card,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  textarea: {
    minHeight: 96,
    paddingTop: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  deleteBtnText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
});
