import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Switch, Alert, TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import { useSavedWorkouts } from '../../context/SavedWorkoutsContext';
import { useQuests } from '../../context/QuestContext';
import { useCustomExercises } from '../../context/CustomExercisesContext';
import { deleteAccount } from '../../services/auth.service';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import {
  xpToLevel, xpForLevel, computeStreak,
  debugAddXP, debugSetLevel, debugAddSessions,
  debugSimulateReps, debugSetStreak, debugClearDebugLogs,
  debugResetDailyXP,
} from '../../services/stats.service';
import { PROFILE_THEMES, isThemeLocked } from '../../data/profileThemes';
import { TROPHY_CATALOG, TROPHY_CATEGORIES, ULTIMATE_TROPHY, evaluateTrophies } from '../../data/trophyCatalog';
import { useDevSettings } from '../../hooks/useDevSettings';
import { useFocusEffect } from '@react-navigation/native';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';
import { TUTORIAL_CHAPTERS } from '../../data/tutorialChapters';
import {
  requestNotificationPermissions,
  fireTestNotification,
  scheduleDailyReminder,
  cancelDailyReminder,
} from '../../services/notificationService';

const UNIT_WEIGHT_KEY   = 'athly:unit:weight:v1';
const UNIT_DIST_KEY     = 'athly:unit:distance:v1';
const NOTIF_ENABLED_KEY = 'athly:notif:enabled:v1';

const GRP_BG   = 'rgba(255,255,255,0.05)';
const GRP_BDR  = 'rgba(255,255,255,0.09)';
const SEP      = 'rgba(255,255,255,0.07)';
const GOLD_BG  = 'rgba(255,215,0,0.06)';
const GOLD_BDR = 'rgba(255,215,0,0.22)';

// ─── Tap trigger to reveal dev section : 10 taps ─────────────────────────────
const DEV_TAP_TARGET = 10;

export default function SettingsScreen({ navigation }) {
  const { signOut }                       = useAuth();
  const { setUser }                       = useUser();
  const { showToast }                     = useToast();
  const { totalXP, sessionLogs, activityLogs, refresh, clearAll: clearWorkoutLogs } = useWorkoutLogs();
  const { clearAll: clearSavedWorkouts }  = useSavedWorkouts();
  const { clearAll: clearQuests }         = useQuests();
  const { clearAll: clearCustomExercises} = useCustomExercises();

  // ─── Tutorial ──────────────────────────────────────────────────────────────
  const {
    pendingChapterId, activeChapterId, activeStep, stepIndex,
    startChapter, resetTutorial, hasCompleted,
    justCompleted, clearJustCompleted,
    registerScrollRef, registerRemeasure,
  } = useTutorial();

  const [welcomeModal, setWelcomeModal] = useState(false);

  React.useEffect(() => {
    if (justCompleted) {
      setWelcomeModal(true);
      clearJustCompleted();
    }
  }, [justCompleted, clearJustCompleted]);
  const { ref: themesRef, onLayout: onThemesLayout, remeasure: rThemes } = useTutorialTarget('settings_themes');

  const scrollRef = useRef(null);

  // Enregistre le ScrollView pour que scrollY: 200 de l'étape settings_themes
  // fasse défiler jusqu'à la grille de thèmes avant la mesure.
  useEffect(() => {
    registerScrollRef('settings', scrollRef);
    registerRemeasure('settings', () => setTimeout(() => rThemes(), 50));
  }, [registerScrollRef, registerRemeasure, rThemes]);

  // Auto-scroll quand l'étape settings change
  useEffect(() => {
    if (activeChapterId !== 'settings' || !activeStep || activeStep.scrollY == null) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: activeStep.scrollY, animated: true });
      setTimeout(() => rThemes(), 350);
    }
  }, [activeChapterId, stepIndex]);

  useFocusEffect(
    useCallback(() => {
      if (pendingChapterId === 'settings') {
        const t = setTimeout(() => startChapter('settings'), 400);
        return () => clearTimeout(t);
      }
    }, [pendingChapterId, startChapter]),
  );


  const handleReplayFull = useCallback(async () => {
    await resetTutorial();
    navigation.navigate('Accueil');
    setTimeout(() => startChapter('dashboard'), 500);
  }, [resetTutorial, navigation, startChapter]);

  const handleReplayChapter = useCallback((chapter) => {
    // Pour le chapitre Profil : on est dans la ProfileStack (SettingsScreen),
    // navigate vers ProfileMain dans la même Stack pour dépiler Settings.
    if (chapter.id === 'profile') {
      navigation.navigate('ProfileMain');
      setTimeout(() => startChapter('profile'), 700);
      return;
    }
    if (chapter.stackScreen) {
      navigation.navigate(chapter.tabName, { screen: chapter.stackScreen });
    } else {
      navigation.navigate(chapter.tabName);
    }
    setTimeout(() => startChapter(chapter.id), 600);
  }, [navigation, startChapter]);
  const {
    profileThemeId, setProfileThemeId,
    godMode, setGodMode,
    trophyOverrides, setTrophyOverride, clearTrophyOverrides,
    bypassAnticheat, setBypassAnticheat,
    forceShowRituals, setForceShowRituals,
  } = useDevSettings();

  const { level } = useMemo(() => xpToLevel(totalXP), [totalXP]);
  const streak    = useMemo(() => computeStreak(activityLogs), [activityLogs]);

  const [weightUnit,   setWeightUnit]   = useState('kg');
  const [distUnit,     setDistUnit]     = useState('km');
  const [notifEnabled, setNotifEnabled] = useState(false);

  const [devVisible, setDevVisible] = useState(false);
  const [tapCount,   setTapCount]   = useState(0);

  // Console state
  const [targetLevel,     setTargetLevel]     = useState('');
  const [targetStreak,    setTargetStreak]    = useState('');
  const [targetXP,        setTargetXP]        = useState('');
  const [simLoading,      setSimLoading]      = useState(false);
  const [simFeedback,     setSimFeedback]     = useState('');
  const [trophyExpanded,  setTrophyExpanded]  = useState(false);

  const [deleteModal1,  setDeleteModal1]  = useState(false);
  const [deleteModal2,  setDeleteModal2]  = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const [wu, du, dv, ne] = await Promise.all([
          AsyncStorage.getItem(UNIT_WEIGHT_KEY),
          AsyncStorage.getItem(UNIT_DIST_KEY),
          AsyncStorage.getItem('athly:dev:devVisible:v1'),
          AsyncStorage.getItem(NOTIF_ENABLED_KEY),
        ]);
        if (wu) setWeightUnit(wu);
        if (du) setDistUnit(du);
        if (dv === 'true') setDevVisible(true);
        if (ne === 'true') setNotifEnabled(true);
      } catch (_) {}
    })();
  }, []);

  const saveWeightUnit = async (val) => {
    setWeightUnit(val);
    try { await AsyncStorage.setItem(UNIT_WEIGHT_KEY, val); } catch (_) {}
  };

  const saveDistUnit = async (val) => {
    setDistUnit(val);
    try { await AsyncStorage.setItem(UNIT_DIST_KEY, val); } catch (_) {}
  };

  const handleVersionTap = useCallback(async () => {
    if (devVisible) return;
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= DEV_TAP_TARGET) {
      setDevVisible(true);
      setTapCount(0);
      try { await AsyncStorage.setItem('athly:dev:devVisible:v1', 'true'); } catch (_) {}
    }
  }, [tapCount, devVisible]);

  const handleNotifToggle = useCallback(async (val) => {
    if (val) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Notifications désactivées', 'Activez les notifications Athly dans les réglages de votre appareil.');
        return;
      }
      try {
        await scheduleDailyReminder();
      } catch (e) {
        Alert.alert('Erreur', 'Impossible de planifier la notification.');
        return;
      }
      setNotifEnabled(true);
      try { await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'true'); } catch (_) {}
    } else {
      await cancelDailyReminder();
      setNotifEnabled(false);
      try { await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'false'); } catch (_) {}
    }
  }, []);

  // ─── God Mode console handlers ────────────────────────────────────────────

  const showFeedback = useCallback((msg) => {
    setSimFeedback(msg);
    setTimeout(() => setSimFeedback(''), 2500);
  }, []);

  const runNotifTest = useCallback(async (type) => {
    try {
      setSimLoading(true);
      await fireTestNotification(type);
      showFeedback(type === 'orange' ? 'Notif orange dans 3 s... 🔥' : 'Notif violette dans 3 s... 👀');
    } catch (e) {
      showFeedback('Erreur : ' + (e?.message || 'inconnue'));
    } finally {
      setSimLoading(false);
    }
  }, [showFeedback]);

  const handleGodMode = useCallback(async (val) => {
    await setGodMode(val);
    if (val) Alert.alert('God Mode activé 🔥', 'Utilisez la console ci-dessous pour simuler votre progression.');
  }, [setGodMode]);

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Tu vas être déconnecté.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: signOut },
    ]);
  };

  const runSim = useCallback(async (fn, successMsg) => {
    try {
      setSimLoading(true);
      await fn();
      await refresh();
      showFeedback(successMsg);
    } catch (e) {
      showFeedback('Erreur : ' + (e?.message || 'inconnue'));
    } finally {
      setSimLoading(false);
    }
  }, [refresh, showFeedback]);

  const handleSetLevel    = () => {
    const n = parseInt(targetLevel, 10);
    if (!targetLevel || isNaN(n) || n < 0 || n > 200) { showFeedback('Niveau invalide (0–200)'); return; }
    runSim(() => debugSetLevel(n), `Niveau ${n} appliqué ✓`);
  };
  const handleAddXP       = () => runSim(() => debugAddXP(1000), '+1000 XP injectés ✓');
  const handleAddCustomXP = () => {
    const n = parseInt(targetXP, 10);
    if (!targetXP || isNaN(n) || n <= 0) { showFeedback('Montant invalide (> 0)'); return; }
    runSim(() => debugAddXP(n), `+${n.toLocaleString('fr-FR')} XP injectés ✓`);
    setTargetXP('');
  };
  const handlePlusLevel   = () => runSim(() => debugSetLevel(level + 1), `Passage au niveau ${level + 1} ✓`);
  const handleMinusLevel  = () => {
    if (level <= 0) { showFeedback('Déjà au niveau 0'); return; }
    runSim(() => debugSetLevel(level - 1), `Retour au niveau ${level - 1} ✓`);
  };
  const handleGenSessions = () => runSim(() => debugAddSessions(50), '50 séances injectées ✓');
  const handleSimReps     = () => runSim(() => debugSimulateReps(3000), '~3000 répétitions simulées ✓');
  const handleSetStreak   = () => {
    const n = parseInt(targetStreak, 10);
    if (!targetStreak || isNaN(n) || n < 1 || n > 365) { showFeedback('Streak invalide (1–365)'); return; }
    runSim(() => debugSetStreak(n), `Streak ${n} jours appliqué ✓`);
  };
  const handleResetDailyXP = () => runSim(debugResetDailyXP, 'Quota XP quotidien réinitialisé ✓');
  const handleClearDebug  = () => {
    Alert.alert('Effacer les logs DEBUG', 'Les vraies séances restent intactes.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: () => runSim(debugClearDebugLogs, 'Logs DEBUG effacés ✓') },
    ]);
  };
  const handleClearOverrides = () => {
    clearTrophyOverrides();
    showFeedback('Overrides trophées réinitialisés ✓');
  };

  const handleLockDevSection = useCallback(async () => {
    setDevVisible(false);
    setTapCount(0);
    await setGodMode(false);
    try { await AsyncStorage.removeItem('athly:dev:devVisible:v1'); } catch (_) {}
  }, [setGodMode]);

  const doDeleteAccount = useCallback(async () => {
    try {
      setDeleteLoading(true);

      // 1. Suppression côté serveur (cascade DB)
      await deleteAccount();

      // 2. Purge totale AsyncStorage (logs, séances, quêtes, token, prefs…)
      await AsyncStorage.clear();

      // 3. Reset de tous les états en mémoire des contextes
      clearWorkoutLogs();
      clearSavedWorkouts();
      clearQuests();
      clearCustomExercises();
      setUser(null);

      // 4. Notification + déconnexion → redirection automatique vers Login
      showToast('Votre compte a été entièrement supprimé conformément au RGPD.', 'success', 5000);
      await signOut();
    } catch {
      setDeleteModal2(false);
      setDeleteLoading(false);
    }
  }, [signOut, setUser, showToast, clearWorkoutLogs, clearSavedWorkouts, clearQuests, clearCustomExercises]);

  // ─── Trophies evaluation ──────────────────────────────────────────────────

  const evaluatedTrophies = useMemo(
    () => evaluateTrophies(level, sessionLogs.length, sessionLogs, totalXP, trophyOverrides),
    [level, sessionLogs, totalXP, trophyOverrides],
  );
  const ultimateUnlocked = evaluatedTrophies.every((t) => t.unlocked);

  const unlockedThemes = PROFILE_THEMES.filter((t) => !isThemeLocked(t, level));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ═══ COMPTE ═══════════════════════════════════════════════════════════ */}
        <SectionLabel label="Compte" />
        <SettingsGroup>
          <SettingsRow label="Modifier le profil" last chevron onPress={() => navigation.navigate('EditProfile')}>
            <Ionicons name="create-outline" size={16} color={Colors.textMuted} />
          </SettingsRow>
        </SettingsGroup>

        {/* ═══ UNITÉS ═══════════════════════════════════════════════════════════ */}
        <SectionLabel label="Unités" />
        <SettingsGroup>
          <SettingsRow label="Poids" last={false}>
            <View style={styles.segRow}>
              <SegBtn label="kg"  active={weightUnit === 'kg'}  onPress={() => saveWeightUnit('kg')} />
              <SegBtn label="lbs" active={weightUnit === 'lbs'} onPress={() => saveWeightUnit('lbs')} />
            </View>
          </SettingsRow>
          <SettingsRow label="Distance" last>
            <View style={styles.segRow}>
              <SegBtn label="km"    active={distUnit === 'km'}    onPress={() => saveDistUnit('km')} />
              <SegBtn label="miles" active={distUnit === 'miles'} onPress={() => saveDistUnit('miles')} />
            </View>
          </SettingsRow>
        </SettingsGroup>

        {/* ═══ APPARENCE ════════════════════════════════════════════════════════ */}
        <SectionLabel label="Apparence" />
        <SettingsGroup>
          <View style={[styles.row, styles.rowSep]}>
            <View style={styles.rowLabelWrap}>
              <Text style={styles.rowLabel}>Thème du Profil</Text>
              <Text style={styles.rowSub}>
                {unlockedThemes.length}/{PROFILE_THEMES.length} débloqués
                {level < 11 && '  ·  Niv. 11+ pour les suivants'}
              </Text>
            </View>
          </View>
          <View style={styles.themeGrid} ref={themesRef} onLayout={onThemesLayout} collapsable={false}>
            {PROFILE_THEMES.map((theme) => {
              const locked   = isThemeLocked(theme, level);
              const selected = profileThemeId === theme.id;
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[styles.themeItem, selected && styles.themeItemSel, locked && styles.themeItemLocked]}
                  onPress={() => !locked && setProfileThemeId(theme.id)}
                  activeOpacity={locked ? 1 : 0.75}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: theme.accentColor || Colors.primary }, theme.accentColor === null && { backgroundColor: '#444', borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.textMuted }]} />
                  {selected && <View style={styles.themeCheck}><Ionicons name="checkmark" size={8} color="#fff" /></View>}
                  {locked   && <View style={styles.themeLockOverlay}><Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.4)" /></View>}
                  <Text style={[styles.themeLabel, locked && styles.themeLabelLocked]} numberOfLines={1}>{theme.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsGroup>

        {/* ═══ NOTIFICATIONS ════════════════════════════════════════════════════ */}
        <SectionLabel label="Notifications" />
        <SettingsGroup>
          <SettingsRow label="Rappels d'entraînement" last>
            <Switch value={notifEnabled} onValueChange={handleNotifToggle}
              trackColor={{ false: 'rgba(255,255,255,0.12)', true: Colors.primary }} thumbColor="#fff" />
          </SettingsRow>
        </SettingsGroup>

        {/* ═══ SUPPORT ══════════════════════════════════════════════════════════ */}
        <SectionLabel label="Support" />
        <SettingsGroup>
          <TouchableOpacity onPress={handleVersionTap} activeOpacity={0.7}>
            <View style={styles.row}>
              <View style={styles.rowLabelWrap}>
                <Text style={styles.rowLabel}>Version</Text>
              </View>
              <Text style={styles.valueText}>1.0.0</Text>
            </View>
          </TouchableOpacity>
        </SettingsGroup>

        {/* ═══ MODE DÉVELOPPEUR ════════════════════════════════════════════════ */}
        {devVisible && (
          <>
            <SectionLabel label="Mode Développeur" />
            <SettingsGroup>
              <SettingsRow label="God Mode" last={false}>
                <Switch value={godMode} onValueChange={handleGodMode}
                  trackColor={{ false: 'rgba(255,255,255,0.12)', true: Colors.gold }}
                  thumbColor={godMode ? Colors.gold : '#fff'} />
              </SettingsRow>
              <SettingsRow label="Bypass anti-triche (5 min)" last={false}>
                <Switch value={bypassAnticheat} onValueChange={setBypassAnticheat}
                  trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(245,158,11,0.8)' }}
                  thumbColor={bypassAnticheat ? Colors.warningAmber : '#fff'} />
              </SettingsRow>
              <SettingsRow label="Forcer l'affichage des rituels" last>
                <Switch value={forceShowRituals} onValueChange={setForceShowRituals}
                  trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(110,106,240,0.8)' }}
                  thumbColor={forceShowRituals ? Colors.secondaryAccent : '#fff'} />
              </SettingsRow>
            </SettingsGroup>

            {godMode && (
              <View style={styles.devConsole}>
                <View style={styles.devHeader}>
                  <Ionicons name="terminal-outline" size={14} color={Colors.gold} />
                  <Text style={styles.devHeaderText}>Console de Simulation</Text>
                  <View style={styles.devLiveBadge}>
                    <View style={styles.devLiveDot} />
                    <Text style={styles.devLiveText}>LIVE</Text>
                  </View>
                </View>

                {/* Live stats */}
                <View style={styles.devStats}>
                  <DevStat label="Niveau" value={level} />
                  <DevStat label="XP total" value={totalXP.toLocaleString('fr-FR')} />
                  <DevStat label="Streak" value={`${streak}j`} />
                  <DevStat label="Séances" value={sessionLogs.length} />
                </View>

                {/* ── NIVEAU & XP ── */}
                <DevSectionTitle title="NIVEAU & XP" />
                <View style={styles.devInputRow}>
                  <TextInput style={styles.devInput} value={targetLevel} onChangeText={setTargetLevel}
                    keyboardType="number-pad" placeholder={`${level}`}
                    placeholderTextColor="rgba(255,215,0,0.3)" returnKeyType="done" />
                  <DevBtn label="Set niveau" onPress={handleSetLevel} disabled={simLoading} />
                </View>
                <View style={styles.devBtnRow}>
                  <DevBtn label="+1000 XP" onPress={handleAddXP} disabled={simLoading} flex />
                  <DevBtn label="+1 Niv"   onPress={handlePlusLevel}  disabled={simLoading || level >= 200} flex />
                  <DevBtn label="-1 Niv"   onPress={handleMinusLevel} disabled={simLoading || level <= 0} flex variant="dim" />
                </View>
                <View style={styles.devInputRow}>
                  <TextInput style={styles.devInput} value={targetXP} onChangeText={setTargetXP}
                    keyboardType="number-pad" placeholder="XP à ajouter"
                    placeholderTextColor="rgba(255,215,0,0.3)" returnKeyType="done" />
                  <DevBtn label="+ XP" onPress={handleAddCustomXP} disabled={simLoading} />
                </View>
                <Text style={styles.devHint}>XP requis Niv.{level + 1} : {xpForLevel(level + 1).toLocaleString('fr-FR')}</Text>

                {/* ── SIMULATION ── */}
                <DevSectionTitle title="SIMULATION" />
                <View style={styles.devBtnRow}>
                  <DevBtn label="50 séances" onPress={handleGenSessions} disabled={simLoading} flex />
                  <DevBtn label="3000 reps"  onPress={handleSimReps}     disabled={simLoading} flex />
                </View>
                <Text style={styles.devHint}>Injecte des logs réalistes sur les N derniers jours.</Text>

                {/* ── STREAK ── */}
                <DevSectionTitle title="STREAK" />
                <View style={styles.devInputRow}>
                  <TextInput style={styles.devInput} value={targetStreak} onChangeText={setTargetStreak}
                    keyboardType="number-pad" placeholder={`${streak}`}
                    placeholderTextColor="rgba(255,215,0,0.3)" returnKeyType="done" />
                  <DevBtn label="Set streak" onPress={handleSetStreak} disabled={simLoading} />
                </View>

                {/* ── TROPHÉES ── */}
                <DevSectionTitle title="TROPHÉES" />

                {/* Statut Trophée Ultime */}
                <View style={styles.trophyUltimateRow}>
                  <Ionicons name="infinite" size={14} color={ultimateUnlocked ? Colors.gold : Colors.textMuted} />
                  <Text style={[styles.trophyUltimateLabel, { color: ultimateUnlocked ? Colors.gold : Colors.textMuted }]}>
                    {ULTIMATE_TROPHY.label}
                  </Text>
                  <Text style={[styles.trophyUltimateSub, { color: ultimateUnlocked ? Colors.success : Colors.textMuted }]}>
                    {ultimateUnlocked ? '✓ Débloqué !' : `${evaluatedTrophies.filter(t => t.unlocked).length}/${TROPHY_CATALOG.length}`}
                  </Text>
                </View>

                {/* Actions de masse */}
                <View style={styles.devBtnRow}>
                  <DevBtn
                    label="Tout débloquer"
                    onPress={() => {
                      TROPHY_CATALOG.forEach(t => setTrophyOverride(t.id, true));
                      showFeedback('Tous les trophées débloqués ✓');
                    }}
                    disabled={simLoading}
                    flex
                  />
                  <DevBtn
                    label="Tout réinitialiser"
                    onPress={() => { clearTrophyOverrides(); showFeedback('Overrides réinitialisés ✓'); }}
                    disabled={simLoading}
                    flex
                    variant="dim"
                  />
                </View>

                {/* Accordéon — liste individuelle */}
                <TouchableOpacity
                  style={styles.trophyAccordionHeader}
                  onPress={() => setTrophyExpanded(v => !v)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.trophyAccordionLabel}>
                    Gestion individuelle des trophées
                  </Text>
                  <Ionicons
                    name={trophyExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="rgba(255,215,0,0.5)"
                  />
                </TouchableOpacity>

                {trophyExpanded && TROPHY_CATEGORIES.map((cat) => {
                  const catTrophies = evaluatedTrophies.filter((t) => t.category === cat.id);
                  if (catTrophies.length === 0) return null;
                  return (
                    <View key={cat.id}>
                      <Text style={[styles.trophyCatLabel, { color: cat.color }]}>{cat.label}</Text>
                      {catTrophies.map((t) => (
                        <View key={t.id} style={styles.trophyRow}>
                          <View style={[styles.trophyIconDot, { backgroundColor: t.color + '30', borderColor: t.color + '60' }]}>
                            <Ionicons name={t.icon} size={10} color={t.unlocked ? t.color : Colors.textMuted} />
                          </View>
                          <View style={styles.trophyTextCol}>
                            <Text style={[styles.trophyName, { color: t.unlocked ? Colors.textPrimary : Colors.textMuted }]} numberOfLines={1}>
                              {t.label}
                            </Text>
                            <Text style={styles.trophyCond} numberOfLines={1}>{t.condition}</Text>
                          </View>
                          <View style={styles.trophySwitchWrap}>
                            {!t.naturalUnlocked && trophyOverrides[t.id] === true && (
                              <Text style={styles.trophyOverrideTag}>DEV</Text>
                            )}
                            <Switch
                              value={t.unlocked}
                              onValueChange={(val) => setTrophyOverride(t.id, val === t.naturalUnlocked ? null : val)}
                              trackColor={{ false: 'rgba(255,255,255,0.10)', true: t.color + 'AA' }}
                              thumbColor={t.unlocked ? t.color : '#888'}
                              style={styles.trophySwitch}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}

                {/* ── NOTIFICATIONS ── */}
                <DevSectionTitle title="NOTIFICATIONS" />
                <Text style={styles.devHint}>Déclenche une notification de test dans 3 secondes. Passe l'app en arrière-plan.</Text>
                <View style={styles.devBtnRow}>
                  <DevBtn label="🔥 Notif Orange" onPress={() => runNotifTest('orange')} disabled={simLoading} flex variant="orange" />
                  <DevBtn label="👀 Notif Violette" onPress={() => runNotifTest('violet')} disabled={simLoading} flex variant="violet" />
                </View>

                {/* ── RESET ── */}
                <DevSectionTitle title="RESET" />
                <DevBtn label="Reset quota XP quotidien" onPress={handleResetDailyXP} disabled={simLoading} fullWidth />
                <Text style={styles.devHint}>Décale les séances d'aujourd'hui à hier — relance le gain d'XP.</Text>
                <DevBtn label="Effacer les logs DEBUG" onPress={handleClearDebug} disabled={simLoading} variant="destructive" fullWidth />
                <Text style={styles.devHint}>Supprime uniquement les logs [DEBUG] — les vraies séances sont conservées.</Text>

                {simLoading && (
                  <View style={styles.devLoader}>
                    <ActivityIndicator size="small" color={Colors.gold} />
                    <Text style={styles.devLoaderText}>Opération en cours…</Text>
                  </View>
                )}
                {!!simFeedback && !simLoading && (
                  <Text style={styles.devFeedback}>{simFeedback}</Text>
                )}

                {/* ── VERROUILLAGE ── */}
                <View style={styles.devLockDivider} />
                <TouchableOpacity
                  style={styles.devLockBtn}
                  onPress={handleLockDevSection}
                  activeOpacity={0.75}
                >
                  <Ionicons name="lock-closed-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.devLockText}>Quitter et reverrouiller le mode développeur</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ═══ CENTRE D'AIDE & TUTORIEL ════════════════════════════════════════ */}
        <SectionLabel label="Centre d'aide & Tutoriel" />

        {/* Rejouer l'intégralité */}
        <TouchableOpacity style={styles.tutReplayBtn} onPress={handleReplayFull} activeOpacity={0.82}>
          <View style={styles.tutReplayIcon}>
            <Ionicons name="play-circle" size={22} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tutReplayTitle}>Rejouer l'intégralité du tutoriel</Text>
            <Text style={styles.tutReplaySub}>5 chapitres · du Dashboard aux Réglages</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.chevron} />
        </TouchableOpacity>

        {/* Chapitres individuels */}
        <SettingsGroup>
          {TUTORIAL_CHAPTERS.map((chapter, idx) => (
            <TouchableOpacity
              key={chapter.id}
              onPress={() => handleReplayChapter(chapter)}
              activeOpacity={0.75}
            >
              <View style={[styles.row, idx < TUTORIAL_CHAPTERS.length - 1 && styles.rowSep]}>
                <View style={[styles.tutChapIcon, { backgroundColor: Colors.primary + '14' }]}>
                  <Ionicons name={chapter.icon} size={14} color={Colors.primary} />
                </View>
                <View style={styles.rowLabelWrap}>
                  <Text style={styles.rowLabel}>{chapter.title}</Text>
                  <Text style={styles.rowSub}>{chapter.subtitle} · {chapter.steps.length} étapes</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={Colors.chevron} />
              </View>
            </TouchableOpacity>
          ))}
        </SettingsGroup>

        {/* ─── Déconnexion ──────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={15} color={Colors.error} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        {/* ─── Suppression définitive du compte ────────────────────────────── */}
        <TouchableOpacity style={styles.deleteAccountBtn} onPress={() => setDeleteModal1(true)} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={15} color="#FF4D4D" style={{ marginRight: 8 }} />
          <Text style={styles.deleteAccountText}>Supprimer le compte</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>

      {activeChapterId === 'settings' && (
        <TutorialOverlay navigation={navigation} />
      )}

      {/* ─── Popup "Bienvenue à bord !" — fin du tutoriel ─────────────────── */}
      <Modal visible={welcomeModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setWelcomeModal(false)}>
        <View style={styles.dmBackdrop}>
          <View style={[styles.dmCard, styles.welcomeCard]}>
            <View style={styles.welcomeIconWrap}>
              <Ionicons name="rocket-outline" size={30} color="#6E6AF0" />
            </View>
            <Text style={styles.dmTitle}>Bienvenue à bord !</Text>
            <Text style={styles.dmBody}>
              Pour maximiser tes entraînements, commence par personnaliser ton profil.
            </Text>
            <TouchableOpacity
              style={styles.welcomeBtn}
              onPress={() => { setWelcomeModal(false); navigation.navigate('EditProfile'); }}
              activeOpacity={0.82}
            >
              <Ionicons name="create-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.welcomeBtnTxt}>Personnaliser mon profil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dmBackBtn}
              onPress={() => setWelcomeModal(false)}
              activeOpacity={0.75}
            >
              <Text style={styles.dmBackTxt}>Plus tard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Popup 1 : Avertissement de pertes ────────────────────────────── */}
      <Modal visible={deleteModal1} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDeleteModal1(false)}>
        <View style={styles.dmBackdrop}>
          <View style={styles.dmCard}>
            <View style={styles.dmIconWrap}>
              <Ionicons name="warning-outline" size={28} color="#EF4444" />
            </View>
            <Text style={styles.dmTitle}>Êtes-vous sûr ?</Text>
            <Text style={styles.dmBody}>
              Vous perdrez définitivement votre progression, vos stats, votre vitrine de trophées et votre rang d'athlète.{'\n\n'}Cette action est irréversible.
            </Text>
            <TouchableOpacity style={styles.dmKeepBtn} onPress={() => setDeleteModal1(false)} activeOpacity={0.82}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.dmKeepTxt}>Conserver mon compte</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dmContinueBtn}
              onPress={() => { setDeleteModal1(false); setDeleteModal2(true); }}
              activeOpacity={0.75}
            >
              <Text style={styles.dmContinueTxt}>Continuer la suppression</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Popup 2 : Confirmation finale ────────────────────────────────── */}
      <Modal visible={deleteModal2} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !deleteLoading && setDeleteModal2(false)}>
        <View style={styles.dmBackdrop}>
          <View style={[styles.dmCard, styles.dmCardFinal]}>
            <View style={styles.dmIconFinalWrap}>
              <Ionicons name="skull-outline" size={28} color="#EF4444" />
            </View>
            <Text style={styles.dmTitle}>Confirmation finale</Text>
            <Text style={styles.dmBody}>
              Cliquez sur le bouton ci-dessous pour détruire entièrement vos données de nos serveurs.
            </Text>
            <TouchableOpacity
              style={[styles.dmDestroyBtn, deleteLoading && { opacity: 0.7 }]}
              onPress={doDeleteAccount}
              disabled={deleteLoading}
              activeOpacity={0.82}
            >
              {deleteLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.dmDestroyTxt}>Détruire définitivement</Text>
                  </>
                )
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dmBackBtn}
              onPress={() => setDeleteModal2(false)}
              disabled={deleteLoading}
              activeOpacity={0.75}
            >
              <Text style={styles.dmBackTxt}>Retour</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }) {
  return <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>;
}

function SettingsGroup({ children }) {
  return <View style={styles.group}>{children}</View>;
}

function SettingsRow({ label, children, last, chevron, onPress }) {
  const Inner = (
    <View style={[styles.row, !last && styles.rowSep]}>
      <View style={styles.rowLabelWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {children}
        {chevron && <Ionicons name="chevron-forward" size={16} color={Colors.chevron} style={{ marginLeft: 6 }} />}
      </View>
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{Inner}</TouchableOpacity>;
  return Inner;
}

function SegBtn({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.seg, active && styles.segActive]} activeOpacity={0.8}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DevSectionTitle({ title }) {
  return (
    <View style={styles.devSectionRow}>
      <Text style={styles.devSectionTitle}>{title}</Text>
      <View style={styles.devSectionLine} />
    </View>
  );
}

function DevStat({ label, value }) {
  return (
    <View style={styles.devStatItem}>
      <Text style={styles.devStatValue}>{value}</Text>
      <Text style={styles.devStatLabel}>{label}</Text>
    </View>
  );
}

function DevBtn({ label, onPress, disabled, variant = 'default', flex, fullWidth }) {
  const isDestructive = variant === 'destructive';
  const isDim         = variant === 'dim';
  const isOrange      = variant === 'orange';
  const isViolet      = variant === 'violet';
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75}
      style={[styles.devBtn, flex && { flex: 1 }, fullWidth && { alignSelf: 'stretch' },
        isDestructive && styles.devBtnDestructive, isDim && styles.devBtnDim,
        isOrange && styles.devBtnOrange, isViolet && styles.devBtnViolet,
        disabled && styles.devBtnDisabled]}>
      <Text style={[styles.devBtnText,
        isDestructive && styles.devBtnTextDestructive, isDim && styles.devBtnTextDim,
        isOrange && styles.devBtnTextOrange, isViolet && styles.devBtnTextViolet,
        disabled && styles.devBtnTextDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#080910' },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 24, marginBottom: 8, marginLeft: 4 },

  group:   { backgroundColor: GRP_BG, borderRadius: 14, borderWidth: 1, borderColor: GRP_BDR, overflow: 'hidden' },
  row:     { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 16, paddingVertical: 10 },
  rowSep:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SEP },
  rowLabelWrap: { flex: 1, marginRight: 12 },
  rowLabel:     { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' },
  rowSub:       { color: Colors.textMuted, fontSize: 11, fontWeight: '400', marginTop: 2 },
  rowRight:     { flexDirection: 'row', alignItems: 'center' },
  valueText:    { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },

  segRow:        { flexDirection: 'row', gap: 6 },
  seg:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: GRP_BDR, backgroundColor: 'rgba(255,255,255,0.04)' },
  segActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segText:       { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  segTextActive: { color: '#fff' },

  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  themeItem: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', position: 'relative', width: 62 },
  themeItemSel:    { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.25)' },
  themeItemLocked: { opacity: 0.35 },
  themeSwatch:     { width: 32, height: 32, borderRadius: 16, marginBottom: 5 },
  themeCheck:      { position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#13131C' },
  themeLockOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  themeLabel:      { color: Colors.textMuted, fontSize: 8, fontWeight: '600', textAlign: 'center' },
  themeLabelLocked:{ color: Colors.textMuted },

  // ── God Mode console ───────────────────────────────────────────────────────
  devConsole: { marginTop: 10, backgroundColor: GOLD_BG, borderRadius: 16, borderWidth: 1, borderColor: GOLD_BDR, padding: 16, gap: 12 },

  devHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: GOLD_BDR },
  devHeaderText: { color: Colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, flex: 1 },
  devLiveBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  devLiveDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  devLiveText:   { color: Colors.success, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  devStats:     { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 12 },
  devStatItem:  { alignItems: 'center' },
  devStatValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  devStatLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },

  devSectionRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  devSectionTitle:{ color: 'rgba(255,215,0,0.6)', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  devSectionLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: GOLD_BDR },

  devInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  devInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: GOLD_BDR, backgroundColor: 'rgba(0,0,0,0.35)', color: Colors.gold, fontSize: 15, fontWeight: '700', paddingHorizontal: 12 },
  devBtnRow: { flexDirection: 'row', gap: 8 },

  devBtn:            { height: 38, borderRadius: 10, borderWidth: 1, borderColor: GOLD_BDR, backgroundColor: 'rgba(255,215,0,0.10)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  devBtnDestructive: { borderColor: 'rgba(255,77,77,0.35)', backgroundColor: 'rgba(255,77,77,0.08)' },
  devBtnDim:         { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' },
  devBtnOrange:      { borderColor: 'rgba(255,107,0,0.40)', backgroundColor: 'rgba(255,107,0,0.10)' },
  devBtnViolet:      { borderColor: 'rgba(139,92,246,0.40)', backgroundColor: 'rgba(139,92,246,0.10)' },
  devBtnDisabled:    { opacity: 0.35 },

  devBtnText:            { color: Colors.gold, fontSize: 12, fontWeight: '700' },
  devBtnTextDestructive: { color: Colors.error },
  devBtnTextDim:         { color: Colors.textMuted },
  devBtnTextOrange:      { color: '#FF6B00' },
  devBtnTextViolet:      { color: '#8B5CF6' },
  devBtnTextDisabled:    { color: Colors.textMuted },

  devHint: { color: 'rgba(255,215,0,0.40)', fontSize: 10, fontWeight: '500', lineHeight: 14, marginTop: -4 },

  devLoader:     { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 4 },
  devLoaderText: { color: Colors.gold, fontSize: 12, fontWeight: '600' },
  devFeedback:   { color: Colors.success, fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },

  // ── Trophy panel ────────────────────────────────────────────────────────────
  trophyUltimateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 10, padding: 10, marginBottom: 4 },
  trophyUltimateLabel: { flex: 1, fontSize: 12, fontWeight: '800' },
  trophyUltimateSub:   { fontSize: 11, fontWeight: '700' },

  trophyAccordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: GOLD_BDR, backgroundColor: 'rgba(0,0,0,0.20)', marginTop: 4 },
  trophyAccordionLabel:  { color: 'rgba(255,215,0,0.55)', fontSize: 11, fontWeight: '700', flex: 1 },

  trophyCatLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 8, marginBottom: 4, opacity: 0.7 },

  trophyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.05)' },
  trophyIconDot: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  trophyTextCol: { flex: 1 },
  trophyName:    { fontSize: 11, fontWeight: '700' },
  trophyCond:    { fontSize: 9, color: Colors.textMuted, fontWeight: '500', marginTop: 1 },
  trophySwitchWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trophyOverrideTag: { fontSize: 8, fontWeight: '900', color: Colors.gold, backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  trophySwitch: { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] },

  devLockDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8 },
  devLockBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', marginTop: 8 },
  devLockText:    { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },

  // ── Tutorial help center ───────────────────────────────────────────────────
  tutReplayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(254,116,57,0.08)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(254,116,57,0.22)',
    padding: 14, marginBottom: 10,
  },
  tutReplayIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(254,116,57,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  tutReplayTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  tutReplaySub:   { color: Colors.textMuted, fontSize: 11, fontWeight: '500', marginTop: 2 },
  tutChapIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginRight: 2,
  },

  // ── Logout ──────────────────────────────────────────────────────────────────
  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,77,77,0.20)', backgroundColor: 'rgba(255,77,77,0.06)' },
  logoutText: { color: Colors.error, fontSize: 14, fontWeight: '700' },

  // ── Welcome modal (fin tutoriel) ─────────────────────────────────────────────
  welcomeCard:    { borderColor: 'rgba(110,106,240,0.30)' },
  welcomeIconWrap:{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(110,106,240,0.12)', borderWidth: 1, borderColor: 'rgba(110,106,240,0.30)', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  welcomeBtn:     { flexDirection: 'row', alignItems: 'center', width: '100%', height: 50, borderRadius: 13, backgroundColor: '#6E6AF0', justifyContent: 'center', marginBottom: 10, shadowColor: '#6E6AF0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 12, elevation: 6 },
  welcomeBtnTxt:  { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  // ── Delete Account button ────────────────────────────────────────────────────
  deleteAccountBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', backgroundColor: 'transparent' },
  deleteAccountText: { color: '#FF4D4D', fontSize: 13, fontWeight: '600', opacity: 0.75 },

  // ── Delete Account Modals ────────────────────────────────────────────────────
  dmBackdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  dmCard:         { width: '100%', backgroundColor: '#13131C', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)', padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.65, shadowRadius: 32, elevation: 20 },
  dmCardFinal:    { borderColor: 'rgba(220,38,38,0.35)' },
  dmIconWrap:     { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  dmIconFinalWrap:{ width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(220,38,38,0.14)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.35)', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  dmTitle:        { color: Colors.textPrimary, fontSize: 19, fontWeight: '800', letterSpacing: -0.3, marginBottom: 12, textAlign: 'center' },
  dmBody:         { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 26 },
  dmKeepBtn:      { flexDirection: 'row', alignItems: 'center', width: '100%', height: 50, borderRadius: 13, backgroundColor: Colors.primary, justifyContent: 'center', marginBottom: 10, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  dmKeepTxt:      { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  dmContinueBtn:  { width: '100%', height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  dmContinueTxt:  { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  dmDestroyBtn:   { flexDirection: 'row', alignItems: 'center', width: '100%', height: 50, borderRadius: 13, backgroundColor: '#DC2626', justifyContent: 'center', marginBottom: 10, shadowColor: '#DC2626', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 6 },
  dmDestroyTxt:   { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  dmBackBtn:      { width: '100%', height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  dmBackTxt:      { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
});
