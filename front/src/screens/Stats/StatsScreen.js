import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { useUser } from '../../context/UserContext';
import { aggregateGlobal } from '../../services/stats.service';
import { getWeightHistory } from '../../services/weight.service';
import PeriodSegmentedControl from '../../components/stats/PeriodSegmentedControl';
import VolumeBarChart from '../../components/stats/VolumeBarChart';
import MuscleDistributionPieChart from '../../components/stats/MuscleDistributionPieChart';
import WeightProgressChart from '../../components/stats/WeightProgressChart';
import WorkoutCalendar from '../../components/stats/WorkoutCalendar';
import XPProgressBar from '../../components/stats/XPProgressBar';
import WorkoutHistoryList from '../../components/stats/WorkoutHistoryList';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import WeightEntryModal from '../../components/common/WeightEntryModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import InfoModal from '../../components/common/InfoModal';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';
import { MOCK_TUTORIAL_LOGS } from '../../data/mockTutorialStats';

const TABS = [
  { id: 'performance', label: 'Performance' },
  { id: 'history',     label: 'Historique' },
];

export default function StatsScreen({ navigation }) {
  const { sessionLogs: realLogs, totalXP, remove } = useWorkoutLogs();
  const { user } = useUser();

  const [errorInfo, setErrorInfo] = useState(null);
  const [dayDetail, setDayDetail] = useState(null); // { log, body, deletable }
  const [noSessionInfo, setNoSessionInfo] = useState(null); // dateKey

  const handleDelete = useCallback(async (id) => {
    try { await remove(id); } catch (e) {
      setErrorInfo(e?.message || 'Suppression impossible');
    }
  }, [remove]);

  // ─── Suivi de poids (Section VI) ─────────────────────────────────────────
  const [weightHistory, setWeightHistory] = useState([]);
  const [weightEntryVisible, setWeightEntryVisible] = useState(false);

  const loadWeightHistory = useCallback(async () => {
    try {
      const res = await getWeightHistory();
      setWeightHistory(Array.isArray(res.history) ? res.history : []);
    } catch (_) {
      // Best-effort — un historique de poids manquant ne doit jamais bloquer l'écran.
    }
  }, []);

  useFocusEffect(useCallback(() => { loadWeightHistory(); }, [loadWeightHistory]));
  const [tab,    setTab]    = useState('performance');
  const [period, setPeriod] = useState('month');

  // ─── Tutorial ─────────────────────────────────────────────────────────────
  const {
    pendingChapterId, activeChapterId, activeStep, stepIndex,
    startChapter, registerScrollRef, registerRemeasure,
  } = useTutorial();

  const scrollRef = useRef(null);
  // Offset de scroll courant, suivi en direct pour un défilement piloté par la
  // position RÉELLE des cibles (robuste aux changements de mise en page comme
  // l'ajout du graphique de poids, qui décalait les anciens scrollY fixes).
  const scrollOffsetRef = useRef(0);
  const { ref: kpisRef,       onLayout: onKpisLayout,       remeasure: rKpis   } = useTutorialTarget('stats_kpis');
  const { ref: weightRef,     onLayout: onWeightLayout,     remeasure: rWeight } = useTutorialTarget('stats_weight_chart');
  const { ref: volumeRef,     onLayout: onVolumeLayout,     remeasure: rVolume } = useTutorialTarget('stats_volume_chart');
  const { ref: muscleRef,     onLayout: onMuscleLayout,     remeasure: rMuscle } = useTutorialTarget('stats_muscle_chart');
  const { ref: tabHistoryRef, onLayout: onTabHistoryLayout }                     = useTutorialTarget('stats_tab_history');

  // Enregistre le scrollRef et la fonction de re-mesure dans le contexte
  useEffect(() => {
    registerScrollRef('stats', scrollRef);
    registerRemeasure('stats', () => {
      setTimeout(() => { rKpis(); rWeight(); rVolume(); rMuscle(); }, 50);
    });
  }, [registerScrollRef, registerRemeasure, rKpis, rWeight, rVolume, rMuscle]);

  // Fait défiler pour amener une cible mesurée à une position confortable :
  // haut de cible vers ~160 px (tooltip en-dessous) ou ~300 px (tooltip
  // au-dessus). On mesure en absolu (pageY) et on combine avec l'offset courant,
  // donc aucun nombre magique ne dépend de la hauteur des sections au-dessus.
  const scrollTargetIntoView = useCallback((targetRef, prefersAbove, remeasureAll) => {
    if (!targetRef?.current || !scrollRef.current) return;
    const desiredTop = prefersAbove ? 300 : 160;
    targetRef.current.measure((_x, _y, _w, _h, _pageX, pageY) => {
      if (pageY == null) return;
      const newY = Math.max(0, scrollOffsetRef.current + (pageY - desiredTop));
      scrollRef.current.scrollTo({ y: newY, animated: true });
      if (remeasureAll) setTimeout(remeasureAll, 350);
    });
  }, []);

  // Démarrage du chapitre quand l'écran gagne le focus.
  // On force d'abord l'onglet Performance pour éviter que l'utilisateur,
  // resté sur Historique, ne voie un écran vide au lancement du chapitre.
  useFocusEffect(
    useCallback(() => {
      if (pendingChapterId === 'stats') {
        setTab('performance');
        const t = setTimeout(() => startChapter('stats'), 400);
        return () => clearTimeout(t);
      }
    }, [pendingChapterId, startChapter]),
  );

  // Auto-scroll + autoActions quand l'étape change.
  // Défilement piloté par la cible (robuste) pour les sections défilables ;
  // pour la cible d'onglet Historique (barre de nav haute) on remonte en tête.
  useEffect(() => {
    if (activeChapterId !== 'stats' || !activeStep) return;

    const remeasureAll = () => { rKpis(); rWeight(); rVolume(); rMuscle(); };
    const REF_BY_KEY = {
      stats_kpis:          kpisRef,
      stats_weight_chart:  weightRef,
      stats_volume_chart:  volumeRef,
      stats_muscle_chart:  muscleRef,
    };
    const targetRef = activeStep.targetKey ? REF_BY_KEY[activeStep.targetKey] : null;

    if (targetRef) {
      // Laisse le rendu se stabiliser puis amène la cible à bonne hauteur.
      const t = setTimeout(
        () => scrollTargetIntoView(targetRef, activeStep.position === 'top', remeasureAll),
        80,
      );
      return () => clearTimeout(t);
    }
    // Cibles hors flux défilable (onglet) ou cartes centrées : scroll fixe.
    if (activeStep.scrollY != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: activeStep.scrollY, animated: true });
      setTimeout(remeasureAll, 350);
    }
    if (activeStep.autoAction === 'switchToHistory') {
      const t = setTimeout(() => setTab('history'), 300);
      return () => clearTimeout(t);
    }
  }, [activeChapterId, stepIndex]);

  const handleTabChange = useCallback((tabId) => {
    setTab(tabId);
  }, []);

  // ─── Mock data injection ──────────────────────────────────────────────────
  // Pendant le chapitre Stats, on utilise les fausses données pour que l'écran
  // soit visuellement parlant même pour un compte vierge.
  const activeLogs = activeChapterId === 'stats' ? MOCK_TUTORIAL_LOGS : realLogs;
  const activeXP   = activeChapterId === 'stats'
    ? MOCK_TUTORIAL_LOGS.reduce((s, l) => s + l.xpEarned, 0)
    : totalXP;

  const stats = useMemo(() => aggregateGlobal(activeLogs, period), [activeLogs, period]);

  const onSelectDate = useCallback((dateKey) => {
    const matching = activeLogs.filter((l) => l.date && l.date.slice(0, 10) === dateKey);
    if (matching.length === 0) {
      setNoSessionInfo(dateKey);
      return;
    }
    const log = matching[0];
    setDayDetail({
      log,
      body: [`Volume: ${Math.round(log.totalVolume)} kg`, `Sets: ${log.setsCompleted}`, `XP: ${log.xpEarned}`].join('\n'),
      deletable: activeChapterId !== 'stats',
    });
  }, [activeLogs, activeChapterId]);

  const confirmDeleteDayDetail = useCallback(async () => {
    const log = dayDetail?.log;
    setDayDetail(null);
    if (!log) return;
    try { await remove(log.id); } catch (e) {
      setErrorInfo(e?.message || 'Suppression impossible');
    }
  }, [dayDetail, remove]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Bandeau mock data */}
      {activeChapterId === 'stats' && (
        <View style={styles.mockBanner}>
          <Ionicons name="flask-outline" size={12} color="#FFD700" />
          <Text style={styles.mockBannerText}>Données de démonstration - disparaîtront à la fin du chapitre</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Statistiques</Text>
          <Text style={styles.subtitle}>Mesure tes progrès dans le temps</Text>
        </View>

        {/* Onglets Performance / Historique */}
        <View style={styles.tabsRow}>
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <TouchableOpacity
                key={t.id}
                ref={t.id === 'history' ? tabHistoryRef : null}
                onLayout={t.id === 'history' ? onTabHistoryLayout : undefined}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => handleTabChange(t.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'performance' ? (
          <>
            <PeriodSegmentedControl value={period} onChange={setPeriod} />

            <View style={styles.kpisRow} ref={kpisRef} onLayout={onKpisLayout} collapsable={false}>
              <Kpi label="Séances" value={stats.totalSessions} icon="bookmark" />
              <Kpi label="Sets"    value={stats.totalSets}     icon="checkmark-done" />
              <Kpi label="Volume"  value={`${Math.round(stats.totalVolume).toLocaleString('fr-FR')} kg`} icon="barbell" wide />
            </View>

            <View ref={weightRef} onLayout={onWeightLayout} collapsable={false}>
              <Card title="Suivi de poids">
                <WeightProgressChart history={weightHistory} goal={user?.poidsCible} />
                <TouchableOpacity
                  style={styles.addWeightBtn}
                  onPress={() => setWeightEntryVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.addWeightBtnTxt}>Ajouter une pesée</Text>
                </TouchableOpacity>
              </Card>
            </View>

            <View ref={volumeRef} onLayout={onVolumeLayout} collapsable={false}>
              <Card title="Volume par période">
                <VolumeBarChart timeline={stats.timeline} />
              </Card>
            </View>

            <View ref={muscleRef} onLayout={onMuscleLayout} collapsable={false}>
              <Card title="Répartition musculaire">
                <MuscleDistributionPieChart distribution={stats.muscleDistribution} />
              </Card>
            </View>

            <Card title="Niveau & XP">
              <XPProgressBar totalXP={activeXP} compact />
            </Card>
          </>
        ) : (
          <>
            <Card title="Calendrier">
              <WorkoutCalendar workoutDates={stats.calendarDates} onSelectDate={onSelectDate} />
            </Card>

            <View style={styles.historySection}>
              <Text style={styles.historySectionTitle}>
                Séances ({activeLogs.length})
              </Text>
              <WorkoutHistoryList
                logs={activeLogs}
                onDelete={activeChapterId !== 'stats' ? handleDelete : null}
              />
            </View>
          </>
        )}
      </ScrollView>

      {activeChapterId === 'stats' && (
        <TutorialOverlay navigation={navigation} />
      )}

      <WeightEntryModal
        visible={weightEntryVisible}
        onClose={() => setWeightEntryVisible(false)}
        onSaved={loadWeightHistory}
      />

      {dayDetail?.deletable ? (
        <ConfirmModal
          visible={!!dayDetail}
          icon="calendar-outline"
          title={dayDetail?.log?.name}
          body={dayDetail?.body}
          confirmLabel="Supprimer"
          cancelLabel="Fermer"
          destructive
          onConfirm={confirmDeleteDayDetail}
          onCancel={() => setDayDetail(null)}
        />
      ) : (
        <InfoModal
          visible={!!dayDetail}
          icon="calendar-outline"
          title={dayDetail?.log?.name}
          body={dayDetail?.body}
          closeLabel="Fermer"
          onClose={() => setDayDetail(null)}
        />
      )}

      <InfoModal
        visible={!!noSessionInfo}
        icon="calendar-outline"
        title="Aucune séance"
        body={noSessionInfo ? `Pas de séance le ${noSessionInfo}.` : ''}
        onClose={() => setNoSessionInfo(null)}
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

function Card({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Kpi({ label, value, icon, wide = false }) {
  return (
    <View style={[styles.kpi, wide && styles.kpiWide]}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.backgroundDeep },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 },

  mockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,215,0,0.25)',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  mockBannerText: { color: '#FFD700', fontSize: 11, fontWeight: '600', flex: 1 },

  header:   { marginBottom: 16 },
  title:    { color: Colors.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },

  tabsRow: {
    flexDirection: 'row', borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tab:           { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:     { backgroundColor: Colors.primary },
  tabLabel:      { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  tabLabelActive:{ color: '#fff' },

  kpisRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpi: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  kpiWide:  { flex: 2 },
  kpiValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '900', marginTop: 8 },
  kpiLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 4 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 12 },
  addWeightBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, height: 40, borderRadius: 11,
    backgroundColor: `${Colors.primary}14`,
    borderWidth: 1, borderColor: `${Colors.primary}40`,
  },
  addWeightBtnTxt: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingVertical: 12 },

  historySection:      { marginBottom: 16 },
  historySectionTitle: {
    color: Colors.textPrimary, fontSize: 14, fontWeight: '800',
    marginBottom: 12,
  },
});
