import React, { useMemo } from 'react';
import { View, Text, Dimensions, Platform, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Colors } from '../../constants/theme';

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

  const rawW = Dimensions.get('window').width;
  const screenW = Platform.OS === 'web' ? Math.min(430, rawW) : rawW;
  // Le chart prend la largeur du container parent (en évitant le padding global
  // de l'écran : 20 paddingHorizontal × 2 = 40, plus la card padding 16 × 2 = 32 → -72).
  const chartW = Math.max(220, screenW - 72);

  if (!hasData) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Aucun volume sur la période</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
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
        yAxisSuffix="kg"
      />
    </View>
  );
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
    marginLeft: -10,
    borderRadius: 12,
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
