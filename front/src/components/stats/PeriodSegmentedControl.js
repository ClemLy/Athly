import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';
import { PERIODS } from '../../services/periodStats';

// Choix de la période (7 jours / 4 semaines / 12 mois) en pastilles, plus
// discret que les onglets Performance / Historique au-dessus : on distingue
// d'un coup d'œil « où je suis » (onglet) et « quel filtre » (période).
export default function PeriodSegmentedControl({ value, onChange }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Période">
      {PERIODS.map((p) => {
        const active = p.id === value;
        return (
          <TouchableOpacity
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange && onChange(p.id)}
            style={[styles.pill, active && styles.pillActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{p.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pillActive: {
    backgroundColor: `${Colors.primary}1F`,
    borderColor: `${Colors.primary}80`,
  },
  label: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  labelActive: { color: Colors.primary, fontWeight: '800' },
});
