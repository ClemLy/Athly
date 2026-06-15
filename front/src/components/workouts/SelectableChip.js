import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

// Chip inline sélectionnable (toggle on tap). Utilisé dans les formulaires
// (EditExerciseScreen, WorkoutBuilderScreen) sans modal.
//
// Props :
//   - label (string)
//   - selected (bool)
//   - onPress (function)
//   - size : 'md' (default) | 'sm'
//
function SelectableChip({ label, selected = false, onPress, size = 'md' }) {
  const sizeStyles = size === 'sm' ? styles.chipSm : styles.chipMd;
  const sizeTextStyles = size === 'sm' ? styles.textSm : styles.textMd;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.base, sizeStyles, selected ? styles.selected : styles.unselected]}
    >
      <Text style={[sizeTextStyles, selected ? styles.textSelected : styles.textUnselected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 22,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  chipMd: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSm: {
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  selected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unselected: {
    backgroundColor: Colors.card,
    borderColor: '#23232b',
  },
  textMd: {
    fontSize: 14,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSelected: {
    color: '#fff',
  },
  textUnselected: {
    color: Colors.textSecondary,
  },
});

export default React.memo(SelectableChip);
