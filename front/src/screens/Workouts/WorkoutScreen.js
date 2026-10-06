import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '../../services';

import { Colors } from '../../constants/theme';
import { useExerciseSorting, isFiltering } from '../../hooks';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { useDevSettings } from '../../hooks';

import { completeWorkout } from '../../services';

import SortBar from '../../components/workouts/SortBar';
import SupersetGroup from '../../components/workouts/SupersetGroup';
import ExerciseCard from '../../components/cards/ExerciseCard';
import InlineExerciseBlock from '../../components/workouts/InlineExerciseBlock';
import AddExerciseSheet from '../../components/workouts/AddExerciseSheet';
import WorkoutRecapModal from '../../components/workouts/WorkoutRecapModal';
import ShortSessionWarningModal from '../../components/workouts/ShortSessionWarningModal';
import { QuestToast } from '../../components/common';
import { ConfirmModal } from '../../components/common';
import LobbyMembersBar from '../../components/workouts/LobbyMembersBar';
import LobbyWaitingOverlay from '../../components/workouts/LobbyWaitingOverlay';
import MultiLootModal from '../../components/workouts/MultiLootModal';
import { getLobby, finishLobby, leaveLobby } from '../../services';
import { useMyId } from '../../hooks/useMyId';
import { computeBonusPercent } from '../../components/workouts/MultiLobbyModal';

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
  const {
    state, actions, loadWorkout, startedAt,
    resumable, restoreChecked, resumeWorkout,
  } = useWorkoutInProgress();
  const { totalXP, addBonusXp } = useWorkoutLogs();
  const { bypassAnticheat } = useDevSettings();
  const [allInOne, setAllInOne] = useState(false);

  // ─── Séance en Multi (Section VII) ───────────────────────────────────────
  // Chacun gère ses propres séries/poids côté client (résilience réseau) —
  // le lobby ne sert qu'à afficher les bulles de présence et à synchroniser
  // la clôture (voir handleTerminate / executeFinalize plus bas).
  const lobbyId = route?.params?.lobbyId ?? null;
  const myId = useMyId();
  const [lobby, setLobby] = useState(null);
  const [multiWaiting, setMultiWaiting] = useState(false);
  const [multiLoot, setMultiLoot] = useState(null); // { memberCount, bonusPercent, bonusXp }
  const [lootVisible, setLootVisible] = useState(false);
  const multiBonusPendingRef = useRef(null); // { bonusPercent, memberCount } — consommé par executeFinalize
  const lobbyPollRef = useRef(null);

  // Bulles de présence : poll léger tant que la séance n'est pas terminée.
  useEffect(() => {
    if (!lobbyId) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await getLobby(lobbyId);
        if (!cancelled) setLobby(res.lobby);
      } catch (_) {}
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [lobbyId]);

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const [shortWarningVisible, setShortWarningVisible] = useState(false);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const filterActive = isFiltering(filters);
  // Filtres repliés par défaut : en pleine séance (quelques exercices), ils
  // encombrent plus qu'ils n'aident. Ils restent à un geste.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState('add');
  const replaceTargetIndex = useRef(null);

  const [recapVisible, setRecapVisible] = useState(false);
  const [recapData, setRecapData] = useState(null);

  // Popup d'abandon de séance : intercepte toute sortie de l'écran (geste,
  // bouton retour matériel, action programmatique) tant qu'une progression
  // réelle existe. `allowExitRef` sert d'échappatoire pour les sorties déjà
  // voulues par l'utilisateur (fin de séance validée via closeRecap).
  const [abandonModalVisible, setAbandonModalVisible] = useState(false);
  const allowExitRef = useRef(false);
  const pendingNavActionRef = useRef(null);

  // Confirmation de suppression d'un exercice (modale custom, pas d'Alert natif)
  const [removeConfirm, setRemoveConfirm] = useState(null); // { sourceIndex, name }

  // Quest toast queue
  const [currentToast, setCurrentToast] = useState(null);
  const toastQueueRef   = useRef([]);
  const pendingRecapRef = useRef(null);

  // Chronomètre : calculé depuis l'heure de début de la séance (et non compté
  // seconde par seconde), pour rester exact après une mise en arrière-plan ou
  // une reprise de séance interrompue.
  const startedAtRef = useRef(startedAt);
  startedAtRef.current = startedAt;
  useEffect(() => {
    const localStart = Date.now();
    const tick = () => {
      const origin = startedAtRef.current || localStart;
      setElapsed(Math.max(0, Math.floor((Date.now() - origin) / 1000)));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Charge la séance reçue par navigation params
  useEffect(() => {
    const incoming = route && route.params && route.params.workout;
    if (incoming) loadWorkout(incoming, { lobbyId: route?.params?.lobbyId ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.workout]);

  // Arrivée sans séance (page rechargée sur /seances/en-cours) : on reprend la
  // séance interrompue s'il y en a une, sinon retour à la liste des séances.
  useEffect(() => {
    if (!restoreChecked || route?.params?.workout) return;
    if (Array.isArray(state.exercises) && state.exercises.length > 0) return;
    if (resumable) {
      const info = resumeWorkout();
      if (info?.lobbyId) navigation.setParams({ lobbyId: info.lobbyId });
    } else {
      allowExitRef.current = true;
      navigation.replace('WorkoutList');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreChecked]);

  // Cache le titre natif de la stack (on a notre propre header)
  useEffect(() => {
    if (navigation) navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const sourceExercises = state.exercises || [];
  const filteredExercises = useExerciseSorting(sourceExercises, filters);
  const visibleExercises = filterActive ? filteredExercises : sourceExercises;

  // Popup d'abandon de séance : dès qu'un exercice a été ajouté, quitter
  // l'écran (geste retour, bouton matériel Android, navigation programmatique)
  // annule une vraie progression — on l'intercepte pour confirmer.
  useEffect(() => {
    if (!navigation) return undefined;
    const listener = (e) => {
      if (allowExitRef.current || sourceExercises.length === 0) return;
      e.preventDefault();
      pendingNavActionRef.current = e.data.action;
      setAbandonModalVisible(true);
    };
    const unsubscribe = navigation.addListener('beforeRemove', listener);
    return unsubscribe;
  }, [navigation, sourceExercises.length]);

  const confirmAbandon = useCallback(() => {
    setAbandonModalVisible(false);
    allowExitRef.current = true;
    if (lobbyId) leaveLobby(lobbyId).catch(() => {});
    actions.reset();
    if (pendingNavActionRef.current) {
      navigation.dispatch(pendingNavActionRef.current);
      pendingNavActionRef.current = null;
    }
  }, [navigation, actions, lobbyId]);

  const cancelAbandon = useCallback(() => {
    haptics.error();
    setAbandonModalVisible(false);
    pendingNavActionRef.current = null;
  }, []);

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
    setRemoveConfirm({ sourceIndex, name: exercise?.name || 'cet exercice' });
  }, []);

  const confirmRemove = useCallback(() => {
    if (removeConfirm) actions.removeExercise(removeConfirm.sourceIndex);
    setRemoveConfirm(null);
  }, [removeConfirm, actions]);

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
        completeWorkout(state.id).catch(() => {});
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

      // ── Bonus XP Multi (Section VII) ── consommé une seule fois : posé par
      // handleTerminate dès que le lobby passe 'completed' (voir plus bas).
      const pendingBonus = multiBonusPendingRef.current;
      multiBonusPendingRef.current = null;
      if (pendingBonus && pendingBonus.bonusPercent > 0) {
        const bonusXp = Math.round(builtRecapData.stats.xpEarned * pendingBonus.bonusPercent);
        if (bonusXp > 0) {
          addBonusXp('Bonus Multi', bonusXp).catch(() => {});
        }
        setMultiLoot({ memberCount: pendingBonus.memberCount, bonusPercent: pendingBonus.bonusPercent, bonusXp });
      }

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
  }, [actions, state.notes, state.id, totalXP, elapsed, addBonusXp]);

  // ─── TERMINER LA SÉANCE ───────────────────────────────────────────────────
  const handleTerminate = useCallback(async () => {
    // Clôture de séance : moment marquant → vibration lourde.
    haptics.heavy();

    if (isFinalizing || recapVisible || multiWaiting) return;

    // Anti-cheat 5 min : bloque si < 300s et bypass désactivé
    if (elapsed < 300 && !bypassAnticheat) {
      setShortWarningVisible(true);
      return;
    }

    // ── Clôture synchrone Multi (Section VII) ── mon statut passe 'finished'.
    // Si je suis le dernier, le lobby passe 'completed' immédiatement (pas
    // d'attente). Sinon, écran d'attente bloquant jusqu'à ce que tout le
    // monde ait fini (polling — pas de websocket dans ce projet).
    if (lobbyId) {
      setMultiWaiting(true);
      try {
        const res = await finishLobby(lobbyId);
        setLobby(res.lobby);
        if (res.completed) {
          multiBonusPendingRef.current = {
            bonusPercent: res.lobby.xpBonusPercent,
            memberCount: res.lobby.memberCount,
          };
          setMultiWaiting(false);
          executeFinalize();
        } else {
          lobbyPollRef.current = setInterval(async () => {
            try {
              const poll = await getLobby(lobbyId);
              setLobby(poll.lobby);
              if (poll.lobby.status === 'completed') {
                clearInterval(lobbyPollRef.current);
                multiBonusPendingRef.current = {
                  bonusPercent: poll.lobby.xpBonusPercent,
                  memberCount: poll.lobby.memberCount,
                };
                setMultiWaiting(false);
                executeFinalize();
              }
            } catch (e) {
              // Salon disparu : rien à attendre, la séance est enregistrée.
              if (e?.status === 404 || e?.status === 403) {
                clearInterval(lobbyPollRef.current);
                setMultiWaiting(false);
                executeFinalize();
              }
            }
          }, 3000);
        }
      } catch (_) {
        // Best-effort : un souci réseau sur le lobby ne doit jamais bloquer
        // la validation de la propre séance de l'utilisateur.
        setMultiWaiting(false);
        executeFinalize();
      }
      return;
    }

    executeFinalize();
  }, [isFinalizing, recapVisible, multiWaiting, elapsed, bypassAnticheat, executeFinalize, lobbyId]);

  useEffect(() => () => { if (lobbyPollRef.current) clearInterval(lobbyPollRef.current); }, []);

  // « Ne pas attendre » : un partenaire peut avoir abandonné, perdu le réseau
  // ou fermé l'app. On enregistre sa propre séance tout de suite (sans le
  // bonus d'équipe, distribué seulement quand tout le monde a fini).
  const stopWaiting = useCallback(() => {
    if (lobbyPollRef.current) clearInterval(lobbyPollRef.current);
    multiBonusPendingRef.current = null;
    setMultiWaiting(false);
    executeFinalize();
  }, [executeFinalize]);

  // Valider quand même (0 XP, shortSession)
  const handleForceFinish = useCallback(() => {
    setShortWarningVisible(false);
    // Séance trop courte (0 XP) : elle ne compte pas pour l'équipe. On quitte
    // la séance Multi pour que les partenaires ne m'attendent pas.
    if (lobbyId) leaveLobby(lobbyId).catch(() => {});
    executeFinalize({ shortSession: true });
  }, [executeFinalize, lobbyId]);

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

  const leaveWorkoutScreen = useCallback(() => {
    // Reset the workout context so the next session starts clean
    actions.reset();
    if (navigation) {
      // Séance déjà validée : cette sortie ne doit jamais déclencher la popup
      // d'abandon (voir le listener 'beforeRemove' plus haut).
      allowExitRef.current = true;
      // On remet l'onglet Séances sur sa liste, puis on bascule sur Stats. Sans
      // ça, l'écran de séance (vide) resterait dans l'onglet.
      // Séance lancée depuis l'onglet Séances → pile [WorkoutList, Workout] :
      // on dépile. Lancée depuis l'Accueil ou le Profil → pile [Workout] seule :
      // popToTop() n'a rien à dépiler (erreur « POP_TO_TOP was not handled »),
      // on remplace donc l'écran par la liste.
      const stackState = navigation.getState?.();
      if (stackState && stackState.index > 0) {
        navigation.popToTop();
      } else {
        navigation.replace('WorkoutList');
      }
      navigation.navigate('Stats');
    }
  }, [navigation, actions]);

  const closeRecap = useCallback(() => {
    setRecapVisible(false);
    setRecapData(null);
    // Séance en Multi avec butin en attente : la récompense d'équipe s'affiche
    // une fois le récap fermé (jamais par-dessus) — voir closeMultiLoot.
    if (multiLoot) { setLootVisible(true); return; }
    leaveWorkoutScreen();
  }, [multiLoot, leaveWorkoutScreen]);

  const closeMultiLoot = useCallback(() => {
    setLootVisible(false);
    setMultiLoot(null);
    leaveWorkoutScreen();
  }, [leaveWorkoutScreen]);

  // ── Vue globale : un bloc inline par exercice, pas de navigation ──────────
  const renderItemAllInOne = ({ item }) => {
    if (item.type === 'superset') {
      return (
        <View>
          {item.exercises.map((ex, idx) => (
            <InlineExerciseBlock
              key={(ex && (ex._id || ex.id)) || `ss-inline-${idx}`}
              exercise={ex}
              exerciseIndex={item.sourceIndices[idx]}
              onRemoveExercise={onRemove}
              onReplaceExercise={openReplaceSheet}
            />
          ))}
        </View>
      );
    }
    return (
      <InlineExerciseBlock
        exercise={item.exercise}
        exerciseIndex={item.sourceIndex}
        onRemoveExercise={onRemove}
        onReplaceExercise={openReplaceSheet}
      />
    );
  };

  const renderExercise = (ex, sourceIndex, opts = {}) => (
    <ExerciseCard
      key={(ex && (ex._id || ex.id)) || `ex-${sourceIndex}`}
      item={ex}
      inSuperset={!!opts.inSuperset}
      onPress={() => onCardPress(ex, sourceIndex)}
      onReplace={() => openReplaceSheet(sourceIndex)}
      onRemove={() => onRemove(sourceIndex, ex)}
      onToggleSuperset={() => onToggleSuperset(sourceIndex)}
    />
  );

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
    <TouchableOpacity accessibilityRole="button"
      style={styles.addBtn}
      onPress={openAddSheet}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={18} color={Colors.primary} />
      <Text style={styles.addBtnText}>Ajouter un exercice</Text>
    </TouchableOpacity>
  );

  const exerciseCount = sourceExercises.length;
  const totalSets = sourceExercises.reduce((n, ex) => n + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0);
  const doneSets = sourceExercises.reduce((n, ex) => n + (Array.isArray(ex.sets) ? ex.sets.filter((x) => x && x.completed).length : 0), 0);
  const doneExercises = sourceExercises.filter((ex) => ex.done
    || (Array.isArray(ex.sets) && ex.sets.length > 0 && ex.sets.every((x) => x && x.completed))).length;
  const progress = totalSets > 0 ? doneSets / totalSets : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN — structure vérifiable complète
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

      {/* ── Header immersif : nom, chrono, avancement global ── */}
      <View style={styles.header}>
        <Text style={styles.workoutName} numberOfLines={1}>
          {state.name || 'Séance en cours'}
        </Text>
        <Text style={styles.chrono} accessibilityLabel={`Durée de la séance : ${formatElapsed(elapsed)}`}>
          {formatElapsed(elapsed)}
        </Text>
        {exerciseCount > 0 ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.chronoSub}>
              {doneSets}/{totalSets} séries  ·  {doneExercises}/{exerciseCount} exercices  ·  ~{estimateMinutes(exerciseCount)} min
            </Text>
          </View>
        ) : (
          <Text style={styles.chronoSub}>Ajoute tes exercices</Text>
        )}
      </View>

      {/* ── Bulles de présence Multi (Section VII) ── */}
      <LobbyMembersBar
        members={lobby?.members ?? []}
        myId={myId}
        bonusPercent={computeBonusPercent(lobby?.memberCount ?? 0)}
      />

      {/* ── Barre d'outils : affichage + filtres (repliés) ── */}
      {sourceExercises.length > 0 && (
        <View style={styles.toolbar}>
          <View style={styles.segmented} accessibilityRole="tablist">
            {[
              { key: false, label: 'Cartes', icon: 'albums-outline' },
              { key: true, label: 'Tout afficher', icon: 'list-outline' },
            ].map((opt) => {
              const active = allInOne === opt.key;
              return (
                <TouchableOpacity
                  key={opt.label}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => { if (!active) { haptics.selection(); setAllInOne(opt.key); } }}
                  activeOpacity={0.8}
                >
                  <Ionicons name={opt.icon} size={15} color={active ? Colors.textPrimary : Colors.textMuted} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={filtersOpen ? 'Masquer les filtres' : 'Filtrer les exercices'}
            style={[styles.filterBtn, (filtersOpen || filterActive) && styles.filterBtnActive]}
            onPress={() => setFiltersOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={18} color={filtersOpen || filterActive ? Colors.primary : Colors.textSecondary} />
            {filterActive ? <View style={styles.filterDot} /> : null}
          </TouchableOpacity>
        </View>
      )}

      {filtersOpen || filterActive ? <SortBar filters={filters} onChange={setFilters} /> : null}

      {/* ── Liste des exercices — flex:1 pour occuper tout l'espace disponible ── */}
      <View style={styles.listContainer}>
        {displayItems.length > 0 ? (
          <FlatList
            data={displayItems}
            keyExtractor={(item) => item.key}
            renderItem={allInOne ? renderItemAllInOne : renderItem}
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
              <TouchableOpacity accessibilityRole="button" style={styles.emptyAddBtn} onPress={openAddSheet} activeOpacity={0.85}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyAddBtnText}>Ajouter un exercice</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>

      {/* ── Bouton TERMINER — View fixe, jamais dans le scroll ── */}
      <View style={styles.terminateBar}>
        <TouchableOpacity accessibilityRole="button"
          style={[styles.terminateBtn, isFinalizing && styles.terminateBtnLoading]}
          onPress={handleTerminate}
          activeOpacity={0.85}
          disabled={isFinalizing}
        >
          {isFinalizing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="flag" size={18} color="#fff" />
              <Text style={styles.terminateBtnText}>Terminer la séance</Text>
            </>
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
        workoutName={state.name}
        onClose={closeRecap}
      />

      <ShortSessionWarningModal
        visible={shortWarningVisible}
        onModify={() => setShortWarningVisible(false)}
        onForce={handleForceFinish}
        elapsedSeconds={elapsed}
      />

      <ConfirmModal
        visible={abandonModalVisible}
        icon="warning"
        title="Abandonner la séance ?"
        body="Si tu quittes maintenant, les séries de cette séance ne seront pas enregistrées."
        confirmLabel="Quitter la séance"
        cancelLabel="Continuer la séance"
        destructive
        onConfirm={confirmAbandon}
        onCancel={cancelAbandon}
      />

      <ConfirmModal
        visible={!!removeConfirm}
        icon="trash-outline"
        title="Supprimer"
        body={`Retirer "${removeConfirm?.name ?? 'cet exercice'}" de la séance ?`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={confirmRemove}
        onCancel={() => setRemoveConfirm(null)}
      />

      <LobbyWaitingOverlay
        visible={multiWaiting}
        members={lobby?.members ?? []}
        myId={myId}
        bonusPercent={computeBonusPercent(lobby?.memberCount ?? 0)}
        onStopWaiting={stopWaiting}
      />

      <MultiLootModal
        visible={lootVisible && !!multiLoot}
        memberCount={multiLoot?.memberCount}
        bonusPercent={multiLoot?.bonusPercent ?? 0}
        bonusXp={multiLoot?.bonusXp}
        onClose={closeMultiLoot}
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
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  chrono: {
    color: Colors.primary,
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  progressBlock: { alignSelf: 'stretch', alignItems: 'center', marginTop: 8 },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.valid },
  chronoSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
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
    height: 56,
    flexDirection: 'row',
    gap: 10,
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
  terminateBtnLoading: {
    opacity: 0.7,
  },
  terminateBtnText: {
    color: '#fff',
    fontSize: 16.5,
    fontWeight: '800',
  },

  // ── Barre d'outils ─────────────────────────────────────────────────────
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  segmented: {
    flex: 1,
    flexDirection: 'row',
    padding: 3,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 11,
  },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  segmentText: { color: Colors.textMuted, fontSize: 13.5, fontWeight: '700' },
  segmentTextActive: { color: Colors.textPrimary },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterBtnActive: { backgroundColor: 'rgba(254,116,57,0.14)' },
  filterDot: {
    position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary,
  },
});
