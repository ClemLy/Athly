import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { aggregateGlobal } from '../../services/stats.service';
import PeriodSegmentedControl from '../../components/stats/PeriodSegmentedControl';
import VolumeBarChart from '../../components/stats/VolumeBarChart';
import MuscleDistributionPieChart from '../../components/stats/MuscleDistributionPieChart';
import WorkoutCalendar from '../../components/stats/WorkoutCalendar';
import XPProgressBar from '../../components/stats/XPProgressBar';
import WorkoutHistoryList from '../../components/stats/WorkoutHistoryList';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';
import { MOCK_TUTORIAL_LOGS } from '../../data/mockTutorialStats';

const TABS = [
  { id: 'performance', label: 'Performance' },
  { id: 'history',     label: 'Historique' },
];

export default function StatsScreen({ navigation }) {
  const { sessionLogs: realLogs, totalXP, remove } = useWorkoutLogs();

  const handleDelete = useCallback(async (id) => {
    try { await remove(id); } catch (e) {
      Alert.alert('Erreur', e?.message || 'Suppression impossible');
    }
  }, [remove]);
  const [tab,    setTab]    = useState('performance');
  const [period, setPeriod] = useState('month');

  // ─── Tutorial ─────────────────────────────────────────────────────────────
  const {
    pendingChapterId, activeChapterId, activeStep, stepIndex,
    startChapter, registerScrollRef, registerRemeasure,
  } = useTutorial();

  const scrollRef = useRef(null);
  const { ref: kpisRef,       onLayout: onKpisLayout,       remeasure: rKpis   } = useTutorialTarget('stats_kpis');
  const { ref: volumeRef,     onLayout: onVolumeLayout,     remeasure: rVolume } = useTutorialTarget('stats_volume_chart');
  const { ref: muscleRef,     onLayout: onMuscleLayout,     remeasure: rMuscle } = useTutorialTarget('stats_muscle_chart');
  const { ref: tabHistoryRef, onLayout: onTabHistoryLayout }                     = useTutorialTarget('stats_tab_history');

  // Enregistre le scrollRef et la fonction de re-mesure dans le contexte
  useEffect(() => {
    registerScrollRef('stats', scrollRef);
    registerRemeasure('stats', () => {
      setTimeout(() => { rKpis(); rVolume(); rMuscle(); }, 50);
    });
  }, [registerScrollRef, registerRemeasure, rKpis, rVolume, rMuscle]);

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

  // Auto-scroll + autoActions quand l'étape change
  useEffect(() => {
    if (activeChapterId !== 'stats' || !activeStep) return;
    const y = activeStep.scrollY;
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y, animated: true });
      setTimeout(() => { rKpis(); rVolume(); rMuscle(); }, 350);
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
      Alert.alert('Aucune séance', `Pas de séance le ${dateKey}.`);
      return;
    }
    const log = matching[0];
    Alert.alert(
      log.name,
      [`Volume: ${Math.round(log.totalVolume)} kg`, `Sets: ${log.setsCompleted}`, `XP: ${log.xpEarned}`].join('\n'),
      [
        { text: 'Fermer', style: 'cancel' },
        ...(activeChapterId !== 'stats' ? [{
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try { await remove(log.id); } catch (e) {
              Alert.alert('Erreur', e?.message || 'Suppression impossible');
            }
          },
        }] : []),
      ],
    );
  }, [activeLogs, remove, activeChapterId]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Bandeau mock data */}
      {activeChapterId === 'stats' && (
        <View style={styles.mockBanner}>
          <Ionicons name="flask-outline" size={12} color="#FFD700" />
          <Text style={styles.mockBannerText}>Données de démonstration — disparaîtront à la fin du chapitre</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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

  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingVertical: 12 },

  historySection:      { marginBottom: 16 },
  historySectionTitle: {
    color: Colors.textPrimary, fontSize: 14, fontWeight: '800',
    marginBottom: 12,
  },
});
