import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { TrophySlot, FeaturedModal } from './TrophySlot';
import { normalizeAchievement } from './AchievementShowcase';

// Vitrine d'un ami : mêmes TrophySlot (gradient + glow + gleam) que la Vitrine
// du profil — aucune réimplémentation visuelle distincte.

export default function FriendShowcaseGrid({ pseudo, entries = [] }) {
  const [selected, setSelected] = useState(null);
  if (entries.length === 0) return null;

  const trophies = entries.map((a) => ({ ...normalizeAchievement(a), unlocked: true }));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={13} color={Colors.gold} />
        <Text style={styles.title}>VITRINE DE {(pseudo || '').toUpperCase()}</Text>
      </View>
      <View style={styles.row}>
        {trophies.map((trophy) => (
          <TrophySlot key={trophy.id} trophy={trophy} onPress={() => setSelected(trophy)} />
        ))}
      </View>

      {selected && (
        <FeaturedModal trophy={selected} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,215,0,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.22)',
    borderRadius: 16, padding: 14, marginTop: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
  },
  title: {
    color: Colors.gold, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2,
  },
  row: { flexDirection: 'row', gap: 10 },
});
