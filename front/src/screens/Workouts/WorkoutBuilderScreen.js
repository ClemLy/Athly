import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { EQUIPMENTS, LEVELS, MUSCLE_GROUPS } from '../../constants/exerciseFilters';
import SelectableChip from '../../components/workouts/SelectableChip';
import MuscleHierarchyPicker from '../../components/workouts/MuscleHierarchyPicker';
import { useCustomExercises } from '../../context/CustomExercisesContext';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';
import { useSavedWorkouts } from '../../context/SavedWorkoutsContext';
import { useToast } from '../../context/ToastContext';
import { generateWorkout, exerciseCountFor } from '../../data/exerciseCatalog';
import { PRESETS, activePresetId, groupState, toggleGroup, swapExercise } from '../../data/workoutBuilder';
import InfoModal from '../../components/common/InfoModal';
import { getErrorMessage } from '../../utils/errorMessages';
import { plural } from '../../utils/format';

const DURATIONS = [30, 45, 60, 75, 90];

// ─── WorkoutBuilderScreen ─────────────────────────────────────────────────────
// « Crée ta séance » en un coup d'œil : un préréglage ou quelques groupes
// musculaires, une durée, et la séance se compose sous tes yeux. Tout le reste
// (sous-muscles, matériel, niveau) est facultatif et replié. L'aperçu est
// modifiable exercice par exercice, et « Lancer » est toujours à portée.

export default function WorkoutBuilderScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  // Petits téléphones : tuiles et barre du bas plus compactes.
  const compact = winH < 720 || winW < 360;
  const { items: customExercises } = useCustomExercises();
  const { loadWorkout } = useWorkoutInProgress();
  const { create: createSavedWorkout, update: updateSavedWorkout, remove: removeSavedWorkout } = useSavedWorkouts();
  const { showToast } = useToast();

  // Édition d'une séance existante (WorkoutList → « Modifier ») : critères et
  // exercices d'origine pré-remplis.
  const editWorkout = route?.params?.editWorkout ?? null;
  const editCriteria = editWorkout?.criteria ?? null;

  const [subMuscles, setSubMuscles] = useState(editCriteria?.subMuscles ?? []);
  const [equipment, setEquipment] = useState(editCriteria?.equipment ?? []);
  const [level, setLevel] = useState(editCriteria?.level ?? '');
  const [duration, setDuration] = useState(editCriteria?.durationMin ?? 60);
  const [regenKey, setRegenKey] = useState(0);
  const [name, setName] = useState(editWorkout?.name ?? '');
  const [fineOpen, setFineOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(!!(editCriteria?.equipment?.length || editCriteria?.level));
  const [saving, setSaving] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [savedWorkoutId, setSavedWorkoutId] = useState(editWorkout?.id ?? null);
  const [editingId, setEditingId] = useState(editWorkout?.id ?? null);

  const presetId = activePresetId(subMuscles);
  const genKey = [subMuscles.join('|'), equipment.join('|'), level, duration, regenKey].join('#');
  // Exercices retouchés à la main (retirés / remplacés) : valables tant que les
  // critères ne changent pas. En édition, on repart des exercices enregistrés.
  const [edit, setEdit] = useState(() => (
    editWorkout?.exercises?.length ? { key: genKey, exercises: editWorkout.exercises } : null
  ));

  const generated = useMemo(() => {
    if (subMuscles.length === 0) return null;
    return generateWorkout({ subMuscles, equipment, level, durationMin: duration, customExercises });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genKey, customExercises]);

  const exercises = edit && edit.key === genKey ? edit.exercises : (generated ? generated.exercises : []);
  const hasWorkout = subMuscles.length > 0 && exercises.length > 0;
  const presetLabel = presetId ? PRESETS.find((p) => p.id === presetId).label : null;
  const fullGroups = MUSCLE_GROUPS.filter((g) => groupState(g.id, subMuscles).state === 'all');
  const autoName = presetLabel
    ? `Séance ${presetLabel}`
    : fullGroups.length === 1 && subMuscles.length === fullGroups[0].subMuscles.length
      ? `Séance ${fullGroups[0].label}`
      : generated ? generated.name : 'Séance personnalisée';
  const finalName = name.trim() || autoName;
  const criteria = useMemo(
    () => ({ subMuscles, equipment, level, durationMin: duration }),
    [subMuscles, equipment, level, duration],
  );

  const invalidateSaved = useCallback(() => setSavedWorkoutId(null), []);
  const changeCriteria = (fn) => { fn(); invalidateSaved(); };
  const toggleArr = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);


  // ── Retouches de l'aperçu ──
  const removeAt = (i) => {
    setEdit({ key: genKey, exercises: exercises.filter((_, idx) => idx !== i) });
    invalidateSaved();
  };
  const swapAt = (i) => {
    const next = swapExercise(exercises, i, criteria, customExercises);
    if (!next) { showToast('Pas d\'autre exercice qui corresponde à tes critères.', 'info'); return; }
    setEdit({ key: genKey, exercises: exercises.map((e, idx) => (idx === i ? next : e)) });
    invalidateSaved();
  };
  const shuffle = () => { setEdit(null); setRegenKey((k) => k + 1); invalidateSaved(); };

  const buildWorkout = () => ({
    ...(generated || {}),
    name: finalName,
    description: generated ? generated.description : '',
    exercises,
    notes: '',
    status: 'in_progress',
    durationSeconds: 0,
  });

  const onLaunch = () => {
    if (!hasWorkout) return;
    const workout = buildWorkout();
    loadWorkout(workout);
    if (navigation) navigation.navigate('Workout', { workout });
  };

  const persist = async () => {
    const workout = buildWorkout();
    const payload = { name: finalName, description: workout.description, exercises, criteria };
    return editingId ? updateSavedWorkout(editingId, payload) : createSavedWorkout(payload);
  };

  const onToggleSave = async () => {
    if (!hasWorkout) return;
    setSaving(true);
    try {
      if (savedWorkoutId) {
        await removeSavedWorkout(savedWorkoutId);
        setSavedWorkoutId(null);
        setEditingId(null);
        showToast('Séance retirée de ta liste.', 'success');
      } else {
        const item = await persist();
        setSavedWorkoutId(item.id);
        setEditingId(item.id);
        showToast('Séance enregistrée dans « Mes séances ».', 'success');
      }
    } catch (e) {
      setInfoModal({ title: 'Action impossible', body: getErrorMessage(e, 'L\'opération n\'a pas abouti. Réessaie dans un instant.') });
    } finally {
      setSaving(false);
    }
  };

  const summary = (list) => (list.length ? list.join(', ') : null);
  const footerHint = subMuscles.length === 0 ? 'Choisis un groupe musculaire' : 'Aucun exercice à lancer';
  const optionsSummary = [summary(equipment), level ? LEVELS.find((l) => l.id === level)?.label : null]
    .filter(Boolean).join(' · ') || 'Aucune contrainte';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Retour" accessibilityRole="button" style={styles.backBtn}
          onPress={() => navigation && navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">{editWorkout ? 'Modifier ta séance' : 'Crée ta séance'}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ── 1. Départ rapide ── */}
        <Text style={styles.stepTitle}>Départ rapide</Text>
        <View style={styles.presetRow}>
          {PRESETS.map((p) => {
            const active = presetId === p.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${p.label} : ${p.hint}`}
                onPress={() => changeCriteria(() => setSubMuscles(active ? [] : p.subMuscles))}
                style={({ pressed }) => [styles.preset, active && styles.presetActive, pressed && { opacity: 0.8 }]}
              >
                <Text style={[styles.presetLabel, active && styles.presetLabelActive]} numberOfLines={1}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hintText}>
          {presetId ? PRESETS.find((p) => p.id === presetId).hint : "Un appui compose la séance, tu pourras l'ajuster."}
        </Text>

        {/* ── 2. Muscles ── */}
        <View style={styles.stepHead}>
          <Text style={styles.stepTitle}>Muscles à travailler</Text>
          {subMuscles.length > 0 ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => changeCriteria(() => setSubMuscles([]))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.link}>Tout effacer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.grid}>
          {MUSCLE_GROUPS.map((g) => {
            const st = groupState(g.id, subMuscles);
            const on = st.state !== 'none';
            return (
              <Pressable
                key={g.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: st.state === 'all' ? true : st.state === 'partial' ? 'mixed' : false }}
                accessibilityLabel={`${g.label}${st.state === 'partial' ? `, ${st.count} sur ${st.total}` : ''}`}
                onPress={() => changeCriteria(() => setSubMuscles(toggleGroup(g.id, subMuscles)))}
                style={({ pressed }) => [styles.tile, compact && styles.tileCompact, on && styles.tileOn, pressed && { opacity: 0.8 }]}
              >
                <Text style={[styles.tileLabel, on && styles.tileLabelOn]}>{g.label}</Text>
                <Text style={[styles.tileSub, on && { color: Colors.primary }]}>
                  {st.state === 'all' ? 'Tout' : st.state === 'partial' ? `${st.count}/${st.total}` : `${st.total} muscles`}
                </Text>
                {on ? <Ionicons name="checkmark-circle" size={18} color={Colors.primary} style={styles.tileCheck} /> : null}
              </Pressable>
            );
          })}
        </View>
        {subMuscles.length === 0 ? (
          <Text style={styles.hintText}>Touche un groupe, ou choisis un départ rapide ci-dessus.</Text>
        ) : null}

        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: fineOpen }} style={styles.disclosure} onPress={() => setFineOpen((v) => !v)} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.disclosureTitle}>Affiner par muscle</Text>
            <Text style={styles.disclosureSub}>Ex : seulement le haut des pectoraux</Text>
          </View>
          <Ionicons name={fineOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        {fineOpen ? (
          <View style={{ marginTop: 10 }}>
            <MuscleHierarchyPicker
              mode="multi"
              selected={subMuscles}
              onChange={(v) => changeCriteria(() => setSubMuscles(v))}
              showSelectAll
              autoExpandSelected
            />
          </View>
        ) : null}

        {/* ── 3. Durée ── */}
        <Text style={[styles.stepTitle, styles.stepSpaced]}>Durée</Text>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {DURATIONS.map((d) => {
            const active = duration === d;
            return (
              <Pressable
                key={d}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => changeCriteria(() => setDuration(d))}
                style={[styles.segBtn, active && styles.segBtnOn]}
              >
                <Text style={[styles.segTxt, active && styles.segTxtOn]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hintText}>minutes · environ {plural(exerciseCountFor(duration), 'exercice')}</Text>

        {/* ── 4. Options ── */}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: optionsOpen }} style={[styles.disclosure, styles.stepSpaced]} onPress={() => setOptionsOpen((v) => !v)} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.disclosureTitle}>Matériel et niveau</Text>
            <Text style={styles.disclosureSub} numberOfLines={1}>{optionsSummary}</Text>
          </View>
          <Ionicons name={optionsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        {optionsOpen ? (
          <View style={styles.optionsBody}>
            <Text style={styles.optLabel}>Matériel dispo <Text style={styles.optNote}>(aucun choix = tout)</Text></Text>
            <View style={styles.chipsWrap}>
              {EQUIPMENTS.map((eq) => (
                <SelectableChip key={eq.id} label={eq.label} selected={equipment.includes(eq.label)}
                  onPress={() => changeCriteria(() => setEquipment((s) => toggleArr(s, eq.label)))} />
              ))}
            </View>
            <Text style={[styles.optLabel, { marginTop: 8 }]}>Ton niveau <Text style={styles.optNote}>(écarte les exercices trop durs)</Text></Text>
            <View style={styles.chipsWrap}>
              {LEVELS.map((lv) => (
                <SelectableChip key={lv.id} label={lv.label} selected={level === lv.id}
                  onPress={() => changeCriteria(() => setLevel(level === lv.id ? '' : lv.id))} />
              ))}
            </View>
          </View>
        ) : null}

        {/* ── 5. Ta séance ── */}
        {subMuscles.length > 0 ? (
          <View style={styles.preview}>
            <View style={styles.previewHead}>
              <Text style={styles.stepTitle}>Ta séance</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.pillBtn} onPress={shuffle} activeOpacity={0.8}>
                <Ionicons name="shuffle" size={15} color={Colors.primary} />
                <Text style={styles.pillBtnTxt}>Tout mélanger</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={autoName}
              placeholderTextColor={Colors.textMuted}
              style={styles.nameInput}
              maxLength={60}
              accessibilityLabel="Nom de la séance"
              underlineColorAndroid="transparent"
            />

            {exercises.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="alert-circle-outline" size={26} color={Colors.textMuted} />
                <Text style={styles.emptyTxt}>
                  {edit && edit.key === genKey
                    ? 'Tous les exercices ont été retirés. Touche « Tout mélanger » pour en proposer de nouveaux.'
                    : 'Aucun exercice ne correspond. Élargis tes muscles ou retire du matériel / le niveau.'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.previewMeta}>{plural(exercises.length, 'exercice')} · ~{duration} min</Text>
                {exercises.map((ex, i) => (
                  <View key={`${ex.id}-${i}`} style={[styles.exRow, i > 0 && styles.exRowBorder]}>
                    <Text style={styles.exIndex}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exName} numberOfLines={2}>{ex.name}</Text>
                      <Text style={styles.exMuscle} numberOfLines={1}>
                        {ex.targetMuscle}{ex.equipment && ex.equipment[0] ? ` · ${ex.equipment[0]}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remplacer ${ex.name}`} style={styles.iconBtn} onPress={() => swapAt(i)}>
                      <Ionicons name="swap-horizontal" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Retirer ${ex.name}`} style={styles.iconBtn} onPress={() => removeAt(i)}>
                      <Ionicons name="close" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.saveRow, savedWorkoutId && styles.saveRowOn, saving && { opacity: 0.6 }]}
                  onPress={onToggleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <Ionicons name={savedWorkoutId ? 'bookmark' : 'bookmark-outline'} size={18} color={Colors.primary} />
                  <Text style={styles.saveRowTxt}>
                    {saving ? 'Enregistrement…' : savedWorkoutId ? 'Enregistrée dans « Mes séances »' : 'Enregistrer dans « Mes séances »'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        <View style={{ height: 90 + insets.bottom }} />
      </ScrollView>

      {/* ── Action : un seul bouton, il porte le résumé ── */}
      <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasWorkout }}
          accessibilityLabel={hasWorkout ? `Lancer la séance, ${plural(exercises.length, 'exercice')}, environ ${duration} minutes` : footerHint}
          style={[styles.launchBtn, compact && styles.launchBtnCompact, !hasWorkout && styles.launchBtnOff]}
          onPress={onLaunch}
          disabled={!hasWorkout}
          activeOpacity={0.85}
        >
          {hasWorkout ? (
            <>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.launchTxt} numberOfLines={1}>Lancer · {plural(exercises.length, 'exercice')} · ~{duration} min</Text>
            </>
          ) : (
            <Text style={[styles.launchTxt, { color: Colors.textMuted }]} numberOfLines={1}>{footerHint}</Text>
          )}
        </TouchableOpacity>
      </View>

      <InfoModal
        visible={!!infoModal}
        icon="alert-circle-outline"
        title={infoModal?.title}
        body={infoModal?.body}
        destructive
        onClose={() => setInfoModal(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 2, paddingBottom: 6 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },

  stepHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  stepTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  stepSpaced: { marginTop: 24 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  hintText: { color: Colors.textMuted, fontSize: 13.5, marginTop: 8 },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    height: 42, paddingHorizontal: 16, borderRadius: 21, justifyContent: 'center',
    backgroundColor: Colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  presetActive: { borderColor: Colors.primary, backgroundColor: 'rgba(254,116,57,0.12)' },
  presetLabel: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  presetLabelActive: { color: Colors.primary, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%', flexGrow: 1, minHeight: 72, padding: 14, borderRadius: 16, justifyContent: 'center',
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  tileOn: { borderColor: Colors.primary, backgroundColor: 'rgba(254,116,57,0.10)' },
  tileCompact: { minHeight: 56, paddingVertical: 8, paddingHorizontal: 12 },
  tileLabel: { color: Colors.textPrimary, fontSize: 16.5, fontWeight: '800' },
  tileLabelOn: { color: Colors.textPrimary },
  tileSub: { color: Colors.textMuted, fontSize: 13, marginTop: 2, fontWeight: '600' },
  tileCheck: { position: 'absolute', top: 10, right: 10 },

  disclosure: {
    flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, marginTop: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  disclosureTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  disclosureSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  optionsBody: { marginTop: 12 },
  optLabel: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 10 },
  optNote: { color: Colors.textMuted, fontWeight: '500' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },

  segment: {
    flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  segBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: Colors.primary },
  segTxt: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700' },
  segTxtOn: { color: '#fff', fontWeight: '800' },

  preview: {
    marginTop: 28, padding: 16, borderRadius: 20,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: 'rgba(254,116,57,0.25)',
  },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 17, marginBottom: 10,
    backgroundColor: 'rgba(254,116,57,0.10)', borderWidth: 1, borderColor: 'rgba(254,116,57,0.40)',
  },
  pillBtnTxt: { color: Colors.primary, fontSize: 13.5, fontWeight: '700' },
  nameInput: {
    height: 48, borderRadius: 12, paddingHorizontal: 14, color: Colors.textPrimary, fontSize: 15.5, fontWeight: '700',
    backgroundColor: Colors.cardInner, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  previewMeta: { color: Colors.primary, fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  exRow: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingVertical: 6, gap: 8 },
  exRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  exIndex: { width: 22, color: Colors.textMuted, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  exName: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: '700' },
  exMuscle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  iconBtn: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 22, gap: 8 },
  emptyTxt: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  saveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 14, marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  saveRowOn: { backgroundColor: 'rgba(254,116,57,0.10)', borderColor: 'rgba(254,116,57,0.45)' },
  saveRowTxt: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: '700', flexShrink: 1 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: Colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle,
  },
  launchBtn: {
    flexDirection: 'row', gap: 8, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  launchBtnCompact: { height: 48, borderRadius: 14 },
  launchBtnOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  launchTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
