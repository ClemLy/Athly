import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../constants/theme';

// Heatmap d'activité 12 mois glissants — style GitHub.
// `heatmap` : sortie de stats.service.aggregateActivityHeatmap()
//   { cols: Array<Array<{ date, volume, intensity 0-4, inRange }>>, totalDaysWithWorkout, totalVolume }
//
// Rendu : 53 colonnes scrollables horizontalement × 7 cellules.
// Cell = view carrée, couleur selon intensité (0 = très foncé, 4 = orange plein).

const CELL_SIZE = 11;
const CELL_GAP = 3;

// Palette d'intensités : du foncé neutre au orange plein.
const INTENSITY_COLOR = {
  0: '#161622',   // pas de séance — gris très sombre, distinct du fond
  1: '#4D2718',   // léger
  2: '#85391E',
  3: '#C44C24',
  4: '#FE7439',   // plein
};

function monthLabelFor(dateKey) {
  const d = new Date(dateKey);
  return ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][d.getMonth()];
}

export default function ActivityHeatmap({ heatmap = null }) {
  const cols = (heatmap && Array.isArray(heatmap.cols)) ? heatmap.cols : [];
  const totalDays = heatmap && heatmap.totalDaysWithWorkout ? heatmap.totalDaysWithWorkout : 0;

  // Étiquettes de mois : on en place une par changement de mois (mais espacées d'au moins 4 colonnes).
  const monthLabels = useMemo(() => {
    if (cols.length === 0) return [];
    const labels = [];
    let lastMonth = null;
    let lastIdx = -10;
    cols.forEach((week, idx) => {
      const cell = week.find((c) => c && c.inRange) || week[0];
      if (!cell || !cell.date) return;
      const d = new Date(cell.date);
      const m = d.getMonth();
      if (m !== lastMonth && idx - lastIdx >= 4) {
        labels.push({ idx, label: monthLabelFor(cell.date) });
        lastMonth = m;
        lastIdx = idx;
      }
    });
    return labels;
  }, [cols]);

  if (cols.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Reviens dans quelques jours pour voir ta régularité.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{totalDays} jour{totalDays > 1 ? 's' : ''} d'activité</Text>
        <View style={styles.legend}>
          <Text style={styles.legendLabel}>−</Text>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={`l-${i}`}
              style={[styles.legendCell, { backgroundColor: INTENSITY_COLOR[i] }]}
            />
          ))}
          <Text style={styles.legendLabel}>+</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View>
          {/* Étiquettes mois */}
          <View style={styles.monthRow}>
            {cols.map((_, idx) => {
              const lbl = monthLabels.find((m) => m.idx === idx);
              return (
                <Text key={`m-${idx}`} style={styles.monthLabel}>
                  {lbl ? lbl.label : ''}
                </Text>
              );
            })}
          </View>
          {/* Grille 7×N */}
          <View style={styles.grid}>
            {cols.map((week, c) => (
              <View key={`c-${c}`} style={styles.col}>
                {week.map((cell, r) => (
                  <View
                    key={`c-${c}-r-${r}`}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: cell && cell.inRange
                          ? INTENSITY_COLOR[cell.intensity || 0]
                          : 'transparent',
                        opacity: cell && cell.inRange ? 1 : 0,
                      },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginHorizontal: 4,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  scrollContent: {
    paddingRight: 6,
  },
  monthRow: {
    flexDirection: 'row',
    height: 14,
    marginBottom: 4,
  },
  monthLabel: {
    width: CELL_SIZE + CELL_GAP,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  grid: {
    flexDirection: 'row',
  },
  col: {
    marginRight: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
    marginBottom: CELL_GAP,
  },
  empty: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
