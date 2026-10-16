import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';
import { SkeletonGroup, Skeleton } from '../common/Skeleton';

// ─── Silhouette d'un profil pendant son chargement ────────────────────────────
// Reprend la structure de ProfileScreen et FriendProfileScreen : en-tête,
// carte de niveau (avatar, nom, jauge d'XP, 3 stats), tuiles et une section.
// `header` permet de garder un vrai bouton retour utilisable pendant l'attente.

export default function ProfileSkeleton({ header = null, tiles = 4 }) {
  return (
    <View>
      {header}
      <SkeletonGroup label="Chargement du profil">
        {!header ? (
          <View style={s.header}>
            <Skeleton w={110} h={26} r={8} />
            <Skeleton w={44} h={44} r={22} />
          </View>
        ) : null}

        <View style={s.hero}>
          <View style={s.heroTop}>
            <Skeleton w={84} h={84} r={42} />
            <View style={s.heroText}>
              <Skeleton w="70%" h={20} r={7} />
              <Skeleton w="45%" h={12} />
            </View>
          </View>
          <Skeleton h={8} r={4} />
          <View style={s.stats}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.stat}>
                <Skeleton w={36} h={18} r={6} />
                <Skeleton w={52} h={10} />
              </View>
            ))}
          </View>
        </View>

        <View style={s.tiles}>
          {Array.from({ length: tiles }).map((_, i) => (
            <View key={i} style={s.tile}>
              <Skeleton w={32} h={32} r={10} />
              <Skeleton w="60%" h={13} />
              <Skeleton w="80%" h={10} />
            </View>
          ))}
        </View>

        <Skeleton w={120} h={16} r={6} style={s.sectionTitle} />
        <View style={s.grid}>
          {[0, 1, 2].map((i) => <View key={i} style={s.gridCell}><Skeleton h={96} r={14} /></View>)}
        </View>
      </SkeletonGroup>
    </View>
  );
}

const CARD = {
  backgroundColor: Colors.cardDeep,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
};

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  hero: { ...CARD, padding: 18, gap: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroText: { flex: 1, gap: 10 },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  tile: { ...CARD, flexBasis: '47%', flexGrow: 1, padding: 14, gap: 8, borderRadius: 16 },
  sectionTitle: { marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', gap: 10 },
  gridCell: { flex: 1 },
});
