import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TrophySlot, FeaturedModal } from './TrophySlot';
import { normalizeAchievement } from './AchievementShowcase';

// Vitrine d'un ami : mêmes TrophySlot que la Vitrine de son propre profil.
// Sans la condition sous le nom : elle est rédigée à la 2e personne ("Tu as…")
// et ne s'appliquerait pas à l'ami.

export default function FriendShowcaseGrid({ entries = [] }) {
  const [selected, setSelected] = useState(null);
  if (entries.length === 0) return null;

  const trophies = entries.map((a) => ({ ...normalizeAchievement(a), unlocked: true }));

  return (
    <>
      <View style={styles.row}>
        {trophies.map((trophy) => (
          <TrophySlot key={trophy.id} trophy={trophy} hideCondition onPress={() => setSelected(trophy)} />
        ))}
      </View>
      {selected && (
        <FeaturedModal trophy={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
});
