import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useToast } from '../../context/ToastContext';
import { getFriendProfile } from '../../services/social.service';

// ─── FriendProfileScreen ──────────────────────────────────────────────────────
// Profil public d'un ami (Brique III) : progression, lien d'amitié, records.
// Le backend refuse (403) si la relation n'est pas acceptée.

export default function FriendProfileScreen({ route, navigation }) {
  const { friendId, pseudo } = route.params ?? {};
  const { showToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const res = await getFriendProfile(friendId);
        setProfile(res.profile);
        Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }).start();
      } catch (error) {
        if (!error.isSessionExpired) {
          showToast(error.data?.message || 'Profil inaccessible.', 'error');
        }
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pseudo ?? 'Profil'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : profile && (
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            {/* ── Identité de jeu ── */}
            <View style={styles.heroCard}>
              <View style={styles.bigAvatar}>
                <Text style={styles.bigAvatarTxt}>{(profile.user.pseudo ?? '?').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.pseudo}>{profile.user.pseudo}</Text>
              <Text style={styles.rank}>{profile.user.rank} · Niveau {profile.user.level}</Text>

              <View style={styles.statRow}>
                <Stat label="XP" value={profile.user.xp} />
                <Stat label="Trophées" value={profile.achievementsCount} />
                <Stat label="Minutes" value={profile.user.totalWorkoutMinutes ?? 0} />
              </View>
            </View>

            {/* ── Lien d'amitié ── */}
            <View style={styles.friendshipCard}>
              <View style={styles.friendshipHearts}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Ionicons
                    key={i}
                    name={i < profile.friendshipLevel ? 'heart' : 'heart-outline'}
                    size={18}
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

            {/* ── Records ── */}
            <Text style={styles.sectionLabel}>RECORDS</Text>
            {profile.records.length === 0 ? (
              <Text style={styles.emptyTxt}>Aucun record enregistré pour le moment.</Text>
            ) : profile.records.map((r) => (
              <View key={r.exercice} style={styles.recordRow}>
                <Ionicons name="barbell" size={16} color={Colors.primary} style={{ marginRight: 10 }} />
                <Text style={styles.recordName} numberOfLines={1}>{r.exercice}</Text>
                <Text style={styles.recordValue}>{r.maxPoids} kg × {r.maxReps}</Text>
              </View>
            ))}

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgAbyss },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 54, paddingBottom: 14,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  loadingBox:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:     { paddingHorizontal: 16 },

  heroCard: {
    alignItems: 'center',
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 18, padding: 22, marginTop: 6,
  },
  bigAvatar: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: 'rgba(254,116,57,0.14)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  bigAvatarTxt: { color: Colors.primary, fontSize: 28, fontWeight: '800' },
  pseudo: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  rank:   { color: Colors.textSecondary, fontSize: 13, marginTop: 3, marginBottom: 16 },

  statRow: { flexDirection: 'row', width: '100%' },
  stat:    { flex: 1, alignItems: 'center' },
  statValue: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  friendshipCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.07)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.28)',
    borderRadius: 16, padding: 16, marginTop: 12,
  },
  friendshipHearts: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  friendshipLevel:  { color: Colors.textPrimary, fontSize: 13.5, fontWeight: '700' },
  friendshipXp:     { color: Colors.textMuted, fontSize: 11.5, marginTop: 2 },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 22, marginBottom: 8, marginLeft: 4,
  },
  recordRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 12, paddingHorizontal: 14, height: 46, marginBottom: 7,
  },
  recordName:  { flex: 1, color: Colors.textPrimary, fontSize: 13.5, fontWeight: '600', marginRight: 8 },
  recordValue: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  emptyTxt:    { color: Colors.textMuted, fontSize: 12.5, marginLeft: 4 },
});
