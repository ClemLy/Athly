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
import { getWeightHistory } from '../../services';
import { computePeriodStats, DEFAULT_PERIOD, dayKey, longDay } from '../../services/periodStats';
import PeriodSegmentedControl from '../../components/stats/PeriodSegmentedControl';
import VolumeBarChart from '../../components/stats/VolumeBarChart';
import MuscleBalance from '../../components/stats/MuscleBalance';
import WeightProgressChart from '../../components/stats/WeightProgressChart';
import WorkoutCalendar from '../../components/stats/WorkoutCalendar';
import XPProgressBar from '../../components/stats/XPProgressBar';
import WorkoutHistoryList from '../../components/stats/WorkoutHistoryList';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { WeightEntryModal } from '../../components/common';
import { InfoModal } from '../../components/common';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';
import { MOCK_TUTORIAL_LOGS } from '../../data/mockTutorialStats';
import { getErrorMessage } from '../../utils/errorMessages';
import { formatWeight } from '../../utils/format';

const TABS = [
  { id: 'performance', label: 'Performance' },
  { id: 'history',     label: 'Historique' },
];

export default function StatsScreen({ navigation }) {
  const { sessionLogs: realLogs, totalXP, remove } = useWorkoutLogs();
  const { user, refetch: refetchUser } = useUser();

  const [errorInfo, setErrorInfo] = useState(null);
  // Jour choisi dans le calendrier : filtre la liste des séances.
  const [selectedDay, setSelectedDay] = useState(null);

  const handleDelete = useCallback(async (id) => {
    try { await remove(id); } catch (e) {
      setErrorInfo(getErrorMessage(e, 'La suppression n\'a pas abouti. Réessaie dans un instant.'));
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

  // L'objectif de poids vient du profil : chargé ici aussi, sinon il manquait
  // tant que l'écran Profil n'avait pas été ouvert.
  useFocusEffect(useCallback(() => {
    loadWeightHistory();
    if (!user) refetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWeightHistory]));
  const [tab,    setTab]    = useState('performance');
  const [period, setPeriod] = useState(DEFAULT_PERIOD);

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

  const stats = useMemo(() => computePeriodStats(activeLogs, period), [activeLogs, period]);
  const hasLogs = activeLogs.length > 0;

  const dayLogs = useMemo(
    () => (selectedDay ? activeLogs.filter((l) => l.date && dayKey(new Date(l.date)) === selectedDay) : activeLogs),
    [activeLogs, selectedDay],
  );
  // Séance supprimée / données de démo terminées : le filtre n'a plus lieu d'être.
  useEffect(() => {
    if (selectedDay && dayLogs.length === 0) setSelectedDay(null);
  }, [selectedDay, dayLogs.length]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Bandeau mock data */}
      {activeChapterId === 'stats' && (
        <View style={styles.mockBanner}>
          <Ionicons name="flask-outline" size={12} color={Colors.gold} />
          <Text style={styles.mockBannerText}>Données de démonstration, elles disparaissent à la fin du chapitre</Text>
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
          <Text style={styles.title} accessibilityRole="header">Statistiques</Text>
        </View>

        {/* Onglets Performance / Historique */}
        <View style={styles.tabsRow} accessibilityRole="tablist">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
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
            {hasLogs ? (
              <>
                <PeriodSegmentedControl value={period} onChange={setPeriod} />
                <Text style={styles.rangeLabel}>{stats.rangeLabel}</Text>

                {/* ── Chiffres clés + évolution ── */}
                <View style={styles.card} ref={kpisRef} onLayout={onKpisLayout} collapsable={false}>
                  <View style={styles.kpisRow}>
                    <Kpi
                      label={stats.totals.sessions > 1 ? 'Séances' : 'Séance'}
                      value={String(stats.totals.sessions)}
                      delta={diffCount(stats.totals.sessions, stats.previous.sessions)}
                    />
                    <View style={styles.kpiDivider} />
                    <Kpi
                      label="Volume"
                      value={formatWeight(stats.totals.volume)}
                      delta={diffPercent(stats.totals.volume, stats.previous.volume)}
                    />
                    <View style={styles.kpiDivider} />
                    <Kpi
                      label="Temps"
                      value={formatDuration(stats.totals.durationSeconds)}
                      delta={diffDuration(stats.totals.durationSeconds, stats.previous.durationSeconds)}
                    />
                  </View>
                  <Text style={styles.kpiCaption}>
                    {stats.previous.sessions > 0
                      ? `Évolution ${stats.period.previousLabel}`
                      : `Aucune séance ${stats.period.previousLabel.replace('par rapport aux', 'sur les')} pour comparer`}
                  </Text>
                </View>

                <View ref={volumeRef} onLayout={onVolumeLayout} collapsable={false}>
                  <Card title="Volume soulevé" subtitle={`${stats.period.chartLabel}  ·  appuie sur une barre pour le détail`}>
                    <VolumeBarChart buckets={stats.buckets} />
                  </Card>
                </View>

                <View ref={muscleRef} onLayout={onMuscleLayout} collapsable={false}>
                  <Card title="Muscles travaillés" subtitle="Part du volume soulevé sur la période">
                    <MuscleBalance muscles={stats.muscles} neglected={stats.neglected} />
                  </Card>
                </View>
              </>
            ) : (
              <View style={[styles.card, styles.emptyCard]}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="stats-chart" size={26} color={Colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Tes statistiques arrivent</Text>
                <Text style={styles.emptyBody}>
                  Termine ta première séance pour voir ton volume, tes muscles travaillés et ta progression ici.
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.emptyBtn}
                  onPress={() => navigation.navigate('Séances', { screen: 'WorkoutList' })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyBtnText}>Choisir une séance</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Poids (indépendant de la période : toutes les pesées) ── */}
            <View ref={weightRef} onLayout={onWeightLayout} collapsable={false}>
              <Card
                title="Poids"
                right={(
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Ajouter une pesée"
                    style={styles.addWeightBtn}
                    onPress={() => setWeightEntryVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={16} color={Colors.primary} />
                    <Text style={styles.addWeightBtnTxt}>Pesée</Text>
                  </TouchableOpacity>
                )}
              >
                <WeightProgressChart history={weightHistory} goal={user?.poidsCible} />
              </Card>
            </View>

            <Card title="Niveau">
              <XPProgressBar totalXP={activeXP} compact />
            </Card>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <WorkoutCalendar logs={activeLogs} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
            </View>

            <View style={styles.historySection}>
              <View style={styles.historyHead}>
                <Text style={styles.historySectionTitle} numberOfLines={1}>
                  {selectedDay
                    ? `${longDay(selectedDay).charAt(0).toUpperCase()}${longDay(selectedDay).slice(1)}`
                    : `${activeLogs.length} séance${activeLogs.length > 1 ? 's' : ''}`}
                </Text>
                {selectedDay ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setSelectedDay(null)}
                    style={styles.clearFilter}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.clearFilterText}>Tout afficher</Text>
                    <Ionicons name="close" size={15} color={Colors.primary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {hasLogs ? (
                <WorkoutHistoryList
                  logs={dayLogs}
                  onDelete={activeChapterId !== 'stats' ? handleDelete : null}
                />
              ) : (
                <Text style={styles.emptyText}>
                  Tes séances terminées apparaîtront ici, avec le détail de chaque série.
                </Text>
              )}
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

function Card({ title, subtitle, right, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

// delta : { text, trend: 'up' | 'down' | 'same' } | null
function Kpi({ label, value, delta }) {
  const color = delta?.trend === 'up' ? Colors.valid : Colors.textMuted;
  const icon = delta?.trend === 'up' ? 'arrow-up' : delta?.trend === 'down' ? 'arrow-down' : 'remove';
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${label} : ${value}${delta ? `, ${delta.text}` : ''}`}>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {delta ? (
        <View style={styles.kpiDelta}>
          <Ionicons name={icon} size={12} color={color} />
          <Text style={[styles.kpiDeltaText, { color }]}>{delta.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Évolution vs période précédente ──────────────────────────────────────────
// La flèche porte le sens, le texte la valeur (« ↓ 49 % »). Une baisse
// s'affiche en gris, jamais en rouge : moins de volume une semaine n'est pas
// une faute (récupération, vacances…).

const trendOf = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'same');

function diffCount(cur, prev) {
  if (!prev) return null;
  const d = cur - prev;
  return { trend: trendOf(d), text: d === 0 ? 'stable' : String(Math.abs(d)) };
}

function diffPercent(cur, prev) {
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { trend: trendOf(pct), text: pct === 0 ? 'stable' : `${Math.abs(pct)} %` };
}

function diffDuration(cur, prev) {
  if (!prev) return null;
  const d = Math.round((cur - prev) / 60);
  return { trend: trendOf(d), text: d === 0 ? 'stable' : formatDuration(Math.abs(d) * 60) };
}

// 5 400 s → « 1 h 30 » ; 2 700 s → « 45 min »
function formatDuration(seconds) {
  const m = Math.round((Number(seconds) || 0) / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.backgroundDeep },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  mockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,215,0,0.25)',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  mockBannerText: { color: Colors.gold, fontSize: 12, fontWeight: '600', flex: 1 },

  header: { marginBottom: 16 },
  title:  { color: Colors.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },

  // Onglets : neutres (où je suis), la couleur est réservée à la période (filtre).
  tabsRow: {
    flexDirection: 'row', borderRadius: 14, padding: 4,
    backgroundColor: Colors.cardDeep, marginBottom: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tab:            { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabActive:      { backgroundColor: 'rgba(255,255,255,0.10)' },
  tabLabel:       { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  tabLabelActive: { color: Colors.textPrimary, fontWeight: '800' },

  rangeLabel: { color: Colors.textMuted, fontSize: 13, marginTop: 10, marginBottom: 14, textAlign: 'center' },

  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHead:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  cardTitle:    { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  cardSubtitle: { color: Colors.textMuted, fontSize: 13, marginTop: 3 },

  // ── Chiffres clés ──
  kpisRow:    { flexDirection: 'row', alignItems: 'stretch' },
  kpi:        { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  kpiDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 4 },
  kpiValue:   { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  kpiLabel:   { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  kpiDelta:   { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8 },
  kpiDeltaText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  kpiCaption: {
    color: Colors.textMuted, fontSize: 12.5, textAlign: 'center',
    marginTop: 14, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)',
  },

  // ── Poids ──
  addWeightBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 36, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: `${Colors.primary}1A`,
    borderWidth: 1, borderColor: `${Colors.primary}55`,
  },
  addWeightBtnTxt: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  // ── État vide ──
  emptyCard:    { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${Colors.primary}1A`, marginBottom: 14,
  },
  emptyTitle:   { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody:    { color: Colors.textSecondary, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  emptyBtn: {
    marginTop: 18, height: 48, paddingHorizontal: 22, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  emptyText:    { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, paddingVertical: 16 },

  // ── Historique ──
  historySection: { marginTop: 4, marginBottom: 16 },
  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  historySectionTitle: { flex: 1, color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  clearFilter: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 32, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: `${Colors.primary}1A`,
  },
  clearFilterText: { color: Colors.primary, fontSize: 13.5, fontWeight: '700' },
});
