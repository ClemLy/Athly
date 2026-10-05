import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Colors } from '../../constants/theme';
import { useChartWidth } from '../../hooks/useChartWidth';

// Bar chart du volume total par bucket (jour, semaine ou mois selon période).
// `timeline` est la sortie de stats.service.aggregateGlobal().timeline.
//
// Robuste aux valeurs nulles : si tout est à 0, on affiche un placeholder à la place
// du chart pour éviter que chart-kit ne génère un visuel vide cassé.
//
export default function VolumeBarChart({ timeline = [], height = 200 }) {
  const { labels, data, hasData } = useMemo(() => {
    const safe = Array.isArray(timeline) ? timeline : [];
    return {
      labels: safe.map((t) => t.label || ''),
      data: safe.map((t) => Math.max(0, Math.round(Number(t.value) || 0))),
      hasData: safe.some((t) => Number(t.value) > 0),
    };
  }, [timeline]);

  // Largeur recalculée avec l'écran (petit Android, iPhone, tablette) :
  // marges de l'écran (20 × 2) + marges de la carte (16 × 2).
  const chartW = useChartWidth(72, 220);

  if (!hasData) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Aucun volume sur la période</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.wrap, { minHeight: height }]}
      accessible
      accessibilityLabel={`Volume soulevé par période : ${labels.map((l, i) => `${l} ${formatAxis(data[i])}`).join(', ')}`}
    >
      <Text style={styles.unit}>kg</Text>
      {(
        <BarChart
          data={{ labels, datasets: [{ data }] }}
          width={chartW}
          height={height}
          fromZero
          showValuesOnTopOfBars={false}
          withInnerLines={false}
          chartConfig={CHART_CONFIG}
          style={styles.chart}
          yAxisLabel=""
          yAxisSuffix=""
        />
      )}
    </View>
  );
}

// Valeur lisible pour les lecteurs d'écran : "850 kg", "6,6 t", "13 t"
function formatAxis(v) {
  const n = Number(v) || 0;
  if (n < 1000) return `${Math.round(n)} kg`;
  const t = n / 1000;
  return `${(t >= 10 ? Math.round(t) : Math.round(t * 10) / 10).toString().replace('.', ',')} t`;
}

const CHART_CONFIG = {
  backgroundGradientFrom: Colors.cardDeep,
  backgroundGradientTo: Colors.cardDeep,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(254, 116, 57, ${opacity})`,
  labelColor: () => Colors.textMuted,
  barPercentage: 0.62,
  fillShadowGradient: Colors.primary,
  fillShadowGradientOpacity: 1,
  propsForBackgroundLines: {
    stroke: '#23232b',
    strokeDasharray: '',
  },
};

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  chart: {
    borderRadius: 12,
  },
  unit: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
