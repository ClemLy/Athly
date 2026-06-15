import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SetRow from '../cards/SetRow';
import { Colors } from '../../constants/theme';

// Tableau pixel-perfect SET | POIDS (KG) | REPS | ✓ (maquette 2).
// Colonnes alignées via les mêmes flex/width que SetRow pour une symétrie parfaite.
//
// Props :
//   - sets : array<{ weight, reps, completed }>
//   - onToggle(setIndex) : tape sur la checkbox
//   - onChange(setIndex, { weight, reps }) : édite poids ou reps
//
function HeaderCell({ children, style, align = 'center' }) {
  return (
    <View style={[styles.headerCellWrap, style, { alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }]}>
      <Text style={styles.headerText}>{children}</Text>
    </View>
  );
}

export default function SetTable({ sets = [], onToggle, onChange }) {
  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        <HeaderCell style={styles.colSet} align="left">SET</HeaderCell>
        <HeaderCell style={styles.colWeight}>POIDS (KG)</HeaderCell>
        <HeaderCell style={styles.colReps}>REPS</HeaderCell>
        <HeaderCell style={styles.colBtn}> </HeaderCell>
      </View>

      {sets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune série pour cet exercice</Text>
        </View>
      ) : (
        sets.map((s, i) => (
          <SetRow
            key={`set-${i}`}
            index={i}
            setData={s}
            onToggle={() => onToggle && onToggle(i)}
            onChange={(patch) => onChange && onChange(i, patch)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#23232b',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#16161c',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#23232b',
  },
  headerCellWrap: {
    justifyContent: 'center',
  },
  headerText: {
    color: '#8B95A3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  colSet: {
    flex: 1,
    paddingLeft: 18,
  },
  colWeight: {
    flex: 2,
  },
  colReps: {
    flex: 2,
  },
  colBtn: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: 22,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
