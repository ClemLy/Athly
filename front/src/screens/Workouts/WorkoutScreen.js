import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../constants/theme';
import useExerciseSorting, { isFiltering } from '../../hooks/useExerciseSorting';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { useDevSettings } from '../../hooks/useDevSettings';
import API from '../../api/api';

import SortBar from '../../components/workouts/SortBar';
import SupersetGroup from '../../components/workouts/SupersetGroup';
import ExerciseCard from '../../components/cards/ExerciseCard';
import AddExerciseSheet from '../../components/workouts/AddExerciseSheet';
import WorkoutRecapModal from '../../components/workouts/WorkoutRecapModal';
import ShortSessionWarningModal from '../../components/workouts/ShortSessionWarningModal';
import QuestToast from '../../components/common/QuestToast';

const DEFAULT_FILTERS = { muscles: [], levels: [], equipment: [] };

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

function estimateMinutes(count) {
  if (!count) return 0;
  return Math.max(5, Math.round((count * 9) / 5) * 5);
}

export default function WorkoutScreen({ route, navigation }) {
  const { state, actions, loadWorkout } = useWorkoutInProgress();
  const { totalXP } = useWorkoutLogs();
  const { bypassAnticheat } = useDevSettings();

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const [shortWarningVisible, setShortWarningVisible] = useState(false);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const filterActive = isFiltering(filters);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState('add');
  const replaceTargetIndex = useRef(null);

  const [recapVisible, setRecapVisible] = useState(false);
  const [recapData, setRecapData] = useState(null);

  // Quest toast queue
  const [currentToast, setCurrentToast] = useState(null);
  const toastQueueRef   = useRef([]);
  const pendingRecapRef = useRef(null);

  // Chronomètre
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Charge la séance reçue par navigation params
  useEffect(() => {
    const incoming = route && route.params && route.params.workout;
    if (incoming) loadWorkout(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.workout]);

  // Cache le titre natif de la stack (on a notre propre header)
  useEffect(() => {
    if (navigation) navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const sourceExercises = state.exercises || [];
  const filteredExercises = useExerciseSorting(sourceExercises, filters);
  const visibleExercises = filterActive ? filteredExercises : sourceExercises;

  const displayItems = useMemo(() => {
    if (!Array.isArray(visibleExercises) || visibleExercises.length === 0) return [];

    if (filterActive) {
      return visibleExercises.map((ex, idx) => ({
        type: 'exercise',
        exercise: ex,
        sourceIndex: sourceExercises.indexOf(ex),
        key: ex._id || ex.id || `ex-flat-${idx}`,
      }));
    }

    const items = [];
    let i = 0;
    let groupLetter = 65;
    while (i < visibleExercises.length) {
      const cur = visibleExercises[i];
      const gid = cur && cur.groupId;
      if (gid) {
        const exercises = [cur];
        const indices = [i];
        let j = i + 1;
        while (j < visibleExercises.length && visibleExercises[j].groupId === gid) {
          exercises.push(visibleExercises[j]);
          indices.push(j);
          j += 1;
        }
        if (exercises.length > 1) {
          items.push({
            type: 'superset',
            key: `ss-${gid}`,
            label: String.fromCharCode(groupLetter),
            exercises,
            sourceIndices: indices,
          });
          groupLetter += 1;
          i = j;
          continue;
        }
      }
      items.push({
        type: 'exercise',
        exercise: cur,
        sourceIndex: i,
        key: (cur && (cur._id || cur.id)) || `ex-${i}`,
      });
      i += 1;
    }
    return items;
  }, [visibleExercises, filterActive, sourceExercises]);

  const onCardPress = useCallback((exercise, sourceIndex) => {
    if (!navigation) return;
    navigation.navigate('ExerciseDetail', { exerciseIndex: sourceIndex });
  }, [navigation]);

  const openReplaceSheet = useCallback((sourceIndex) => {
    replaceTargetIndex.current = sourceIndex;
    setSheetMode('replace');
    setSheetVisible(true);
  }, []);

  const openAddSheet = useCallback(() => {
    replaceTargetIndex.current = null;
    setSheetMode('add');
    setSheetVisible(true);
  }, []);

  const onSheetSelect = useCallback((exercise) => {
    if (sheetMode === 'replace' && replaceTargetIndex.current !== null) {
      actions.replaceExercise(replaceTargetIndex.current, exercise);
    } else {
      actions.addExercise(exercise);
    }
  }, [actions, sheetMode]);

  const onRemove = useCallback((sourceIndex, exercise) => {
    Alert.alert(
      'Supprimer',
      `Retirer "${exercise && exercise.name ? exercise.name : 'cet exercice'}" de la séance ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => actions.removeExercise(sourceIndex) },
      ],
    );
  }, [actions]);

  const onToggleSuperset = useCallback((sourceIndex) => {
    actions.toggleSupersetWithNext(sourceIndex);
  }, [actions]);

  // ─── Logique de finalisation partagée ────────────────────────────────────
  const executeFinalize = useCallback(async (opts = {}) => {
    setIsFinalizing(true);
    clearInterval(timerRef.current);
    const prevTotalXP = totalXP;

    try {
      const result = await actions.finalize({ notes: state.notes, durationSeconds: elapsed, ...opts });

      if (state.id) {
        API.post(`/workouts/${state.id}/complete`).catch(() => {});
      }

      const builtRecapData = {
        stats: {
          totalVolume: result.totalVolume,
          setsCompleted: result.setsCompleted,
          totalSets: result.log && Array.isArray(result.log.exercises)
            ? result.log.exercises.reduce(
                (n, ex) => n + (Array.isArray(ex.sets) ? ex.sets.length : 0),
                0,
              )
            : result.setsCompleted,
          durationSeconds: elapsed,
          xpEarned: result.xp + (result.questXP || 0),
          xpMultiplier: result.log?.xpMultiplier ?? 1.0,
          questXP: result.questXP || 0,
          dailyCapReached: result.dailyCapReached || false,
          shortSession: opts.shortSession || false,
        },
        newPRs: Array.isArray(result.newPRs) ? result.newPRs : [],
        completedQuests: result.completedQuests || [],
        bonusUnlocked: result.bonusUnlocked || false,
        prevTotalXP,
      };

      const toastItems = [
        ...(result.completedQuests || []).map((q) => ({ label: q.label, isBonus: false })),
        ...(result.bonusUnlocked ? [{ label: null, isBonus: true }] : []),
      ];

      if (toastItems.length > 0) {
        toastQueueRef.current   = toastItems.slice(1);
        pendingRecapRef.current = builtRecapData;
        setCurrentToast(toastItems[0]);
      } else {
        setRecapData(builtRecapData);
        setRecapVisible(true);
      }
    } catch (e) {
      setRecapData({
        stats: { totalVolume: 0, setsCompleted: 0, totalSets: 0, durationSeconds: elapsed, xpEarned: 0 },
        newPRs: [],
        completedQuests: [],
        bonusUnlocked: false,
        prevTotalXP,
      });
      setRecapVisible(true);
    } finally {
      setIsFinalizing(false);
    }
  }, [actions, state.notes, state.id, totalXP, elapsed]);

  // ─── TERMINER LA SÉANCE ───────────────────────────────────────────────────
  const handleTerminate = useCallback(async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    if (isFinalizing || recapVisible) return;

    // Anti-cheat 5 min : bloque si < 300s et bypass désactivé
    if (elapsed < 300 && !bypassAnticheat) {
      setShortWarningVisible(true);
      return;
    }

    executeFinalize();
  }, [isFinalizing, recapVisible, elapsed, bypassAnticheat, executeFinalize]);

  // Valider quand même (0 XP, shortSession)
  const handleForceFinish = useCallback(() => {
    setShortWarningVisible(false);
    executeFinalize({ shortSession: true });
  }, [executeFinalize]);

  const handleToastHide = useCallback(() => {
    const next = toastQueueRef.current;
    if (next.length > 0) {
      toastQueueRef.current = next.slice(1);
      setCurrentToast(next[0]);
    } else {
      setCurrentToast(null);
      if (pendingRecapRef.current) {
        setRecapData(pendingRecapRef.current);
        setRecapVisible(true);
        pendingRecapRef.current = null;
      }
    }
  }, []);

  const closeRecap = useCallback(() => {
    setRecapVisible(false);
    setRecapData(null);
    // Reset the workout context so the next session starts clean
    actions.reset();
    if (navigation) {
      // Pop the entire WorkoutStack back to WorkoutList (the root screen),
      // then switch to Stats tab. Without popToTop(), WorkoutScreen stays on the
      // stack and the user lands back here when they tap "Séances" again.
      navigation.popToTop();
      navigation.navigate('Stats');
    }
  }, [navigation, actions]);

  const renderExercise = (ex, sourceIndex, opts = {}) => {
    const isDone = !!(ex && ex.done);
    return (
      <View
        key={(ex && (ex._id || ex.id)) || `ex-${sourceIndex}`}
        style={isDone ? styles.doneExWrap : null}
      >
        <ExerciseCard
          item={ex}
          inSuperset={!!opts.inSuperset}
          onPress={() => onCardPress(ex, sourceIndex)}
          onReplace={() => openReplaceSheet(sourceIndex)}
          onRemove={() => onRemove(sourceIndex, ex)}
          onToggleSuperset={() => onToggleSuperset(sourceIndex)}
        />
        {isDone && (
          <View style={styles.doneExBadge} pointerEvents="none">
            <Ionicons name="checkmark-circle" size={13} color={Colors.valid} />
            <Text style={styles.doneExText}>Terminé</Text>
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    if (item.type === 'superset') {
      return (
        <SupersetGroup label={item.label}>
          {item.exercises.map((ex, idx) => renderExercise(
            ex,
            item.sourceIndices[idx],
            { inSuperset: true },
          ))}
        </SupersetGroup>
      );
    }
    return renderExercise(item.exercise, item.sourceIndex);
  };

  const renderFooter = () => (
    <TouchableOpacity
      style={styles.addBtn}
      onPress={openAddSheet}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={18} color={Colors.primary} />
      <Text style={styles.addBtnText}>Ajouter un exercice</Text>
    </TouchableOpacity>
  );

  const exerciseCount = sourceExercises.length;

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN — structure vérifiable complète
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

      {/* ── Header immersif : nom + chrono géant ── */}
      <View style={styles.header}>
        <Text style={styles.workoutName} numberOfLines={1}>
          {state.name || 'Séance en cours'}
        </Text>
        <Text style={styles.chrono}>{formatElapsed(elapsed)}</Text>
        <Text style={styles.chronoSub}>
          {exerciseCount > 0
            ? `${exerciseCount} exercice${exerciseCount > 1 ? 's' : ''} • ~${estimateMinutes(exerciseCount)} min`
            : 'Ajoute tes exercices'}
        </Text>
      </View>

      {/* ── Filtres ── */}
      <SortBar filters={filters} onChange={setFilters} />

      {/* ── Liste des exercices — flex:1 pour occuper tout l'espace disponible ── */}
      <View style={styles.listContainer}>
        {displayItems.length > 0 ? (
          <FlatList
            data={displayItems}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={48} color={Colors.textMuted} style={{ opacity: 0.4 }} />
            <Text style={styles.emptyText}>
              {filterActive
                ? 'Aucun exercice ne correspond aux filtres.'
                : 'Aucun exercice dans cette séance.'}
            </Text>
            {!filterActive ? (
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddSheet} activeOpacity={0.85}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyAddBtnText}>Ajouter un exercice</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>

      {/* ── Bouton TERMINER — View fixe, jamais dans le scroll ── */}
      <View style={styles.terminateBar}>
        <TouchableOpacity
          style={[styles.terminateBtn, isFinalizing && styles.terminateBtnLoading]}
          onPress={handleTerminate}
          activeOpacity={0.85}
          disabled={isFinalizing}
        >
          {isFinalizing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.terminateBtnText}>TERMINER LA SÉANCE</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Modales ── */}
      <AddExerciseSheet
        visible={sheetVisible}
        mode={sheetMode}
        onClose={() => setSheetVisible(false)}
        onSelect={onSheetSelect}
      />

      <QuestToast
        visible={!!currentToast}
        questLabel={currentToast ? currentToast.label : ''}
        isBonus={currentToast ? currentToast.isBonus : false}
        onHide={handleToastHide}
      />

      <WorkoutRecapModal
        visible={recapVisible}
        stats={recapData ? recapData.stats : null}
        newPRs={recapData ? recapData.newPRs : []}
        prevTotalXP={recapData ? recapData.prevTotalXP : 0}
        completedQuests={recapData ? recapData.completedQuests || [] : []}
        bonusUnlocked={recapData ? recapData.bonusUnlocked || false : false}
        onClose={closeRecap}
      />

      <ShortSessionWarningModal
        visible={shortWarningVisible}
        onModify={() => setShortWarningVisible(false)}
        onForce={handleForceFinish}
        elapsedSeconds={elapsed}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  workoutName: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  chrono: {
    color: Colors.primary,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  chronoSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },

  // ── Liste ────────────────────────────────────────────────────────────────
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 22,
  },
  emptyAddBtnText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 6,
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

  // ── Bouton Terminer ───────────────────────────────────────────────────────
  terminateBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 20 : 16,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  terminateBtn: {
    height: 60,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  doneExWrap: {
    opacity: 0.55,
  },
  doneExBadge: {
    position: 'absolute',
    top: 10,
    right: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.14)', // Colors.valid à 14% opacité
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doneExText: {
    color: Colors.valid,
    fontSize: 11,
    fontWeight: '700',
  },
  terminateBtnLoading: {
    opacity: 0.7,
  },
  terminateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
