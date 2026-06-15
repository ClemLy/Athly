import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import FilterChip from './FilterChip';
import { MUSCLES, LEVELS, EQUIPMENTS } from '../../constants/exerciseFilters';
import { Colors } from '../../constants/theme';

// Barre de tri / filtres horizontale (sticky-ready). Les sélections sont contrôlées par le parent.
//
// Props :
//   - filters : { muscles: string[], levels: string[], equipment: string[] }
//   - onChange : (newFilters) => void
//
export default function SortBar({ filters = {}, onChange }) {
  const muscles = Array.isArray(filters.muscles) ? filters.muscles : [];
  const levels = Array.isArray(filters.levels) ? filters.levels : [];
  const equipment = Array.isArray(filters.equipment) ? filters.equipment : [];

  const update = (patch) => {
    onChange && onChange({ muscles, levels, equipment, ...patch });
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <FilterChip
          label="Muscle"
          options={MUSCLES}
          values={muscles}
          onChange={(values) => update({ muscles: values })}
        />
        <FilterChip
          label="Niveau"
          options={LEVELS}
          values={levels}
          onChange={(values) => update({ levels: values })}
        />
        <FilterChip
          label="Matériel"
          options={EQUIPMENTS}
          values={equipment}
          onChange={(values) => update({ equipment: values })}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.background,
    paddingVertical: 10,
  },
  scroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
});
