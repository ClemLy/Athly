import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, MUSCLE_GROUP_COLORS } from '../../constants/theme';
import {
  EQUIPMENTS, LEVELS, MUSCLE_GROUPS, resolveMuscleGroup, pickExerciseIcon,
} from '../../constants/exerciseFilters';
import { BUILTIN_CATALOG } from '../../data/exerciseCatalog';
import { indexExercise, findSimilarExercises, normalizeText } from '../../data/exerciseSearch';
import { useCustomExercises } from '../../context/CustomExercisesContext';
import { ConfirmModal, InfoModal } from '../../components/common';
import { getErrorMessage } from '../../utils/errorMessages';

// Création / modification d'un exercice perso. Aligné sur la structure du
// catalogue (sous-muscles précis), donc directement compatible avec le
// Builder, la recherche et l'algo de tri.
//  - Le nom se tape dans la carte d'aperçu, qui se met à jour en direct.
//  - Si le nom ressemble à un exercice du catalogue, on propose d'en reprendre
//    les réglages (muscles, matériel, niveau) en un geste.
//  - Muscle principal en deux touches : la zone, puis le muscle précis.
//  - Le reste (muscles secondaires, vidéo, notes) est facultatif et replié.
//  - Bouton d'enregistrement toujours visible ; quitter avec des changements
//    non enregistrés demande confirmation.
//
// route.params :
//   - mode : 'create' | 'edit'
//   - exerciseId : id si mode === 'edit'
//

const CATALOG_INDEX = BUILTIN_CATALOG.map(indexExercise);
const CATALOG_NAMES = new Set(BUILTIN_CATALOG.map((e) => normalizeText(e.name)));
const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.id, l.label]));
const URL_RE = /^https?:\/\/\S+\.\S+$/i;

const sameList = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export default function EditExerciseScreen({ route, navigation }) {
  const params = (route && route.params) || {};
  const mode = params.mode === 'edit' ? 'edit' : 'create';
  const exerciseId = params.exerciseId || null;
  const insets = useSafeAreaInsets();

  const { items, create, update, remove } = useCustomExercises();
  const existing = useMemo(
    () => (exerciseId ? items.find((x) => x.id === exerciseId) : null),
    [items, exerciseId],
  );

  const initial = useMemo(() => ({
    name: existing ? existing.name : '',
    targetMuscle: existing ? existing.targetMuscle || '' : '',
    secondaryMuscles: existing && Array.isArray(existing.secondaryMuscles) ? existing.secondaryMuscles : [],
    equipment: existing && Array.isArray(existing.equipment) ? existing.equipment : [],
    level: existing ? existing.level || '' : '',
    videoUrl: existing ? existing.videoUrl || '' : '',
    notes: existing ? existing.notes || '' : '',
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [existing && existing.id]);

  const [name, setName] = useState(initial.name);
  const [targetMuscle, setTargetMuscle] = useState(initial.targetMuscle);
  const [secondaryMuscles, setSecondaryMuscles] = useState(initial.secondaryMuscles);
  const [equipment, setEquipment] = useState(initial.equipment);
  const [level, setLevel] = useState(initial.level);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl);
  const [notes, setNotes] = useState(initial.notes);

  const [secondaryOpen, setSecondaryOpen] = useState(initial.secondaryMuscles.length > 0);
  const [extrasOpen, setExtrasOpen] = useState(!!(initial.videoUrl || initial.notes));
  const [showErrors, setShowErrors] = useState(false);
  const [applied, setApplied] = useState(null); // { from, previous }
  const [saving, setSaving] = useState(false);
  const [infoModal, setInfoModal] = useState(null); // { title, body }
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);

  const scrollRef = useRef(null);
  const muscleY = useRef(0);
  const allowExitRef = useRef(false);
  const pendingNavActionRef = useRef(null);

  const group = resolveMuscleGroup(targetMuscle);
  const tone = (group && MUSCLE_GROUP_COLORS[group]) || Colors.primary;

  // ─── Validation ────────────────────────────────────────────────────────────
  const trimmedName = name.trim();
  const nameKey = normalizeText(trimmedName);
  const duplicateCustom = !!nameKey && items.some((x) => x.id !== exerciseId && normalizeText(x.name) === nameKey);
  const duplicateCatalog = !!nameKey && CATALOG_NAMES.has(nameKey);
  const videoInvalid = !!videoUrl.trim() && !URL_RE.test(videoUrl.trim());

  const nameError = !trimmedName
    ? 'Donne un nom à ton exercice.'
    : duplicateCustom
      ? 'Tu as déjà un exercice perso avec ce nom.'
      : duplicateCatalog
        ? 'Cet exercice existe déjà dans le catalogue : tu le trouves directement en recherche.'
        : null;
  const muscleError = !targetMuscle ? 'Choisis le muscle principal travaillé.' : null;
  const canSave = !nameError && !muscleError && !videoInvalid;

  const missingHint = !trimmedName && !targetMuscle
    ? 'Il manque le nom et le muscle principal'
    : !trimmedName ? 'Il manque le nom'
      : !targetMuscle ? 'Il manque le muscle principal' : null;

  const dirty = name !== initial.name
    || targetMuscle !== initial.targetMuscle
    || !sameList(secondaryMuscles, initial.secondaryMuscles)
    || !sameList(equipment, initial.equipment)
    || level !== initial.level
    || videoUrl !== initial.videoUrl
    || notes !== initial.notes;

  // ─── Suggestion depuis le catalogue ────────────────────────────────────────
  const suggestion = useMemo(() => {
    if (mode !== 'create' || trimmedName.length < 3 || duplicateCatalog) return null;
    const hit = findSimilarExercises(CATALOG_INDEX, trimmedName, 1)[0];
    return hit ? hit.ex : null;
  }, [mode, trimmedName, duplicateCatalog]);

  const suggestionAlreadyMatches = suggestion
    && suggestion.targetMuscle === targetMuscle
    && sameList(suggestion.equipment || [], equipment);

  const applySuggestion = useCallback(() => {
    if (!suggestion) return;
    setApplied({
      from: suggestion.name,
      previous: { targetMuscle, secondaryMuscles, equipment, level },
    });
    setTargetMuscle(suggestion.targetMuscle || '');
    setSecondaryMuscles((suggestion.secondaryMuscles || []).filter((m) => m !== suggestion.targetMuscle));
    setEquipment(suggestion.equipment || []);
    setLevel(suggestion.level || '');
  }, [suggestion, targetMuscle, secondaryMuscles, equipment, level]);

  const undoSuggestion = useCallback(() => {
    if (!applied) return;
    const p = applied.previous;
    setTargetMuscle(p.targetMuscle);
    setSecondaryMuscles(p.secondaryMuscles);
    setEquipment(p.equipment);
    setLevel(p.level);
    setApplied(null);
  }, [applied]);

  // ─── Champs ────────────────────────────────────────────────────────────────
  const handleTargetChange = useCallback((label) => {
    setTargetMuscle(label);
    if (label) setSecondaryMuscles((s) => s.filter((x) => x !== label));
  }, []);

  const toggleIn = (setter) => (value) => setter((arr) => (
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
  ));

  // ─── Quitter sans enregistrer ──────────────────────────────────────────────
  useEffect(() => {
    if (!navigation) return undefined;
    return navigation.addListener('beforeRemove', (e) => {
      if (allowExitRef.current || !dirty) return;
      e.preventDefault();
      pendingNavActionRef.current = e.data.action;
      setLeaveConfirmVisible(true);
    });
  }, [navigation, dirty]);

  const leave = useCallback(() => {
    allowExitRef.current = true;
    setLeaveConfirmVisible(false);
    if (pendingNavActionRef.current) {
      navigation.dispatch(pendingNavActionRef.current);
      pendingNavActionRef.current = null;
    } else if (navigation) {
      navigation.goBack();
    }
  }, [navigation]);

  // ─── Enregistrer / supprimer ───────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!canSave) {
      setShowErrors(true);
      if (!nameError && muscleError && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, muscleY.current - 12), animated: true });
      } else if (scrollRef.current) {
        scrollRef.current.scrollTo({ y: 0, animated: true });
      }
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        targetMuscle: targetMuscle.trim(),
        secondaryMuscles,
        equipment,
        level,
        videoUrl: videoUrl.trim(),
        notes: notes.trim(),
      };
      if (mode === 'edit' && exerciseId) await update(exerciseId, payload);
      else await create(payload);
      allowExitRef.current = true;
      if (navigation) navigation.goBack();
    } catch (e) {
      setInfoModal({ title: 'Enregistrement impossible', body: getErrorMessage(e, 'Tes modifications n\'ont pas pu être enregistrées. Réessaie dans un instant.') });
    } finally {
      setSaving(false);
    }
  }, [canSave, nameError, muscleError, trimmedName, targetMuscle, secondaryMuscles, equipment, level, videoUrl, notes, mode, exerciseId, create, update, navigation]);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmVisible(false);
    try {
      await remove(exerciseId);
      allowExitRef.current = true;
      if (navigation) navigation.goBack();
    } catch (e) {
      setInfoModal({ title: 'Suppression impossible', body: getErrorMessage(e, 'L\'exercice n\'a pas pu être supprimé. Réessaie dans un instant.') });
    }
  }, [exerciseId, remove, navigation]);

  const metaParts = [targetMuscle, equipment.join(', '), LEVEL_LABEL[level]].filter(Boolean);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityLabel="Retour"
            accessibilityRole="button"
            onPress={() => navigation && navigation.goBack()}
            style={styles.headerBtn}
          >
            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {mode === 'edit' ? "Modifier l'exercice" : 'Nouvel exercice'}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Aperçu + nom ── */}
          <View style={[styles.hero, { borderColor: `${tone}55` }, showErrors && nameError && styles.heroError]}>
            <View style={styles.heroTop}>
              <View style={[styles.heroIcon, { backgroundColor: `${tone}22` }]}>
                <Ionicons name={pickExerciseIcon({ equipment, targetMuscleGroup: group })} size={26} color={tone} />
              </View>
              <View style={styles.persoBadge}>
                <Text style={styles.persoBadgeText}>PERSO</Text>
              </View>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nom de l'exercice"
              placeholderTextColor={Colors.textMuted}
              style={styles.nameInput}
              underlineColorAndroid="transparent"
              autoFocus={mode === 'create'}
              autoCapitalize="sentences"
              returnKeyType="done"
              maxLength={60}
              accessibilityLabel="Nom de l'exercice"
            />
            <Text style={[styles.heroMeta, metaParts.length === 0 && styles.heroMetaEmpty]} numberOfLines={2}>
              {metaParts.length ? metaParts.join(' · ') : 'Ex. Curl incliné prise neutre, Squat bulgare lesté…'}
            </Text>
          </View>
          {(showErrors || duplicateCustom || duplicateCatalog) && nameError ? (
            <FieldError text={nameError} />
          ) : null}

          {/* ── Suggestion ── */}
          {applied ? (
            <View style={styles.appliedRow}>
              <Ionicons name="sparkles" size={14} color={Colors.secondaryAccent} />
              <Text style={styles.appliedText} numberOfLines={2}>
                Réglages repris de « {applied.from} »
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={undoSuggestion} style={styles.undoBtn}>
                <Text style={styles.undoText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          ) : suggestion && !suggestionAlreadyMatches ? (
            <View style={styles.suggestion}>
              <View style={styles.suggestionHead}>
                <Ionicons name="sparkles" size={16} color={Colors.secondaryAccent} />
                <Text style={styles.suggestionTitle} numberOfLines={2}>
                  Ça ressemble à <Text style={styles.suggestionName}>{suggestion.name}</Text>
                </Text>
              </View>
              <Text style={styles.suggestionMeta} numberOfLines={1}>
                {[suggestion.targetMuscle, (suggestion.equipment || []).join(', '), LEVEL_LABEL[suggestion.level]].filter(Boolean).join(' · ')}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Reprendre les réglages de ${suggestion.name}`}
                style={styles.suggestionBtn}
                onPress={applySuggestion}
                activeOpacity={0.85}
              >
                <Text style={styles.suggestionBtnText}>Reprendre ses réglages</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ── Muscle principal ── */}
          <View onLayout={(e) => { muscleY.current = e.nativeEvent.layout.y; }}>
            <SectionTitle title="Muscle principal" required />
            <PrimaryMusclePicker value={targetMuscle} onChange={handleTargetChange} />
            {showErrors && muscleError ? <FieldError text={muscleError} /> : null}
          </View>

          {/* ── Matériel ── */}
          <SectionTitle title="Matériel" hint="Plusieurs choix possibles" />
          <View style={styles.wrap}>
            {EQUIPMENTS.map((eq) => (
              <Pill
                key={eq.id}
                label={eq.label}
                selected={equipment.includes(eq.label)}
                onPress={() => toggleIn(setEquipment)(eq.label)}
              />
            ))}
          </View>

          {/* ── Niveau ── */}
          <SectionTitle title="Niveau" hint="Optionnel" />
          <View style={styles.segment} accessibilityRole="radiogroup">
            {LEVELS.map((lv) => {
              const on = level === lv.id;
              return (
                <TouchableOpacity
                  key={lv.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[styles.segmentItem, on && styles.segmentItemOn]}
                  onPress={() => setLevel(on ? '' : lv.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>{lv.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Facultatif ── */}
          <Disclosure
            title="Muscles secondaires"
            subtitle={secondaryMuscles.length ? secondaryMuscles.join(', ') : 'Optionnel'}
            open={secondaryOpen}
            onToggle={() => setSecondaryOpen((o) => !o)}
          >
            {MUSCLE_GROUPS.map((g) => {
              const subs = g.subMuscles.filter((s) => s.label !== targetMuscle);
              if (!subs.length) return null;
              return (
                <View key={g.id} style={styles.secGroup}>
                  <View style={styles.secGroupHead}>
                    <View style={[styles.dot, { backgroundColor: MUSCLE_GROUP_COLORS[g.id] }]} />
                    <Text style={styles.secGroupLabel}>{g.label}</Text>
                  </View>
                  <View style={styles.wrap}>
                    {subs.map((s) => (
                      <Pill
                        key={s.id}
                        small
                        label={s.label}
                        selected={secondaryMuscles.includes(s.label)}
                        onPress={() => toggleIn(setSecondaryMuscles)(s.label)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </Disclosure>

          <Disclosure
            title="Vidéo et notes"
            subtitle={[videoUrl.trim() ? 'Vidéo ajoutée' : null, notes.trim() ? 'Notes ajoutées' : null].filter(Boolean).join(' · ') || 'Optionnel'}
            open={extrasOpen}
            onToggle={() => setExtrasOpen((o) => !o)}
          >
            <Text style={styles.inputLabel}>Lien vidéo (YouTube…)</Text>
            <TextInput
              value={videoUrl}
              onChangeText={setVideoUrl}
              placeholder="https://youtube.com/…"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, videoInvalid && styles.inputError]}
              underlineColorAndroid="transparent"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="Lien vidéo"
            />
            {videoInvalid ? <FieldError text="Colle un lien complet qui commence par https://" /> : null}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Placement, tempo, ce qu'il faut éviter…"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
              underlineColorAndroid="transparent"
              maxLength={500}
              accessibilityLabel="Notes"
            />
          </Disclosure>

          {mode === 'edit' ? (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.deleteBtn}
              onPress={() => setDeleteConfirmVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={17} color={Colors.error} />
              <Text style={styles.deleteBtnText}>Supprimer cet exercice</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        {/* ── Barre d'action ── */}
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          {missingHint ? (
            <Text style={styles.footerHint} accessibilityLiveRegion="polite">{missingHint}</Text>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave || saving }}
            style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={mode === 'edit' ? 'checkmark' : 'add'} size={20} color="#fff" />
                <Text style={styles.saveBtnText}>{mode === 'edit' ? 'Enregistrer' : "Créer l'exercice"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={deleteConfirmVisible}
        icon="trash-outline"
        title="Supprimer l'exercice ?"
        body={`« ${name || 'Cet exercice'} » disparaîtra de tes exercices. Les séances déjà faites ne changent pas.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmVisible(false)}
      />
      <ConfirmModal
        visible={leaveConfirmVisible}
        icon="create-outline"
        title="Quitter sans enregistrer ?"
        body={mode === 'edit' ? 'Tes modifications seront perdues.' : "L'exercice ne sera pas créé."}
        confirmLabel="Quitter"
        cancelLabel="Continuer"
        destructive
        onConfirm={leave}
        onCancel={() => { pendingNavActionRef.current = null; setLeaveConfirmVisible(false); }}
      />
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

// ─── Sous-composants ─────────────────────────────────────────────────────────

// Zone (groupe) puis muscle précis. La zone du muscle choisi est ouverte.
function PrimaryMusclePicker({ value, onChange }) {
  const valueGroup = resolveMuscleGroup(value);
  const [openGroup, setOpenGroup] = useState(valueGroup);
  useEffect(() => { if (valueGroup) setOpenGroup(valueGroup); }, [valueGroup]);
  const current = MUSCLE_GROUPS.find((g) => g.id === openGroup);

  return (
    <View>
      <View style={styles.wrap}>
        {MUSCLE_GROUPS.map((g) => {
          const open = g.id === openGroup;
          const holds = g.id === valueGroup;
          return (
            <TouchableOpacity
              key={g.id}
              accessibilityRole="button"
              accessibilityState={{ expanded: open, selected: holds }}
              accessibilityLabel={holds ? `${g.label}, ${value} choisi` : g.label}
              style={[styles.groupChip, open && { borderColor: MUSCLE_GROUP_COLORS[g.id], backgroundColor: `${MUSCLE_GROUP_COLORS[g.id]}1A` }]}
              onPress={() => setOpenGroup(open ? null : g.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.dot, { backgroundColor: MUSCLE_GROUP_COLORS[g.id] }]} />
              <Text style={[styles.groupChipText, open && styles.groupChipTextOn]}>{g.label}</Text>
              {holds ? <Ionicons name="checkmark-circle" size={15} color={MUSCLE_GROUP_COLORS[g.id]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {current ? (
        <View style={[styles.subPanel, { borderColor: `${MUSCLE_GROUP_COLORS[current.id]}40` }]}>
          <Text style={styles.subPanelTitle}>Quelle partie {current.id === 'dos' ? 'du dos' : `des ${current.label.toLowerCase()}`} ?</Text>
          <View style={styles.wrap}>
            {current.subMuscles.map((s) => (
              <Pill
                key={s.id}
                label={s.label}
                tone={MUSCLE_GROUP_COLORS[current.id]}
                selected={value === s.label}
                radio
                onPress={() => onChange(value === s.label ? '' : s.label)}
              />
            ))}
          </View>
        </View>
      ) : (
        <Text style={styles.pickHint}>Touche une zone pour choisir le muscle précis.</Text>
      )}
    </View>
  );
}

function Pill({ label, selected, onPress, small = false, tone = Colors.primary, radio = false }) {
  return (
    <TouchableOpacity
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: !!selected }}
      style={[
        styles.pill,
        small && styles.pillSmall,
        selected && { backgroundColor: `${tone}26`, borderColor: tone },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {selected ? <Ionicons name="checkmark" size={small ? 13 : 15} color={tone} /> : null}
      <Text style={[styles.pillText, small && styles.pillTextSmall, selected && { color: Colors.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ title, hint, required = false }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>
        {title}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

function Disclosure({ title, subtitle, open, onToggle, children }) {
  return (
    <View style={styles.disclosure}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.disclosureHead}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={styles.flex}>
          <Text style={styles.disclosureTitle}>{title}</Text>
          <Text style={styles.disclosureSub} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.chevron} />
      </TouchableOpacity>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

function FieldError({ text }) {
  return (
    <View style={styles.errorRow} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={14} color={Colors.error} />
      <Text style={styles.errorText}>{text}</Text>
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
    paddingHorizontal: 12,
    paddingTop: 40,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 32 },

  // Aperçu
  hero: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  heroError: { borderColor: Colors.error },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroIcon: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  persoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(123,119,243,0.16)',
  },
  persoBadgeText: { color: Colors.secondaryAccent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  nameInput: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  heroMeta: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 10, lineHeight: 18 },
  heroMetaEmpty: { color: Colors.textMuted, fontWeight: '500' },

  // Suggestion
  suggestion: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(123,119,243,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(123,119,243,0.28)',
  },
  suggestionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionTitle: { flex: 1, color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  suggestionName: { color: Colors.textPrimary, fontWeight: '800' },
  suggestionMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 4, marginLeft: 24 },
  suggestionBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginLeft: 24,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: Colors.secondaryAccent,
    justifyContent: 'center',
  },
  suggestionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingLeft: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(123,119,243,0.08)',
  },
  appliedText: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  undoBtn: { height: 40, paddingHorizontal: 14, justifyContent: 'center' },
  undoText: { color: Colors.secondaryAccent, fontSize: 13, fontWeight: '800' },

  // Sections
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  required: { color: Colors.primary },
  sectionHint: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  groupChipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  groupChipTextOn: { color: Colors.textPrimary },
  subPanel: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
  },
  subPanelTitle: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  pickHint: { color: Colors.textMuted, fontSize: 13, marginTop: 10 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.cardInner,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pillSmall: { height: 34, paddingHorizontal: 11, borderRadius: 10 },
  pillText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  pillTextSmall: { fontSize: 13 },

  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: Colors.card,
    gap: 4,
  },
  segmentItem: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentItemOn: { backgroundColor: Colors.primary },
  segmentText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  segmentTextOn: { color: '#fff', fontWeight: '800' },

  disclosure: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  disclosureHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 60, paddingVertical: 10 },
  disclosureTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  disclosureSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  disclosureBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  secGroup: { marginTop: 12 },
  secGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  secGroupLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },

  inputLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: Colors.cardInner,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: { borderColor: Colors.error },
  textarea: { minHeight: 100, paddingTop: 12 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  errorText: { flex: 1, color: Colors.error, fontSize: 13, fontWeight: '600' },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 28,
    height: 48,
  },
  deleteBtnText: { color: Colors.error, fontSize: 14, fontWeight: '700' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  footerHint: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  saveBtnOff: { opacity: 0.45 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
