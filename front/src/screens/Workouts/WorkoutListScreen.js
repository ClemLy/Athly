import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { TEMPLATES, instantiateWorkout } from '../../data/workoutTemplates';
import ResumeWorkoutCard from '../../components/workouts/ResumeWorkoutCard';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';
import { useSavedWorkouts } from '../../context/SavedWorkoutsContext';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { instantiateSavedWorkout } from '../../services/savedWorkouts.service';
import { useFocusEffect } from '@react-navigation/native';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';
import MultiLobbyModal from '../../components/workouts/MultiLobbyModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import InfoModal from '../../components/common/InfoModal';
import ActionSheetModal from '../../components/common/ActionSheetModal';
import { getErrorMessage } from '../../utils/errorMessages';
import { plural } from '../../utils/format';

// Page d'entrée "Séances".
// Header : titre + 2 icônes (Mes exercices, Créer un exercice).
// Body : callout Builder, section "Mes séances" sauvegardées, templates rapides.

// « il y a 3 j » pour la dernière fois qu'une séance a été faite.
function lastDoneLabel(date) {
  if (!date) return null;
  const days = Math.round((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "Faite aujourd'hui";
  if (days === 1) return 'Faite hier';
  return `Faite il y a ${days} j`;
}

function TemplateCard({ template, lastDone, onPress }) {
  return (
    <TouchableOpacity accessibilityRole="button"
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.iconBox}>
        <Ionicons name={template.icon} size={22} color={Colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{template.name}</Text>
        <Text style={styles.muscles} numberOfLines={1}>{template.musclesSummary}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="barbell-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>{plural(template.buildExercises().length, 'exercice')}</Text>
          <View style={styles.metaDot} />
          <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>~{template.estimatedDurationMin} min</Text>
        </View>
        {lastDone ? (
          <View style={styles.recentRow}>
            <Ionicons name="checkmark-circle" size={13} color={Colors.valid} />
            <Text style={styles.metaRecent} numberOfLines={1}>{lastDoneLabel(lastDone)}</Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={22} color={Colors.chevron} />
    </TouchableOpacity>
  );
}

function SavedWorkoutCard({ saved, onPress, onLongPress }) {
  const count = Array.isArray(saved.exercises) ? saved.exercises.length : 0;
  return (
    <TouchableOpacity accessibilityRole="button"
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
      <View style={styles.iconBox}>
        <Ionicons name="bookmark" size={22} color={Colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{saved.name}</Text>
          {saved.isManual ? (
            <View style={styles.manualBadge}>
              <Text style={styles.manualBadgeText}>Manuel</Text>
            </View>
          ) : null}
        </View>
        {saved.description ? (
          <Text style={styles.muscles} numberOfLines={1}>{saved.description}</Text>
        ) : null}
        <View style={styles.metaRow}>
          <Ionicons name="barbell-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>{plural(count, 'exercice')}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.meta} numberOfLines={1}>{new Date(saved.createdAt).toLocaleDateString('fr-FR')}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={22} color={Colors.chevron} />
    </TouchableOpacity>
  );
}

const SKIP_CONFIRM_KEY = '@athly_skip_workout_confirm';

export default function WorkoutListScreen({ navigation, route }) {
  const { loadWorkout, resumable } = useWorkoutInProgress();
  const { items: savedWorkouts, remove: removeSaved } = useSavedWorkouts();
  const { sessionLogs } = useWorkoutLogs();

  // Dernière réalisation de chaque séance (par nom) — repère « Faite il y a 3 j ».
  const lastDoneByName = React.useMemo(() => {
    const map = {};
    (sessionLogs || []).forEach((l) => {
      if (!l || !l.name || !l.date) return;
      if (!map[l.name] || new Date(l.date) > new Date(map[l.name])) map[l.name] = l.date;
    });
    return map;
  }, [sessionLogs]);

  const [confirmItem, setConfirmItem] = useState(null); // { type: 'template'|'saved', data }
  const [dontAsk, setDontAsk] = useState(false);

  // ─── Lancement en Multi (Section VII) ────────────────────────────────────
  const [multiLobbyVisible, setMultiLobbyVisible] = useState(false);
  // Non-null uniquement quand on arrive en rejoignant une invitation reçue
  // (voir LobbyInviteCheck / écran Social) — sinon MultiLobbyModal crée un lobby neuf.
  const [existingLobbyId, setExistingLobbyId] = useState(null);
  // Séance pré-choisie dans le salon (« Lancer en Multi » depuis une séance).
  const [multiWorkoutKey, setMultiWorkoutKey] = useState(null);

  // Invitation acceptée (popup, notification, écran Social) : ouvre directement
  // le salon en mode « rejoindre » ; chacun y choisit sa propre séance.
  useEffect(() => {
    const pendingLobbyId = route?.params?.pendingLobbyId;
    if (!pendingLobbyId) return;
    setExistingLobbyId(pendingLobbyId);
    setMultiWorkoutKey(null);
    setMultiLobbyVisible(true);
    navigation?.setParams({ pendingLobbyId: undefined });
  }, [route?.params?.pendingLobbyId, navigation]);

  // « S'entraîner ensemble » depuis l'écran Social : nouveau salon.
  useEffect(() => {
    if (!route?.params?.openMulti) return;
    setExistingLobbyId(null);
    setMultiWorkoutKey(null);
    setMultiLobbyVisible(true);
    navigation?.setParams({ openMulti: undefined });
  }, [route?.params?.openMulti, navigation]);

  const [deleteSavedTarget, setDeleteSavedTarget] = useState(null);
  const [actionSheetTarget, setActionSheetTarget] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);

  // ─── Tutorial ─────────────────────────────────────────────────────────────
  const { pendingChapterId, activeChapterId, startChapter, registerScrollRef, registerRemeasure } = useTutorial();
  const { ref: headerActionsRef,   onLayout: onHeaderActionsLayout }                        = useTutorialTarget('workout_header_actions');
  const { ref: templatesSectionRef, onLayout: onTemplatesSectionLayout, remeasure: rTemplates } = useTutorialTarget('workout_templates_section');

  const flatListRef = useRef(null);

  // Enregistre un adaptateur de scroll compatible ScrollView (FlatList expose scrollToOffset,
  // pas scrollTo) ainsi qu'une re-mesure de la section templates après scroll automatique.
  useEffect(() => {
    registerScrollRef('workout', {
      current: {
        scrollTo: ({ y, animated }) => flatListRef.current?.scrollToOffset({ offset: y, animated }),
      },
    });
    registerRemeasure('workout', () => setTimeout(() => rTemplates(), 50));
  }, [registerScrollRef, registerRemeasure, rTemplates]);

  useFocusEffect(
    useCallback(() => {
      if (pendingChapterId === 'workout') {
        const t = setTimeout(() => startChapter('workout'), 400);
        return () => clearTimeout(t);
      }
    }, [pendingChapterId, startChapter]),
  );

  const launchWorkout = useCallback((type, data) => {
    const workout = type === 'template' ? instantiateWorkout(data) : instantiateSavedWorkout(data);
    if (!workout || !navigation) return;
    loadWorkout(workout);
    navigation.navigate('Workout', { workout });
  }, [navigation, loadWorkout]);

  const onSelectTemplate = useCallback(async (template) => {
    try {
      const skip = await AsyncStorage.getItem(SKIP_CONFIRM_KEY);
      if (skip === 'true') { launchWorkout('template', template); return; }
    } catch (_) {}
    setDontAsk(false);
    setConfirmItem({ type: 'template', data: template });
  }, [launchWorkout]);

  const onSelectSaved = useCallback(async (saved) => {
    try {
      const skip = await AsyncStorage.getItem(SKIP_CONFIRM_KEY);
      if (skip === 'true') { launchWorkout('saved', saved); return; }
    } catch (_) {}
    setDontAsk(false);
    setConfirmItem({ type: 'saved', data: saved });
  }, [launchWorkout]);

  const handleConfirm = useCallback(async () => {
    if (!confirmItem) return;
    if (dontAsk) {
      try { await AsyncStorage.setItem(SKIP_CONFIRM_KEY, 'true'); } catch (_) {}
    }
    launchWorkout(confirmItem.type, confirmItem.data);
    setConfirmItem(null);
  }, [confirmItem, dontAsk, launchWorkout]);

  const handleCancelConfirm = useCallback(() => setConfirmItem(null), []);

  // Séances proposées dans le salon Multi : les miennes puis les modèles.
  const multiOptions = [
    ...(savedWorkouts || []).map((sw) => ({
      key: `s:${sw.id}`, name: sw.name || 'Séance', meta: plural((sw.exercises || []).length, 'exercice'), type: 'saved', data: sw,
    })),
    ...TEMPLATES.map((t) => ({
      key: `t:${t.id}`, name: t.name, meta: t.description || plural(t.buildExercises().length, 'exercice'), type: 'template', data: t,
    })),
  ];

  // Bouton « Séance Multi » de l'en-tête : salon neuf, séance à choisir dedans.
  const openMulti = useCallback(() => {
    setExistingLobbyId(null);
    setMultiWorkoutKey(null);
    setMultiLobbyVisible(true);
  }, []);

  // « Lancer en Multi » depuis la confirmation : la séance choisie est reprise.
  const handleLaunchMulti = useCallback(() => {
    if (confirmItem) {
      setMultiWorkoutKey(`${confirmItem.type === 'template' ? 't' : 's'}:${confirmItem.data.id}`);
    }
    setConfirmItem(null);
    setExistingLobbyId(null);
    setMultiLobbyVisible(true);
  }, [confirmItem]);

  // Tout le monde est prêt : chacun lance SA séance (séries gérées en local).
  const handleMultiReady = useCallback((lobbyId, workoutKey) => {
    setMultiLobbyVisible(false);
    setExistingLobbyId(null);
    if (!navigation) return;
    const option = multiOptions.find((o) => o.key === workoutKey) || multiOptions.find((o) => o.type === 'template');
    const workout = option.type === 'template' ? instantiateWorkout(option.data) : instantiateSavedWorkout(option.data);
    if (!workout) return;
    loadWorkout(workout);
    navigation.navigate('Workout', { workout, lobbyId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, loadWorkout, savedWorkouts]);

  const onLongPressSaved = useCallback((saved) => setActionSheetTarget(saved), []);

  // "Modifier" route vers l'écran de création d'ORIGINE de la séance, pour que
  // l'interface d'édition soit rigoureusement identique à celle de création :
  // WorkoutBuilder pour toute séance sur-mesure (isManual: false), même une
  // séance ancienne créée avant l'ajout du champ criteria (elle rouvrira alors
  // l'écran sur-mesure avec des critères vierges plutôt qu'un éditeur différent) ;
  // ManualWorkoutCreator uniquement pour les séances explicitement manuelles.
  const onEditSaved = useCallback((saved) => {
    if (!navigation) return;
    const target = saved.isManual ? 'ManualWorkoutCreator' : 'WorkoutBuilder';
    navigation.navigate(target, { editWorkout: saved });
  }, [navigation]);

  const confirmDeleteSaved = useCallback(async () => {
    const saved = deleteSavedTarget;
    setDeleteSavedTarget(null);
    try { await removeSaved(saved.id); } catch (e) {
      setErrorInfo(getErrorMessage(e, 'La suppression n\'a pas abouti. Réessaie dans un instant.'));
    }
  }, [deleteSavedTarget, removeSaved]);

  const onOpenBuilder = useCallback(() => {
    if (navigation) navigation.navigate('WorkoutBuilder');
  }, [navigation]);

  const onOpenCustomList = useCallback(() => {
    if (navigation) navigation.navigate('CustomExercises');
  }, [navigation]);

  const onCreateManualWorkout = useCallback(() => {
    if (navigation) navigation.navigate('ManualWorkoutCreator');
  }, [navigation]);

  // Sections de FlatList unifiées : on utilise une seule data + renderItem
  // qui dispatch sur le type pour garder le scroll fluide.
  const sections = [];
  if (resumable) sections.push({ type: 'resume', key: 'resume' });
  sections.push({ type: 'callout', key: 'cta-builder' });
  if (savedWorkouts && savedWorkouts.length > 0) {
    sections.push({ type: 'header', key: 'h-saved', label: 'Mes séances', count: savedWorkouts.length });
    savedWorkouts.forEach((s) => sections.push({ type: 'saved', key: `s-${s.id}`, item: s }));
  }
  sections.push({ type: 'header', key: 'h-templates', label: 'Séances prêtes à lancer', count: TEMPLATES.length });
  TEMPLATES.forEach((t) => sections.push({ type: 'template', key: `t-${t.id}`, item: t }));

  const renderItem = ({ item }) => {
    if (item.type === 'resume') {
      return (
        <ResumeWorkoutCard
          onResume={({ lobbyId }) => navigation.navigate('Workout', lobbyId ? { lobbyId } : {})}
        />
      );
    }
    if (item.type === 'callout') {
      return (
        <View style={styles.builderCallout}>
          <View style={styles.builderCalloutContent}>
            <Text style={styles.builderCalloutTitle}>Crée ta séance sur-mesure</Text>
            <Text style={styles.builderCalloutSubtitle}>
              Muscles, équipement, durée. L'algo s'adapte à ton niveau.
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button"
            style={styles.builderCalloutBtn}
            onPress={onOpenBuilder}
            activeOpacity={0.85}
          >
            <Text style={styles.builderCalloutBtnText}>Démarrer</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }
    if (item.type === 'header') {
      // Attache la ref de ciblage tutoriel uniquement sur le header "Templates rapides".
      const isTemplates = item.key === 'h-templates';
      return (
        <View
          ref={isTemplates ? templatesSectionRef : null}
          onLayout={isTemplates ? onTemplatesSectionLayout : undefined}
          collapsable={false}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>{item.label}</Text>
          <Text style={styles.sectionCount}>{item.count}</Text>
        </View>
      );
    }
    if (item.type === 'saved') {
      return (
        <SavedWorkoutCard
          saved={item.item}
          onPress={() => onSelectSaved(item.item)}
          onLongPress={() => onLongPressSaved(item.item)}
        />
      );
    }
    if (item.type === 'template') {
      return (
        <TemplateCard
          template={item.item}
          lastDone={lastDoneByName[item.item.name]}
          onPress={() => onSelectTemplate(item.item)}
        />
      );
    }
    return null;
  };

  const ItemSeparator = ({ leadingItem }) => {
    if (leadingItem && leadingItem.type === 'header') return <View style={{ height: 4 }} />;
    if (leadingItem && (leadingItem.type === 'callout' || leadingItem.type === 'resume')) return <View style={{ height: 18 }} />;
    return <View style={styles.sep} />;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Séances</Text>
          <Text style={styles.headerSubtitle}>Choisis ta séance du jour</Text>
        </View>
        <View style={styles.headerActions} ref={headerActionsRef} onLayout={onHeaderActionsLayout} collapsable={false}>
          <TouchableOpacity accessibilityRole="button"
            style={styles.iconBtn}
            onPress={openMulti}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Séance Multi avec des amis"
          >
            <Ionicons name="people-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button"
            style={styles.iconBtn}
            onPress={onOpenCustomList}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Mes exercices"
          >
            <Ionicons name="library-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button"
            style={[styles.iconBtn, styles.iconBtnPrimary]}
            onPress={onCreateManualWorkout}
            activeOpacity={0.85}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Créer une séance manuelle"
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={sections}
        keyExtractor={(s) => s.key}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={ItemSeparator}
      />

      {activeChapterId === 'workout' && (
        <TutorialOverlay navigation={navigation} />
      )}

      {/* ── Confirmation lancement séance ── */}
      <Modal visible={!!confirmItem} transparent animationType="fade" onRequestClose={handleCancelConfirm}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Lancer la séance ?</Text>
            <Text style={styles.confirmName} numberOfLines={2}>
              {confirmItem ? (confirmItem.data.name || 'Séance') : ''}
            </Text>

            <TouchableOpacity accessibilityRole="button"
              style={styles.dontAskRow}
              onPress={() => setDontAsk((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.dontAskCheck, dontAsk && styles.dontAskCheckOn]}>
                {dontAsk && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.dontAskText}>Ne plus demander</Text>
            </TouchableOpacity>

            <View style={styles.confirmBtns}>
              <TouchableOpacity accessibilityRole="button" style={styles.confirmBtnNo} onPress={handleCancelConfirm} activeOpacity={0.8}>
                <Text style={styles.confirmBtnNoText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.confirmBtnYes} onPress={handleConfirm} activeOpacity={0.8}>
                <Text style={styles.confirmBtnYesText}>Lancer !</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity accessibilityRole="button" style={styles.multiBtn} onPress={handleLaunchMulti} activeOpacity={0.8}>
              <Ionicons name="people" size={15} color={Colors.primary} style={{ marginRight: 7 }} />
              <Text style={styles.multiBtnTxt}>Lancer en Multi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MultiLobbyModal
        visible={multiLobbyVisible}
        existingLobbyId={existingLobbyId}
        workoutOptions={multiOptions}
        initialWorkoutKey={multiWorkoutKey}
        onClose={() => { setMultiLobbyVisible(false); setExistingLobbyId(null); }}
        onReady={handleMultiReady}
      />

      <ActionSheetModal
        visible={!!actionSheetTarget}
        title={actionSheetTarget?.name}
        options={[
          { label: 'Modifier', onPress: () => onEditSaved(actionSheetTarget) },
          { label: 'Supprimer', destructive: true, onPress: () => setDeleteSavedTarget(actionSheetTarget) },
        ]}
        onClose={() => setActionSheetTarget(null)}
      />

      <ConfirmModal
        visible={!!deleteSavedTarget}
        icon="trash-outline"
        title={deleteSavedTarget?.name ?? 'Supprimer'}
        body="Que faire avec cette séance ? La supprimer est irréversible."
        confirmLabel="Supprimer"
        destructive
        onConfirm={confirmDeleteSaved}
        onCancel={() => setDeleteSavedTarget(null)}
      />
      <InfoModal
        visible={!!errorInfo}
        icon="alert-circle-outline"
        title="Erreur"
        body={errorInfo}
        destructive
        onClose={() => setErrorInfo(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 14,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  iconBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sep: { height: 12 },

  builderCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 116, 57, 0.12)',
    borderColor: 'rgba(254, 116, 57, 0.4)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  builderCalloutContent: {
    flex: 1,
  },
  builderCalloutTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  builderCalloutSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  builderCalloutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 22,
    marginLeft: 12,
  },
  builderCalloutBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    marginRight: 6,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.cardInner,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  icon: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  manualBadge: {
    backgroundColor: 'rgba(254, 116, 57, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  manualBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  muscles: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  // Les éléments de méta-données passent à la ligne en bloc (jamais "8 / exercices")
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 4,
    marginTop: 8,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: 12,
    marginLeft: 4,
    flexShrink: 0,
  },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  metaRecent: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '600' },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
    marginHorizontal: 8,
  },

  // ── Confirmation modale ──────────────────────────────────────────────────
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  confirmBox: {
    width: '100%',
    backgroundColor: Colors.modalBg,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  confirmTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  confirmName: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 20,
  },
  dontAskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },
  dontAskCheck: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.borderDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dontAskCheckOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dontAskText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmBtnNo: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  confirmBtnNoText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtnYes: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmBtnYesText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  multiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 42, borderRadius: 12, marginTop: 10,
    borderWidth: 1, borderColor: `${Colors.primary}40`,
    backgroundColor: `${Colors.primary}12`,
  },
  multiBtnTxt: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
});
