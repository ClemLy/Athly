import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

const ITEMS = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'all', label: 'Tout' },
];

// Segmented control pour basculer Semaine / Mois / Tout. Pure UI, contrôlé par parent.
export default function PeriodSegmentedControl({ value = 'month', onChange }) {
  return (
    <View style={styles.wrap}>
      {ITEMS.map((item) => {
        const active = item.id === value;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onChange && onChange(item.id)}
            style={[styles.item, active && styles.itemActive]}
            activeOpacity={0.85}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: Colors.cardDeep,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  item: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
