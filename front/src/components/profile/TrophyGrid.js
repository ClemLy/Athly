import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MAX_FEATURED } from '../../hooks';
import { TrophySlot, EmptySlot, FeaturedModal } from './TrophySlot';

// featuredIds + toggleFeatured proviennent du parent (ProfileScreen via useFeaturedTrophies)
// → évite un état stale quand l'utilisateur revient de TrophyRoomScreen
export default function TrophyGrid({ evaluatedCatalog = [], featuredIds = [], toggleFeatured, onNavigateToRoom }) {
  const [selected, setSelected] = useState(null);

  const slots = Array.from({ length: MAX_FEATURED }, (_, i) => {
    const id = featuredIds[i];
    return id ? (evaluatedCatalog.find((t) => t.id === id) || null) : null;
  });

  const handleUnfeature = (id) => {
    toggleFeatured(id);
    setSelected(null);
  };

  return (
    <>
      <View style={styles.row}>
        {slots.map((trophy, i) =>
          trophy ? (
            <TrophySlot key={trophy.id} trophy={trophy} onPress={() => setSelected(trophy)} />
          ) : (
            <EmptySlot key={`empty-${i}`} onPress={onNavigateToRoom} />
          )
        )}
      </View>

      {selected && (
        <FeaturedModal
          trophy={selected}
          onClose={() => setSelected(null)}
          onUnfeature={() => handleUnfeature(selected.id)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
});
