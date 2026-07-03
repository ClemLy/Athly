import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useToast } from '../../context/ToastContext';
import { getRank, xpToLevel } from '../../services/stats.service';
import { getFriendProfile, getMyGroup, shakeMember } from '../../services/social.service';

import HeroLevelCard        from '../../components/profile/HeroLevelCard';
import StreakBadge          from '../../components/profile/StreakBadge';
import EmberParticles       from '../../components/profile/EmberParticles';
import AchievementShowcase  from '../../components/profile/AchievementShowcase';
import FriendShowcaseGrid   from '../../components/profile/FriendShowcaseGrid';

// ─── FriendProfileScreen ──────────────────────────────────────────────────────
// Profil public d'un ami (Brique III) : miroir en lecture seule de notre propre
// ProfileScreen — même hero card (avec le cadre équipé de l'ami), même jauge
// d'XP/niveau/rang, mêmes stats globales, et la vitrine complète des trophées
// backend V2. Aucune action personnelle (Sac, Modifier le profil) : uniquement
// des actions sociales légitimes (Secouer si coéquipier, statut d'amitié).
//
// Le backend refuse (403) si la relation n'est pas acceptée.

function buildBgGradient(isGod, isLegend, isElite) {
  if (isGod)    return ['#0A0800', '#100D02', Colors.bgAbyss, '#08080E'];
  if (isLegend) return [Colors.bgAbyss, '#0C0816', '#0D0A1A', Colors.bgAbyss];
  if (isElite)  return [Colors.bgAbyss, '#0A0A18', '#0D0D1C', Colors.bgAbyss];
  return [Colors.bgAbyss, '#09090F', Colors.bgAbyss];
}

export default function FriendProfileScreen({ route, navigation }) {
  const { friendId, pseudo } = route.params ?? {};
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [sharedGroup, setSharedGroup] = useState(null); // groupe où l'ami et moi sommes tous deux membres
  const [shaking, setShaking]   = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const [profileRes, groupRes] = await Promise.all([
        getFriendProfile(friendId),
        getMyGroup().catch(() => null),
      ]);
      setProfile(profileRes.profile);

      const group = groupRes?.group;
      const isSharedGroup = group?.members?.some((m) => m._id === friendId);
      setSharedGroup(isSharedGroup ? group : null);

      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    } catch (error) {
      if (!error.isSessionExpired) {
        showToast(error.data?.message || 'Profil inaccessible.', 'error');
      }
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId]);

  useEffect(() => { load(); }, [load]);

  const handleShake = async () => {
    if (shaking || !sharedGroup) return;
    setShaking(true);
    try {
      const res = await shakeMember(sharedGroup._id, friendId);
      showToast(res.message || `${pseudo} a été secoué ! 🚨`, 'success');
    } catch (error) {
      if (!error.isSessionExpired) showToast(error.data?.message || 'Action impossible.', 'error');
    } finally {
      setShaking(false);
    }
  };

  const level = useMemo(() => xpToLevel(profile?.user?.xp ?? 0).level, [profile]);
  const rank  = useMemo(() => getRank(level), [level]);
  const isElite  = level >= 91;
  const isLegend = level >= 171;
  const isGod    = level >= 200;
  const bgColors = buildBgGradient(isGod, isLegend, isElite);
  const topPad   = insets.top + 16;

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={buildBgGradient(false, false, false)} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[styles.centered, { paddingTop: topPad }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (!profile) return null;

  const equippedFrame = profile.user.equippedFrame || { shapeId: 'circle', colorId: 'none' };

  // Vitrine : IDs mis en avant résolus en entrées complètes du catalogue unifié
  const showcasedEntries = (profile.showcasedAchievements || [])
    .map((id) => (profile.achievements || []).find((a) => a.id === id))
    .filter(Boolean);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity }}>

          {/* ── Hero Level Card (cadre équipé de l'ami) ── */}
          <View style={styles.heroWrapper}>
            <HeroLevelCard
              name={profile.user.pseudo}
              initial={(profile.user.pseudo ?? '?').charAt(0).toUpperCase()}
              totalXP={profile.user.xp}
              totalSessions={profile.stats.totalSessions}
              totalActiveDays={profile.stats.totalActiveDays}
              shapeId={equippedFrame.shapeId}
              colorId={equippedFrame.colorId}
            />
            <EmberParticles
              visible={isLegend}
              color={isGod ? '#FFD700' : '#C084FC'}
            />
          </View>

          {/* ── Streak ── */}
          {profile.stats.streak > 0 && (
            <View style={styles.streakWrap}>
              <StreakBadge streak={profile.stats.streak} />
            </View>
          )}

          {/* ── Vitrine de l'ami : ses trophées mis en avant (mêmes TrophySlot que le profil) ── */}
          <FriendShowcaseGrid pseudo={profile.user.pseudo} entries={showcasedEntries} />

          {/* ── Statut d'amitié ── */}
          <View style={styles.friendshipCard}>
            <View style={styles.friendshipHearts}>
              {Array.from({ length: 5 }, (_, i) => (
                <Ionicons
                  key={i}
                  name={i < profile.friendshipLevel ? 'heart' : 'heart-outline'}
                  size={16}
                  color={i < profile.friendshipLevel ? '#FF4D6D' : Colors.borderDim}
                  style={{ marginHorizontal: 2 }}
                />
              ))}
            </View>
            <Text style={styles.friendshipLevel}>
              Niveau d'amitié {profile.friendshipLevel}/5
              {profile.friendshipLevel === 5 ? ' · Lien de Sang' : ''}
            </Text>
            <Text style={styles.friendshipXp}>{profile.friendshipXp} XP d'amitié</Text>
          </View>

          {/* ── Action sociale : Secouer (uniquement si coéquipier de streak) ── */}
          {sharedGroup && (
            <TouchableOpacity style={styles.shakeBanner} onPress={handleShake} disabled={shaking} activeOpacity={0.85}>
              <View style={styles.shakeIconBox}>
                {shaking
                  ? <ActivityIndicator size="small" color={Colors.error} />
                  : <Ionicons name="warning" size={18} color={Colors.error} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shakeTitle}>Coéquipier de streak</Text>
                <Text style={styles.shakeSub}>Secoue {profile.user.pseudo} s'il n'a pas encore fait sa séance</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.chevron} />
            </TouchableOpacity>
          )}

          {/* ── Vitrine des trophées ── */}
          <Section title="Trophées">
            <GlassCard>
              <AchievementShowcase achievements={profile.achievements} stats={profile.achievementsStats} />
            </GlassCard>
          </Section>

          {/* ── Records personnels ── */}
          <Section title="Records">
            <GlassCard>
              {profile.records.length === 0 ? (
                <View style={styles.emptyRecords}>
                  <Ionicons name="barbell-outline" size={28} color={Colors.textMuted} />
                  <Text style={styles.emptyTxt}>Aucun record enregistré pour le moment.</Text>
                </View>
              ) : profile.records.map((r, i) => (
                <View key={r.exercice} style={[styles.recordRow, i === profile.records.length - 1 && { borderBottomWidth: 0 }]}>
                  <Ionicons name="barbell" size={16} color={Colors.primary} style={{ marginRight: 10 }} />
                  <Text style={styles.recordName} numberOfLines={1}>{r.exercice}</Text>
                  <Text style={styles.recordValue}>{r.maxPoids} kg × {r.maxReps}</Text>
                </View>
              ))}
            </GlassCard>
          </Section>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components (miroir de ProfileScreen.js) ──────────────────────────────

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function GlassCard({ children }) {
  return <View style={styles.glassCard}>{children}</View>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgAbyss },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  backBtn: { position: 'absolute', left: 20, zIndex: 10 },

  heroWrapper: { position: 'relative' },
  streakWrap:  { marginTop: 10 },

  friendshipCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.07)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.28)',
    borderRadius: 16, padding: 16, marginTop: 14,
  },
  friendshipHearts: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  friendshipLevel:  { color: Colors.textPrimary, fontSize: 13.5, fontWeight: '700' },
  friendshipXp:     { color: Colors.textMuted, fontSize: 11.5, marginTop: 2 },

  shakeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12,
    backgroundColor: 'rgba(255,77,77,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,77,77,0.28)',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  shakeIconBox: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: 'rgba(255,77,77,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  shakeTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  shakeSub:   { color: Colors.textMuted, fontSize: 11, marginTop: 1 },

  section: { marginTop: 26 },
  sectionTitle: {
    color: Colors.textPrimary, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12,
  },
  glassCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: 18, padding: 14, overflow: 'hidden',
  },

  recordRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  recordName:  { flex: 1, color: Colors.textPrimary, fontSize: 13.5, fontWeight: '600', marginRight: 8 },
  recordValue: { color: Colors.primary, fontSize: 13, fontWeight: '800' },

  emptyRecords: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyTxt: { color: Colors.textMuted, fontSize: 12.5, textAlign: 'center' },
});
