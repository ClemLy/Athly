import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, MUSCLE_GROUP_COLORS } from '../../constants/theme';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import {
  computeStreak,
  recommendNextMuscleGroup,
  aggregateGlobal,
  xpToLevel,
} from '../../services/stats.service';
import { findMuscleGroup } from '../../constants/exerciseFilters';
import {
  TEMPLATES,
  instantiateWorkout,
  findTemplateForGroup,
} from '../../data/workoutTemplates';

import EmptyHomeState from '../../components/home/EmptyHomeState';
import HeroSessionCard from '../../components/home/HeroSessionCard';
import QuickStatsRow from '../../components/home/QuickStatsRow';
import StreakBadge from '../../components/profile/StreakBadge';
import DailyQuestsCard from '../../components/home/DailyQuestsCard';
import RecoveryRitualsCard from '../../components/home/RecoveryRitualsCard';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';
import { useDevSettings } from '../../hooks/useDevSettings';
import { MOCK_TUTORIAL_LOGS } from '../../data/mockTutorialStats';

// Écran d'accueil. Bascule entre EmptyHomeState (compte vierge) et état actif
// (séance recommandée + stats semaine + récents) selon `logs.length`.
// Anim de fade au premier rendu pour éviter le flash empty→active.
//
export default function HomeScreen({ navigation }) {
  const { sessionLogs: logs, activityLogs, loading, totalXP } = useWorkoutLogs();
  const { forceShowRituals, reload: reloadDevSettings } = useDevSettings();

  // ─── Tutorial ──────────────────────────────────────────────────────────────
  const {
    hasCompleted, bootstrapped, pendingChapterId, startChapter,
    activeChapterId, activeStep, stepIndex,
    registerScrollRef, registerRemeasure,
  } = useTutorial();

  // Injection de données fantômes pendant le Chapitre 1 pour que le spotlight
  // puisse pointer les éléments actifs (level chip, hero, stats, quêtes, rituel).
  const isTutorialDashboard = activeChapterId === 'dashboard';
  const activeLogs = isTutorialDashboard
    ? MOCK_TUTORIAL_LOGS.filter(l => l.type !== 'quest_reward')
    : activityLogs;
  const activeXP = isTutorialDashboard
    ? MOCK_TUTORIAL_LOGS.reduce((s, l) => s + l.xpEarned, 0)
    : totalXP;
  const { ref: levelChipRef,  onLayout: onLevelChipLayout,  remeasure: rLevel     } = useTutorialTarget('home_level_chip');
  const { ref: heroRef,       onLayout: onHeroLayout,       remeasure: rHero      } = useTutorialTarget('home_herosession');
  const { ref: quickStatsRef, onLayout: onQuickStatsLayout, remeasure: rQuickStats } = useTutorialTarget('home_quickstats');
  const { ref: questsRef,     onLayout: onQuestsLayout,     remeasure: rQuests    } = useTutorialTarget('home_quests');
  const { ref: ritualRef,     onLayout: onRitualLayout,     remeasure: rRitual    } = useTutorialTarget('home_ritual');

  const scrollRef = useRef(null);

  // Enregistre la ref de scroll dans le contexte
  useEffect(() => {
    registerScrollRef('dashboard', scrollRef);
    registerRemeasure('dashboard', () => {
      setTimeout(() => { rLevel(); rHero(); rQuickStats(); rQuests(); rRitual(); }, 50);
    });
  }, [registerScrollRef, registerRemeasure, rLevel, rHero, rQuickStats, rQuests, rRitual]);

  // Auto-scroll quand l'étape change
  useEffect(() => {
    if (activeChapterId !== 'dashboard' || !activeStep || activeStep.scrollY == null) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: activeStep.scrollY, animated: true });
      setTimeout(() => { rLevel(); rHero(); rQuickStats(); rQuests(); rRitual(); }, 350);
    }
  }, [activeChapterId, stepIndex]);

  // Recharge les dev settings (forceShowRituals, bypassAnticheat…) à chaque focus.
  // useDevSettings est un hook local (pas un contexte), donc chaque instance doit
  // recharger manuellement depuis AsyncStorage quand l'écran reprend le focus.
  useFocusEffect(
    useCallback(() => { reloadDevSettings(); }, [reloadDevSettings]),
  );

  // Auto-démarrage au premier login — attend que le bootstrap AsyncStorage soit terminé
  // avant de vérifier hasCompleted, pour éviter un faux-positif sur l'état initial true.
  useFocusEffect(
    useCallback(() => {
      if (!bootstrapped) return;
      if (!hasCompleted && activeChapterId === null) {
        const timer = setTimeout(() => startChapter('dashboard'), 600);
        return () => clearTimeout(timer);
      }
      if (pendingChapterId === 'dashboard') {
        const timer = setTimeout(() => startChapter('dashboard'), 400);
        return () => clearTimeout(timer);
      }
    }, [bootstrapped, hasCompleted, pendingChapterId, activeChapterId, startChapter]),
  );

  // ─── Anim d'entrée pour éviter le flash content au 1er chargement ────
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, opacity]);

  // ─── Calculs métier (memoïsés) ───────────────────────────────────────────
  const workoutLogs = useMemo(() => activeLogs.filter((l) => l.type !== 'ritual'), [activeLogs]);
  const recommendedGroup = useMemo(() => recommendNextMuscleGroup(workoutLogs), [workoutLogs]);
  const recommendedTemplate = useMemo(
    () => findTemplateForGroup(recommendedGroup) || TEMPLATES[0],
    [recommendedGroup],
  );
  const weekly = useMemo(() => aggregateGlobal(workoutLogs, 'week'), [workoutLogs]);
  const streak = useMemo(() => computeStreak(activeLogs), [activeLogs]);
  const { level } = useMemo(() => xpToLevel(activeXP), [activeXP]);
  const recentLogs = useMemo(() => workoutLogs.slice(0, 3), [workoutLogs]);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const hasWorkoutToday = useMemo(
    () => !loading && workoutLogs.some((l) => l.date && l.date.slice(0, 10) === todayKey),
    [loading, workoutLogs, todayKey],
  );
  const hasRitualToday = useMemo(
    () => !loading && activeLogs.some((l) => l.type === 'ritual' && l.date && l.date.slice(0, 10) === todayKey),
    [loading, activeLogs, todayKey],
  );

  const recommendedReason = useMemo(() => {
    if (!workoutLogs || workoutLogs.length === 0) {
      return 'On démarre par une séance Push pour bien lancer ton programme.';
    }
    const groupLabel = (findMuscleGroup(recommendedGroup) || {}).label || 'ce groupe';
    return `${groupLabel} n'a pas été suffisamment travaillé récemment. On rééquilibre.`;
  }, [workoutLogs, recommendedGroup]);

  // ─── Navigation ──────────────────────────────────────────────────────────
  const startRecommended = useCallback(() => {
    if (!recommendedTemplate) return;
    const workout = instantiateWorkout(recommendedTemplate);
    if (!workout) return;
    // Pas besoin de loadWorkout ici : WorkoutScreen, à l'intérieur du WorkoutStack,
    // détecte route.params.workout et appelle loadWorkout via son propre useEffect.
    // (Le provider WorkoutInProgressContext est scopé au WorkoutStack.)
    if (navigation) {
      navigation.navigate('Séances', { screen: 'Workout', params: { workout } });
    }
  }, [recommendedTemplate, navigation]);

  const goToTemplates = useCallback(() => {
    if (navigation) navigation.navigate('Séances', { screen: 'WorkoutList' });
  }, [navigation]);

  const goToStats = useCallback(() => {
    if (navigation) navigation.navigate('Stats');
  }, [navigation]);

  const isFirstTime = !loading && workoutLogs.length === 0 && !hasRitualToday;

  return (
    <SafeAreaView style={styles.safe}>
      {isTutorialDashboard && (
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
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Bonjour</Text>
            <Text style={styles.tagline}>
              {isFirstTime ? 'Prêt à commencer ?' : 'Continue sur ta lancée'}
            </Text>
          </View>
          {!isFirstTime && !loading ? (
            <View style={styles.headerRight} ref={levelChipRef} onLayout={onLevelChipLayout} collapsable={false}>
              <TouchableOpacity
                style={styles.levelChip}
                onPress={goToStats}
                activeOpacity={0.85}
              >
                <Text style={styles.levelChipKicker}>NIV.</Text>
                <Text style={styles.levelChipValue}>{level}</Text>
              </TouchableOpacity>
              {streak > 0 ? <StreakBadge streak={streak} compact /> : null}
            </View>
          ) : null}
        </View>

        <Animated.View style={{ opacity }}>
          {loading ? null : isFirstTime ? (
            <EmptyHomeState
              onStart={startRecommended}
              onBrowseTemplates={goToTemplates}
            />
          ) : (
            <View style={styles.activeBlock}>
              <View ref={heroRef} onLayout={onHeroLayout} collapsable={false}>
                <HeroSessionCard
                  title="Séance recommandée"
                  templateName={recommendedTemplate ? recommendedTemplate.name : 'Séance'}
                  reason={recommendedReason}
                  exerciseCount={recommendedTemplate ? recommendedTemplate.buildExercises().length : 0}
                  durationMin={recommendedTemplate ? recommendedTemplate.estimatedDurationMin : 0}
                  groupId={recommendedGroup}
                  onStart={startRecommended}
                />
              </View>

              <View style={styles.section} ref={quickStatsRef} onLayout={onQuickStatsLayout} collapsable={false}>
                <Text style={styles.sectionTitle}>Cette semaine</Text>
                <QuickStatsRow
                  sessions={weekly.totalSessions}
                  volume={weekly.totalVolume}
                  streak={streak}
                />
              </View>

              <View style={styles.section} ref={questsRef} onLayout={onQuestsLayout} collapsable={false}>
                <Text style={styles.sectionTitle}>Quêtes du jour</Text>
                <DailyQuestsCard />
              </View>

              {(!hasWorkoutToday || hasRitualToday || forceShowRituals) && !loading ? (
                <View style={styles.section} ref={ritualRef} onLayout={onRitualLayout} collapsable={false}>
                  <Text style={styles.sectionTitle}>Récupération Active</Text>
                  <RecoveryRitualsCard />
                </View>
              ) : null}

              {recentLogs.length > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Récents</Text>
                    <TouchableOpacity onPress={goToStats} activeOpacity={0.8}>
                      <Text style={styles.sectionLink}>Tout voir</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recentList}>
                    {recentLogs.map((log, i) => (
                      <RecentLogRow
                        key={log.id || `r-${i}`}
                        log={log}
                        isLast={i === recentLogs.length - 1}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.secondaryCta}
                onPress={goToTemplates}
                activeOpacity={0.85}
              >
                <Ionicons name="library-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.secondaryCtaText}>Choisir une autre séance</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Tutorial overlay — visible uniquement pour le chapitre 1 (dashboard) */}
      {activeChapterId === 'dashboard' && (
        <TutorialOverlay navigation={navigation} />
      )}
    </SafeAreaView>
  );
}

function RecentLogRow({ log, isLast }) {
  const date = useMemo(() => new Date(log.date), [log.date]);
  const dateLabel = useMemo(() => date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }), [date]);
  const groupColor = useMemo(() => {
    const dist = log.muscleDistribution || {};
    const first = Object.keys(dist)[0];
    if (first && MUSCLE_GROUP_COLORS[first]) return MUSCLE_GROUP_COLORS[first];
    return Colors.secondaryAccent;
  }, [log.muscleDistribution]);

  return (
    <View style={[styles.recentRow, isLast && styles.recentRowLast]}>
      <View style={[styles.recentBar, { backgroundColor: groupColor }]} />
      <View style={styles.recentContent}>
        <Text style={styles.recentName} numberOfLines={1}>{log.name || 'Séance'}</Text>
        <Text style={styles.recentMeta}>
          {dateLabel} • {Math.round(Number(log.totalVolume) || 0)} kg • {Number(log.setsCompleted) || 0} sets
        </Text>
      </View>
      <Text style={styles.recentXP}>+{Math.round(Number(log.xpEarned) || 0)} XP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundDeep },
  mockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,215,0,0.10)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,215,0,0.20)',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  mockBannerText: { color: '#FFD700', fontSize: 11, fontWeight: '600', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },

  brandMark: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  headerLeft: { flex: 1 },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  greeting: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(110, 106, 240, 0.15)',
    borderColor: 'rgba(110, 106, 240, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  levelChipKicker: {
    color: Colors.secondaryAccent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginRight: 4,
  },
  levelChipValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },

  activeBlock: {},
  section: {
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionLink: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },

  recentList: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 14,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  recentRowLast: {
    borderBottomWidth: 0,
  },
  recentBar: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  recentContent: { flex: 1 },
  recentName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  recentMeta: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  recentXP: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },

  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardDeep,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 18,
  },
  secondaryCtaText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
});
