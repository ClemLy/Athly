import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

// Petit tag arrondi qui affiche l'équipement d'un exercice (ex. "Haltères", "Câble").
export default function EquipmentTag({ label }) {
  if (!label) return null;
  return (
    <View style={styles.tag}>
      <Text style={styles.text} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: '#26262e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});
