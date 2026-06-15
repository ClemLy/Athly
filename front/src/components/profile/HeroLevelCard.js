import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { xpToLevel, getRank } from '../../services/stats.service';
import AvatarFrame from './AvatarFrame';

export default function HeroLevelCard({
  name = 'Athlète',
  initial = 'U',
  totalXP = 0,
  totalSessions = 0,
  totalActiveDays = 0,
  shapeId = 'circle',
  colorId = 'none',
  profileTheme = null,  // PROFILE_THEMES entry — overrides visual rank when set
}) {
  const { level, currentInLevel, neededForNext, progress } = useMemo(
    () => xpToLevel(totalXP),
    [totalXP],
  );
  const realRank = useMemo(() => getRank(level), [level]);

  // When a profile theme is active, override color/glow/shimmer while keeping real level number
  const rank = useMemo(() => {
    if (!profileTheme || profileTheme.id === 'auto') return realRank;
    return {
      ...realRank,
      color:     profileTheme.accentColor || realRank.color,
      glowColor: profileTheme.glowColor   ?? realRank.glowColor,
      shimmer:   profileTheme.shimmer     ?? realRank.shimmer,
    };
  }, [profileTheme, realRank]);

  const pct = Math.max(0, Math.min(1, progress || 0));

  const hasGlow     = profileTheme && profileTheme.id !== 'auto' ? profileTheme.hasGlow    : level >= 71;
  const hasNeonRing = profileTheme && profileTheme.id !== 'auto'
    ? ['elite', 'legend', 'god'].includes(profileTheme.bgVariant)
    : level >= 91;
  // Shimmer toujours basé sur le rang réel — s'active dès Niv. 171 (Légende)
  // quel que soit le thème équipé
  const hasShimmer = realRank.shimmer;
  const isGod      = profileTheme && profileTheme.id !== 'auto' ? profileTheme.bgVariant === 'god' : level >= 200;

  // Shimmer pulse pour Légende / Athly God
  const shimmerAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (!hasShimmer) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasShimmer, shimmerAnim]);

  const cardStyle = [
    styles.card,
    hasGlow && { borderColor: rank.color + '28', borderWidth: 0.5 },
    isGod   && { borderColor: '#FFD70055', borderWidth: 1 },
  ];

  const hasFrame = colorId !== 'none';
  const avatarStyle = [
    styles.avatar,
    // When a custom frame is active, the AvatarFrame SVG provides the dark
    // inner background → this View must be transparent with no border.
    hasFrame && { backgroundColor: 'transparent', borderWidth: 0 },
    !hasFrame && hasNeonRing && { borderColor: rank.color, borderWidth: 2.5 },
    hasGlow && {
      shadowColor: rank.glowColor || rank.color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 22,
      elevation: 18,
    },
  ];

  return (
    <View style={cardStyle}>

      {/* ── Avatar ── */}
      <View style={styles.avatarWrap}>
        {/* glowHalo only when no frame — the SVG frame provides its own glow ring */}
        {hasGlow && !hasFrame && (
          <View style={[styles.glowHalo, { backgroundColor: rank.glowColor || rank.color }]} />
        )}
        {/*
          Pass userInitial so non-circle frames render the letter as SVG Text at (cx,cy).
          The children View is kept as fallback for colorId='none' (no-frame case)
          where avatarStyle carries the neon-ring border and glow shadow.
        */}
        <AvatarFrame shapeId={shapeId} colorId={colorId} size={90} userInitial={(initial || 'U').slice(0, 1).toUpperCase()}>
          <View style={avatarStyle}>
            <Text style={styles.avatarText}>{(initial || 'U').slice(0, 1).toUpperCase()}</Text>
          </View>
        </AvatarFrame>
        <View style={[styles.levelChip, { backgroundColor: rank.color }]}>
          <Text style={styles.levelChipText}>{level}</Text>
        </View>
      </View>

      {/* ── Nom + badge shimmer ── */}
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{name || 'Athlète'}</Text>
        {hasShimmer && (
          <Animated.Text style={[styles.shimmerBadge, { color: rank.color, opacity: shimmerAnim }]}>
            {' '}✦
          </Animated.Text>
        )}
      </View>

      {/* ── Rang ── */}
      <Text style={[styles.rankName, { color: rank.color }]}>{rank.name}</Text>

      {/* ── Niveau central ── */}
      <View style={styles.levelBlock}>
        <Text style={styles.levelLabel}>NIVEAU</Text>
        <Text style={[
          styles.levelNumber,
          { color: hasGlow ? rank.color : Colors.textPrimary },
          hasGlow && { textShadowColor: rank.glowColor || rank.color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
        ]}>
          {level}
        </Text>
      </View>

      {/* ── Barre de progression ── */}
      <View style={styles.barTrack}>
        <View style={[
          styles.barFill,
          { width: `${pct * 100}%`, backgroundColor: rank.color },
          hasGlow && {
            shadowColor: rank.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 6,
          },
        ]} />
      </View>
      <View style={styles.xpRow}>
        <Text style={styles.xpCurrent}>{currentInLevel.toLocaleString('fr-FR')} XP</Text>
        {level < 200
          ? <Text style={styles.xpNext}>{neededForNext.toLocaleString('fr-FR')} pour Niv.{level + 1}</Text>
          : <Text style={[styles.xpNext, { color: rank.color }]}>NIVEAU MAXIMUM</Text>}
      </View>

      <View style={styles.divider} />

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <Stat icon="bookmark"        label="Séances"     value={totalSessions}                  color={rank.color} />
        <View style={styles.statSep} />
        <Stat icon="calendar-outline" label="Jours actifs" value={totalActiveDays}               color={rank.color} />
        <View style={styles.statSep} />
        <Stat icon="flash"           label="XP total"    value={totalXP.toLocaleString('fr-FR')} color={rank.color} />
      </View>
    </View>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(22, 22, 31, 0.97)',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // ── Avatar ──────────────────────────────────────────────────────────────────
  avatarWrap: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  glowHalo: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    opacity: 0.18,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#0A0A12',
    borderWidth: 2,
    borderColor: Colors.secondaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontWeight: '800',
  },
  levelChip: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.secondaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D0D16',
    paddingHorizontal: 6,
  },
  levelChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },

  // ── Nom ──────────────────────────────────────────────────────────────────────
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  shimmerBadge: {
    fontSize: 20,
    fontWeight: '900',
  },

  // ── Rang ──────────────────────────────────────────────────────────────────────
  rankName: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginTop: 3,
    marginBottom: 4,
    color: Colors.textMuted,
  },

  // ── Niveau ──────────────────────────────────────────────────────────────────
  levelBlock: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  levelLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  levelNumber: {
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 68,
    marginTop: 0,
    letterSpacing: -2,
  },

  // ── Barre ───────────────────────────────────────────────────────────────────
  barTrack: {
    width: '100%',
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 2,
  },
  barFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 7,
  },
  xpCurrent: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  xpNext: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Séparateur ───────────────────────────────────────────────────────────────
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 16,
  },

  // ── Stats ────────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  statSep: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 8,
  },
});
