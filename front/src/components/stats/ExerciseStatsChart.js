import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Colors } from '../../constants/theme';
import { useChartWidth } from '../../hooks/useChartWidth';

// Graphique de progression d'un exercice : poids max par session.
// Stratégie pour les "trous" : on n'utilise PAS la date comme axe X, mais l'index
// de session (1, 2, 3…). Les labels affichent les dates aux extrémités + milieu,
// les autres positions sont vides → ligne continue, pas de compression d'échelle.
//
// `points` : sortie de stats.service.aggregateExercise().points
//   Array<{ date, maxWeight, volume }>
//
// `metric` : 'maxWeight' (par défaut) ou 'volume'
//
function formatDate(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ExerciseStatsChart({ points = [], metric = 'maxWeight', height = 200 }) {
  const chartW = useChartWidth(72, 220);

  const { labels, data, hasData } = useMemo(() => {
    const arr = (Array.isArray(points) ? points : []).filter((p) => p && Number(p[metric]) > 0);
    if (arr.length === 0) {
      return { labels: [], data: [], hasData: false };
    }
    // Étiquettes : on n'affiche QUE 3 dates (premier, milieu, dernier) pour ne pas surcharger.
    const lbls = arr.map((p, i) => {
      if (i === 0 || i === arr.length - 1 || i === Math.floor(arr.length / 2)) {
        return formatDate(p.date);
      }
      return '';
    });
    const values = arr.map((p) => Number(p[metric]) || 0);
    return { labels: lbls, data: values, hasData: true };
  }, [points, metric]);

  if (!hasData) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Aucune session enregistrée pour cet exercice</Text>
        <Text style={styles.emptyHint}>Termine une séance pour voir ton historique apparaître ici.</Text>
      </View>
    );
  }

  // chart-kit gère mal un seul point : on duplique pour éviter un crash visuel.
  const dataset = data.length === 1 ? [data[0], data[0]] : data;
  const lbls = data.length === 1 ? [labels[0] || '', labels[0] || ''] : labels;

  // Graduations rondes : on choisit un nombre de segments qui divise l'écart
  // (30 → 35 kg : 5 segments = 30, 31, 32, 33, 34, 35) au lieu d'arrondir des
  // pas de 1,25 kg (qui affichaient 30, 31, 33, 34, 35).
  const min = Math.min(...dataset);
  const max = Math.max(...dataset);
  const range = Math.round(max - min);
  const segments = range === 0 ? 1 : ([4, 5, 3, 2].find((n) => range % n === 0 && range / n >= 1) || 4);
  const formatY = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    const r = Math.round(n * 10) / 10;
    return metric === 'volume'
      ? Math.round(r).toLocaleString('fr-FR')
      : String(r).replace('.', ',');
  };

  return (
    <View style={styles.wrap}>
      <LineChart
        data={{ labels: lbls, datasets: [{ data: dataset, color: () => Colors.primary, strokeWidth: 3 }] }}
        width={chartW}
        height={height}
        bezier
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLabels
        withHorizontalLabels
        fromZero={false}
        segments={segments}
        formatYLabel={formatY}
        yAxisSuffix={metric === 'volume' ? '' : ' kg'}
        chartConfig={CHART_CONFIG}
        style={styles.chart}
      />
    </View>
  );
}

const CHART_CONFIG = {
  backgroundGradientFrom: Colors.cardDeep,
  backgroundGradientTo: Colors.cardDeep,
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(254, 116, 57, ${opacity})`,
  labelColor: () => Colors.textMuted,
  propsForDots: {
    r: '5',
    strokeWidth: '2.5',
    stroke: Colors.cardDeep,
  },
  fillShadowGradientFrom: Colors.primary,
  fillShadowGradientFromOpacity: 0.28,
  fillShadowGradientTo: Colors.primary,
  fillShadowGradientToOpacity: 0,
  propsForBackgroundLines: {
    stroke: '#23232b',
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
    paddingHorizontal: 16,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHint: {
    color: Colors.textSecondary,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
  },
});
