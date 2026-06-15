import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../../context/AuthContext';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { useUser } from '../../context/UserContext';
import { Colors } from '../../constants/theme';
import {
  getPersonalRecords,
  aggregateActivityHeatmap,
  xpToLevel,
  computeStreak,
  getRank,
} from '../../services/stats.service';
import { MAJOR_EXERCISES } from '../../data/majorExercises';
import { useAvatarFrame } from '../../hooks/useAvatarFrame';
import { useDevSettings } from '../../hooks/useDevSettings';
import { useFeaturedTrophies } from '../../hooks/useFeaturedTrophies';
import { getTheme } from '../../data/profileThemes';
import { evaluateTrophies, ULTIMATE_TROPHY } from '../../data/trophyCatalog';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';

import HeroLevelCard    from '../../components/profile/HeroLevelCard';
import TrophyGrid       from '../../components/profile/TrophyGrid';
import PersonalRecordsList from '../../components/profile/PersonalRecordsList';
import ActivityHeatmap  from '../../components/profile/ActivityHeatmap';
import EmberParticles   from '../../components/profile/EmberParticles';
import StreakBadge      from '../../components/profile/StreakBadge';
import BorderPicker     from '../../components/profile/BorderPicker';


function buildBgGradient(isGod, isLegend, isElite) {
  if (isGod)    return ['#0A0800', '#100D02', Colors.bgAbyss, '#08080E'];
  if (isLegend) return [Colors.bgAbyss, '#0C0816', '#0D0A1A', Colors.bgAbyss];
  if (isElite)  return [Colors.bgAbyss, '#0A0A18', '#0D0D1C', Colors.bgAbyss];
  return [Colors.bgAbyss, '#09090F', Colors.bgAbyss];
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }) {
  const { signOut } = useAuth();
  const { sessionLogs: logs, activityLogs, totalXP, loading: logsLoading } = useWorkoutLogs();
  const { user, loading: profileLoading, refetch: refetchUser } = useUser();
  const [borderPickerVisible, setBorderPickerVisible] = useState(false);
  const { shapeId, colorId, selectShape, selectColor } = useAvatarFrame();
  const { profileThemeId, godMode, trophyOverrides, reload: reloadDevSettings } = useDevSettings();
  const { featuredIds, toggleFeatured, reload: reloadFeatured } = useFeaturedTrophies();

  // ─── Tutorial ─────────────────────────────────────────────────────────────
  const {
    pendingChapterId, activeChapterId, activeStep, stepIndex,
    startChapter, registerScrollRef, registerRemeasure,
  } = useTutorial();
  const { ref: heroCRef,    onLayout: onHeroCLayout,    remeasure: rHeroC    } = useTutorialTarget('profile_herocard');
  const { ref: quickActRef, onLayout: onQuickActLayout, remeasure: rQuickAct } = useTutorialTarget('profile_quickactions');
  const { ref: vitrineRef,  onLayout: onVitrineLayout,  remeasure: rVitrine  } = useTutorialTarget('profile_vitrine');

  const scrollRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      if (pendingChapterId === 'profile') {
        const t = setTimeout(() => startChapter('profile'), 400);
        return () => clearTimeout(t);
      }
    }, [pendingChapterId, startChapter]),
  );

  // Enregistre le ScrollView et la fonction de re-mesure dans le contexte tutoriel.
  // Indispensable pour que scrollY: 260 de l'étape profile_vitrine fonctionne,
  // car sans ça la vitrine reste hors-écran au moment de la mesure.
  useEffect(() => {
    registerScrollRef('profile', scrollRef);
    registerRemeasure('profile', () => {
      setTimeout(() => { rHeroC(); rQuickAct(); rVitrine(); }, 50);
    });
  }, [registerScrollRef, registerRemeasure, rHeroC, rQuickAct, rVitrine]);

  // Auto-scroll + re-mesure lors des changements d'étape du chapitre profil
  useEffect(() => {
    if (activeChapterId !== 'profile' || !activeStep || activeStep.scrollY == null) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: activeStep.scrollY, animated: true });
      setTimeout(() => { rHeroC(); rQuickAct(); rVitrine(); }, 350);
    }
  }, [activeChapterId, stepIndex]);

  const insets = useSafeAreaInsets();

  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!profileLoading && !logsLoading) {
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    }
  }, [profileLoading, logsLoading, opacity]);

  // Rafraîchit l'utilisateur, les trophées mis en avant et les dev settings à chaque focus
  useFocusEffect(
    useCallback(() => {
      refetchUser();
      reloadFeatured();
      reloadDevSettings();
    }, [refetchUser, reloadFeatured, reloadDevSettings]),
  );

  // ─── Computed values ──────────────────────────────────────────────────────
  const records       = useMemo(() => getPersonalRecords(logs, MAJOR_EXERCISES), [logs]);
  const heatmap       = useMemo(() => aggregateActivityHeatmap(logs), [logs]);
  const totalSessions = logs.length;
  const totalActiveDays = useMemo(() => {
    const days = new Set();
    for (const log of logs) { if (log && log.date) days.add(log.date.slice(0, 10)); }
    return days.size;
  }, [logs]);

  const { level } = useMemo(() => xpToLevel(totalXP), [totalXP]);
  const realRank   = useMemo(() => getRank(level), [level]);
  const streak     = useMemo(() => computeStreak(activityLogs), [activityLogs]);

  const evaluatedTrophies = useMemo(() => {
    const base = evaluateTrophies(level, totalSessions, logs, totalXP, trophyOverrides || {});
    const ultimateUnlocked = base.every((t) => t.unlocked);
    // Ajoute le Trophée Ultime au catalogue pour que TrophyGrid puisse le trouver par ID
    return [...base, { ...ULTIMATE_TROPHY, unlocked: ultimateUnlocked, naturalUnlocked: ultimateUnlocked }];
  }, [level, totalSessions, logs, totalXP, trophyOverrides]);

  // Active profile theme (null when 'auto' or not set)
  const activeTheme = useMemo(() => {
    const t = getTheme(profileThemeId);
    return t && t.id !== 'auto' ? t : null;
  }, [profileThemeId]);

  // Background variant: theme overrides level-based flags
  const isElite  = activeTheme ? ['elite','legend','god'].includes(activeTheme.bgVariant) : level >= 91;
  const isLegend = activeTheme ? ['legend','god'].includes(activeTheme.bgVariant)         : level >= 171;
  const isGod    = activeTheme ? activeTheme.bgVariant === 'god'                          : level >= 200;

  // rank is used for QuickBtn accent — also override with theme
  const rank = useMemo(() => {
    if (!activeTheme) return realRank;
    return { ...realRank, color: activeTheme.accentColor || realRank.color };
  }, [activeTheme, realRank]);

  const bgColors = buildBgGradient(isGod, isLegend, isElite);
  const topPad   = insets.top + 16;

  if (profileLoading && !user && logsLoading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[styles.centered, { paddingTop: topPad }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  const userName    = (user && user.name) || 'Athlète';
  const userInitial = userName.charAt(0).toUpperCase();

  const onPressRecord = (record) => {
    if (!record || !navigation) return;
    navigation.navigate('Séances', {
      screen: 'ExerciseStats',
      params: { exerciseRef: { name: record.name, group: record.group } },
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Deep Abyss background */}
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} pointerEvents="none" />

      {/* Gear icon — top-right corner, above scroll content */}
      <TouchableOpacity
        style={[styles.gearBtn, { top: insets.top + 8 }]}
        onPress={() => navigation && navigation.navigate('Settings')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity }}>

          {/* ── Hero Level Card ── */}
          <View style={styles.heroWrapper} ref={heroCRef} onLayout={onHeroCLayout} collapsable={false}>
            <HeroLevelCard
              name={userName}
              initial={userInitial}
              totalXP={totalXP}
              totalSessions={totalSessions}
              totalActiveDays={totalActiveDays}
              shapeId={shapeId}
              colorId={colorId}
              profileTheme={activeTheme}
            />
            <EmberParticles
              visible={activeTheme ? activeTheme.shimmer : isLegend}
              color={isGod || activeTheme?.bgVariant === 'god' ? '#FFD700' : '#C084FC'}
            />
          </View>

          {/* ── Streak ── */}
          {streak > 0 && <View style={styles.streakWrap}><StreakBadge streak={streak} /></View>}

          {/* ── Quick actions ── */}
          <View style={styles.quickActions} ref={quickActRef} onLayout={onQuickActLayout} collapsable={false}>
            <QuickBtn
              icon="color-palette-outline"
              label="Cadre"
              onPress={() => setBorderPickerVisible(true)}
              accentColor={isElite ? rank.color : null}
            />
            <QuickBtn
              icon="map-outline"
              label="Roadmap"
              onPress={() => navigation && navigation.navigate('RankRoadmap')}
              accentColor={isElite ? rank.color : null}
            />
            <QuickBtn
              icon="trophy-outline"
              label="Trophées"
              onPress={() => navigation && navigation.navigate('TrophyRoom')}
              accentColor={isElite ? rank.color : null}
            />
          </View>

          {/* ── Vitrine de trophées ── */}
          <View ref={vitrineRef} onLayout={onVitrineLayout} collapsable={false}>
          <Section title="Vitrine" onSeeAll={() => navigation && navigation.navigate('TrophyRoom')}>
            <TrophyGrid
              evaluatedCatalog={evaluatedTrophies}
              featuredIds={featuredIds}
              toggleFeatured={toggleFeatured}
              onNavigateToRoom={() => navigation && navigation.navigate('TrophyRoom')}
            />
          </Section>

          </View>

          {/* ── Records personnels ── */}
          <Section title="Records personnels">
            <GlassCard>
              <PersonalRecordsList records={records} onPressItem={onPressRecord} />
            </GlassCard>
          </Section>

          {/* ── Activité 12 mois ── */}
          <Section title="Activité — 12 mois">
            <GlassCard>
              <ActivityHeatmap heatmap={heatmap} />
            </GlassCard>
          </Section>

          {/* ── Actions ── */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation && navigation.navigate('EditProfile')}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.editBtnText}>Modifier le profil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={signOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={14} color={Colors.error} style={{ marginRight: 6 }} />
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      <BorderPicker
        visible={borderPickerVisible}
        onClose={() => setBorderPickerVisible(false)}
        currentShapeId={shapeId}
        currentColorId={colorId}
        playerLevel={level}
        userInitial={userInitial}
        onSelectShape={selectShape}
        onSelectColor={selectColor}
      />

      {activeChapterId === 'profile' && (
        <TutorialOverlay navigation={navigation} />
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children, onSeeAll }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.seeAllText}>Voir tout</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

// Wrapper glassmorphism pour les sections récupérées (Records + Heatmap)
// Adapts the existing component backgrounds to the Deep Abyss theme.
function GlassCard({ children }) {
  return (
    <View style={styles.glassCard}>
      {children}
    </View>
  );
}

function QuickBtn({ icon, label, onPress, accentColor }) {
  return (
    <TouchableOpacity
      style={[styles.quickBtn, accentColor && { borderColor: accentColor + '28' }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Ionicons name={icon} size={15} color={accentColor || Colors.textSecondary} />
      <Text style={[styles.quickBtnText, accentColor && { color: accentColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgAbyss },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 52 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  gearBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },

  heroWrapper: { position: 'relative' },
  streakWrap:  { marginTop: 10 },

  quickActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.glassBg,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  quickBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },

  section: { marginTop: 26 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.textPrimary, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
  seeAllText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },

  // Glassmorphism wrapper — makes PersonalRecordsList and ActivityHeatmap
  // blend with the Deep Abyss theme without modifying those components.
  glassCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 18,
    overflow: 'hidden',
  },

  actions:     { marginTop: 32, marginBottom: 12 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 16,
  },
  editBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 12,
  },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: 13, opacity: 0.85 },
});
