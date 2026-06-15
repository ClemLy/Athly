import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Pressable, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/theme';
import { xpToLevel } from '../../services/stats.service';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { useDevSettings } from '../../hooks/useDevSettings';
import {
  TROPHY_CATALOG,
  ULTIMATE_TROPHY,
  TROPHY_CATEGORIES,
  TROPHY_FILTER_TABS,
  evaluateTrophies,
} from '../../data/trophyCatalog';
import { useFeaturedTrophies, MAX_FEATURED } from '../../hooks/useFeaturedTrophies';
import { useFocusEffect } from '@react-navigation/native';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';

// ─── Glow config per tier ─────────────────────────────────────────────────────

const TIER_GLOW = {
  bronze:   { opacity: 0.55, radius: 12, elevation: 8  },
  silver:   { opacity: 0.78, radius: 20, elevation: 16 },
  gold:     { opacity: 0.92, radius: 30, elevation: 24 },
  platinum: { opacity: 1.0,  radius: 40, elevation: 32 },
  diamond:  { opacity: 1.0,  radius: 52, elevation: 40 },
};

// ─── UltimateTile ─────────────────────────────────────────────────────────────

function UltimateTile({ unlocked, onPress }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const gleamX  = useRef(new Animated.Value(-140)).current;
  const glow    = useRef(new Animated.Value(0)).current;
  const prevUnlocked = useRef(false);

  useEffect(() => {
    if (unlocked && !prevUnlocked.current) {
      // Bounce d'entrée
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.04, useNativeDriver: true, tension: 180, friction: 6 }),
        Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 180, friction: 6 }),
      ]).start();
    }
    prevUnlocked.current = unlocked;
  }, [unlocked, scale]);

  useEffect(() => {
    if (!unlocked) return;
    // Glow pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    );
    // Gleam sweep
    const gleamLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(gleamX, { toValue: -140, duration: 1, useNativeDriver: true }),
        Animated.delay(2400),
        Animated.timing(gleamX, { toValue: 300, duration: 700, useNativeDriver: true }),
        Animated.delay(400),
      ])
    );
    pulseLoop.start();
    gleamLoop.start();
    return () => { pulseLoop.stop(); gleamLoop.stop(); };
  }, [unlocked, glow, gleamX]);

  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.95] });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.ultimateWrapper}>
      <Animated.View style={[
        styles.ultimateTile,
        unlocked && {
          borderColor: 'rgba(255,215,0,0.6)',
          borderTopColor: '#FFD700',
        },
        { transform: [{ scale }] },
      ]}>
        {unlocked ? (
          <LinearGradient
            colors={['rgba(255,215,0,0.06)', 'rgba(255,140,0,0.04)', 'rgba(196,74,16,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            borderRadius={20}
          />
        ) : null}

        <View style={styles.ultimateInner}>
          {/* Icon */}
          <Animated.View style={[
            styles.ultimateIconWrap,
            unlocked && { shadowColor: '#FFD700', shadowOpacity, shadowOffset: { width: 0, height: 0 }, shadowRadius: 32, elevation: 32 },
          ]}>
            {unlocked ? (
              <LinearGradient
                colors={ULTIMATE_TROPHY.gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ultimateIconGrad}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[styles.ultimateGleam, { transform: [{ translateX: gleamX }, { rotate: '18deg' }] }]}
                />
                <Ionicons name={ULTIMATE_TROPHY.icon} size={44} color="#fff" />
              </LinearGradient>
            ) : (
              <View style={styles.ultimateIconLocked}>
                <Ionicons name="lock-closed" size={32} color="rgba(255,255,255,0.12)" />
              </View>
            )}
          </Animated.View>

          {/* Text */}
          <View style={styles.ultimateTextCol}>
            <Text style={[styles.ultimateLabel, { color: unlocked ? '#FFD700' : Colors.textMuted }]}>
              {ULTIMATE_TROPHY.label}
            </Text>
            <Text style={[styles.ultimateCond, { color: unlocked ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.15)' }]}>
              {unlocked ? 'Collection complète — Vous régnez.' : ULTIMATE_TROPHY.condition}
            </Text>
            {unlocked && (
              <View style={styles.ultimateBadge}>
                <Ionicons name="infinite" size={10} color="#FFD700" />
                <Text style={styles.ultimateBadgeText}>DIAMOND · ULTIME</Text>
              </View>
            )}
          </View>
        </View>

        {!unlocked && (
          <Text style={styles.ultimateHint}>
            {TROPHY_CATALOG.length - 0} trophées requis · Progressez pour débloquer
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── TrophyRoomScreen ─────────────────────────────────────────────────────────

export default function TrophyRoomScreen({ navigation }) {
  const { sessionLogs: logs, totalXP } = useWorkoutLogs();
  const { trophyOverrides } = useDevSettings();
  const { toggleFeatured, isFeatured } = useFeaturedTrophies();
  const [selected, setSelected]   = useState(null);
  const [activeFilter, setFilter] = useState('all');

  const { level } = useMemo(() => xpToLevel(totalXP), [totalXP]);
  const totalSessions = logs.length;

  const evaluated = useMemo(
    () => evaluateTrophies(level, totalSessions, logs, totalXP, trophyOverrides),
    [level, totalSessions, logs, totalXP, trophyOverrides],
  );

  const unlockedCount   = evaluated.filter((t) => t.unlocked).length;
  const ultimateUnlocked = evaluated.every((t) => t.unlocked);
  const ultimateTrophy   = useMemo(() => ({ ...ULTIMATE_TROPHY, unlocked: ultimateUnlocked }), [ultimateUnlocked]);

  const visibleCategories = useMemo(() => {
    if (activeFilter === 'all') return TROPHY_CATEGORIES;
    const tab = TROPHY_FILTER_TABS.find(t => t.id === activeFilter);
    if (!tab || !tab.categories) return TROPHY_CATEGORIES;
    return TROPHY_CATEGORIES.filter(c => tab.categories.includes(c.id));
  }, [activeFilter]);

  // ─── Tutorial ───────────────────────────────────────────────────────────
  const {
    pendingChapterId, activeChapterId, activeStep, stepIndex,
    startChapter, registerScrollRef, registerRemeasure,
  } = useTutorial();
  const { ref: filtersRef,     onLayout: onFiltersLayout,     remeasure: rFilters  } = useTutorialTarget('trophies_filters');
  const { ref: ultimateRef,    onLayout: onUltimateLayout,    remeasure: rUltimate } = useTutorialTarget('trophies_ultimate');
  const { ref: firstTrophyRef, onLayout: onFirstTrophyLayout }                      = useTutorialTarget('trophies_first_trophy');

  // ID du premier trophée visible dans la grille (hors Ultime) — sert à attacher la ref de ciblage.
  const firstTrophyId = useMemo(() => {
    if (visibleCategories.length === 0) return null;
    const firstCat     = visibleCategories[0];
    const catTrophies  = evaluated.filter((t) => t.category === firstCat.id);
    return catTrophies.length > 0 ? catTrophies[0].id : null;
  }, [visibleCategories, evaluated]);

  const scrollRef = useRef(null);

  // Enregistre le scroll et la re-mesure pour le chapitre trophies.
  // Chaque step avec scrollY: 0 déclenche un scroll-to-top + re-mesure des cibles,
  // ce qui corrige tout décalage dû à une mesure initiale avec un scroll non-nul.
  useEffect(() => {
    registerScrollRef('trophies', scrollRef);
    registerRemeasure('trophies', () => setTimeout(() => { rFilters(); rUltimate(); }, 50));
  }, [registerScrollRef, registerRemeasure, rFilters, rUltimate]);

  useFocusEffect(
    useCallback(() => {
      if (pendingChapterId === 'trophies') {
        const t = setTimeout(() => startChapter('trophies'), 400);
        return () => clearTimeout(t);
      }
    }, [pendingChapterId, startChapter]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation && navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Salle des Trophées</Text>
          <Text style={styles.headerSub}>{unlockedCount}/{TROPHY_CATALOG.length} débloqués</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow} ref={filtersRef} onLayout={onFiltersLayout} collapsable={false}>
        {TROPHY_FILTER_TABS.map((tab) => {
          const active = activeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterTab, active && styles.filterTabActive]}
              onPress={() => setFilter(tab.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      >
        {/* ── Trophée Ultime (toujours visible en premier) ── */}
        {(activeFilter === 'all' || activeFilter === 'special') && (
          <View style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <View style={[styles.catIconBox, { backgroundColor: 'rgba(255,215,0,0.15)', borderColor: 'rgba(255,215,0,0.35)' }]}>
                <Ionicons name="infinite" size={14} color="#FFD700" />
              </View>
              <Text style={[styles.categoryLabel, { color: '#FFD700' }]}>Trophée Ultime</Text>
              <Text style={styles.categoryCount}>{ultimateUnlocked ? '1/1' : '0/1'}</Text>
            </View>
            <View ref={ultimateRef} onLayout={onUltimateLayout} collapsable={false}>
              <UltimateTile unlocked={ultimateUnlocked} onPress={() => setSelected(ultimateTrophy)} />
            </View>
          </View>
        )}

        {/* ── Catégories standard ── */}
        {visibleCategories.map((cat) => {
          const catTrophies = evaluated.filter((t) => t.category === cat.id);
          if (catTrophies.length === 0) return null;
          const catUnlocked = catTrophies.filter((t) => t.unlocked).length;
          return (
            <View key={cat.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.catIconBox, { backgroundColor: cat.color + '18', borderColor: cat.color + '35' }]}>
                  <Ionicons name={cat.icon} size={14} color={cat.color} />
                </View>
                <Text style={[styles.categoryLabel, { color: cat.color }]}>{cat.label}</Text>
                <Text style={styles.categoryCount}>{catUnlocked}/{catTrophies.length}</Text>
              </View>
              <View style={styles.trophyGrid}>
                {catTrophies.map((trophy) => (
                  <GalleryTile
                    key={trophy.id}
                    trophy={trophy}
                    onPress={() => setSelected(trophy)}
                    tutorialRef={trophy.id === firstTrophyId ? firstTrophyRef : null}
                    tutorialOnLayout={trophy.id === firstTrophyId ? onFirstTrophyLayout : undefined}
                  />
                ))}
              </View>
            </View>
          );
        })}

        <View style={{ height: 30 }} />
      </ScrollView>

      {selected && (
        <TrophyDetailModal
          trophy={selected}
          onClose={() => setSelected(null)}
          isFeatured={isFeatured(selected.id)}
          onToggleFeatured={() => toggleFeatured(selected.id)}
        />
      )}

      {activeChapterId === 'trophies' && (
        <TutorialOverlay navigation={navigation} />
      )}
    </SafeAreaView>
  );
}

// ─── GalleryTile ─────────────────────────────────────────────────────────────

function GalleryTile({ trophy, onPress, tutorialRef, tutorialOnLayout }) {
  const { icon, label, condition, color, gradientColors, unlocked, tier } = trophy;
  const glow = TIER_GLOW[tier] || TIER_GLOW.bronze;

  return (
    <TouchableOpacity
      ref={tutorialRef}
      onLayout={tutorialOnLayout}
      style={[styles.tile, unlocked && { borderColor: color + '40', borderTopColor: color + '90' }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {unlocked && (
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'transparent', 'rgba(0,0,0,0.12)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill} borderRadius={14}
        />
      )}
      <View style={[
        styles.tileIconWrap,
        unlocked && { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: glow.opacity, shadowRadius: glow.radius, elevation: glow.elevation },
      ]}>
        {unlocked ? (
          <LinearGradient colors={gradientColors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.tileIconGrad}>
            <Ionicons name={icon} size={22} color="#fff" />
          </LinearGradient>
        ) : (
          <View style={styles.tileIconLocked}>
            <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.12)" />
          </View>
        )}
      </View>
      <Text style={[styles.tileLabel, { color: unlocked ? Colors.textPrimary : Colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.tileCond,  { color: unlocked ? color : 'rgba(255,255,255,0.14)' }]} numberOfLines={2}>{condition}</Text>
      {unlocked && (
        <View style={[styles.tierBadge, { backgroundColor: color + '22', borderColor: color + '50' }]}>
          <Text style={[styles.tierText, { color }]}>{tier.toUpperCase()}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── TrophyDetailModal ────────────────────────────────────────────────────────

function TrophyDetailModal({ trophy, onClose, isFeatured = false, onToggleFeatured }) {
  const { icon, label, condition, epicDesc, color, gradientColors, unlocked, tier } = trophy;
  const scale   = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, tension: 130, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 190, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const glow = TIER_GLOW[tier] || TIER_GLOW.bronze;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.modalCard, { transform: [{ scale }], opacity }]}>
          <Pressable onPress={() => {}}>
            <View style={[styles.modalIconShadow, { shadowColor: color, shadowOpacity: glow.opacity, shadowRadius: glow.radius + 8 }]}>
              <LinearGradient colors={gradientColors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.modalIconGrad}>
                {unlocked
                  ? <Ionicons name={icon} size={52} color="#fff" />
                  : <Ionicons name="lock-closed" size={36} color="rgba(255,255,255,0.3)" />}
              </LinearGradient>
            </View>
            <Text style={[styles.modalLabel, { color }]}>{label}</Text>
            <Text style={styles.modalCond}>{condition}</Text>
            <View style={[styles.badge, unlocked
              ? { backgroundColor: color + '1A', borderColor: color + '55' }
              : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }
            ]}>
              <Ionicons name={unlocked ? 'checkmark-circle' : 'lock-closed'} size={13}
                color={unlocked ? color : Colors.textMuted} />
              <Text style={[styles.badgeText, { color: unlocked ? color : Colors.textMuted }]}>
                {unlocked ? `${tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : ''} — Débloqué` : 'Verrouillé'}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: color + '30' }]} />
            <Text style={[styles.epicDesc, !unlocked && { color: Colors.textMuted, fontStyle: 'italic' }]}>
              {unlocked ? epicDesc : "Accomplissez encore — ce trophée attend le guerrier que vous deviendrez."}
            </Text>
            {unlocked && (
              <TouchableOpacity
                style={[styles.featuredBtn, isFeatured && { backgroundColor: color + '18', borderColor: color + '55' }]}
                onPress={() => { onToggleFeatured?.(); onClose(); }}
                activeOpacity={0.75}
              >
                <Ionicons name={isFeatured ? 'star' : 'star-outline'} size={13} color={isFeatured ? color : Colors.textMuted} />
                <Text style={[styles.featuredBtnText, { color: isFeatured ? color : Colors.textMuted }]}>
                  {isFeatured ? 'Retirer de la vitrine' : 'Mettre en avant sur le profil'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.closeBtn, { borderColor: color + '50' }]} onPress={onClose} activeOpacity={0.75}>
              <Text style={[styles.closeTxt, { color }]}>Fermer</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundDeep },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardDeep, borderRadius: 12 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  headerSub:   { color: Colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },

  filterRow: { flexDirection: 'row', marginHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterTab: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  filterTabActive: { backgroundColor: 'rgba(254,116,57,0.14)', borderColor: Colors.primary + '50' },
  filterLabel:       { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  filterLabelActive: { color: Colors.primary },

  content: { paddingHorizontal: 16, paddingTop: 4 },

  categorySection: { marginBottom: 24 },
  categoryHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  catIconBox:      { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  categoryLabel:   { fontSize: 13, fontWeight: '900', letterSpacing: 0.8, flex: 1 },
  categoryCount:   { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  trophyGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // ── Ultimate ─────────────────────────────────────────────────────────────
  ultimateWrapper: { width: '100%' },
  ultimateTile: {
    width: '100%',
    backgroundColor: 'rgba(22,22,31,0.97)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.20)',
    overflow: 'hidden',
    padding: 16,
  },
  ultimateInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ultimateIconWrap: { width: 80, height: 80, borderRadius: 24 },
  ultimateIconGrad: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  ultimateIconLocked: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  ultimateGleam: {
    position: 'absolute', top: -10,
    width: 24, height: 100,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 8,
  },
  ultimateTextCol: { flex: 1 },
  ultimateLabel: { fontSize: 18, fontWeight: '900', letterSpacing: 0.3, marginBottom: 4 },
  ultimateCond:  { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  ultimateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)',
  },
  ultimateBadgeText: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  ultimateHint: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 12 },

  // ── Tile ──────────────────────────────────────────────────────────────────
  tile: { width: '47%', backgroundColor: 'rgba(22,22,31,0.97)', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center', borderWidth: 0.8, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  tileIconWrap: { width: 48, height: 48, borderRadius: 16, marginBottom: 10 },
  tileIconGrad: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderTopWidth: 0.8, borderTopColor: 'rgba(255,255,255,0.48)', borderWidth: 0.8, borderColor: 'rgba(255,255,255,0.08)' },
  tileIconLocked: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.8, borderColor: 'rgba(255,255,255,0.07)' },
  tileLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  tileCond:  { fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 3, lineHeight: 14 },
  tierBadge: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  tierText:  { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },

  // ── Modal ──────────────────────────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.74)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: { width: '100%', backgroundColor: 'rgba(20,20,28,0.96)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderTopColor: 'rgba(255,255,255,0.22)', shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.70, shadowRadius: 48, elevation: 32, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' },
  modalIconShadow: { marginBottom: 20, shadowOffset: { width: 0, height: 0 }, elevation: 24 },
  modalIconGrad: { width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  modalLabel:    { fontSize: 26, fontWeight: '900', letterSpacing: 0.4, marginBottom: 5 },
  modalCond:     { color: Colors.textMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0.4, marginBottom: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginBottom: 4 },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  divider:   { width: '55%', height: 1, marginVertical: 20 },
  epicDesc:  { color: Colors.textSecondary, fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 4 },
  featuredBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 11, paddingHorizontal: 24, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 10 },
  featuredBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  closeBtn:  { paddingVertical: 12, paddingHorizontal: 40, borderRadius: 14, borderWidth: 1 },
  closeTxt:  { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
