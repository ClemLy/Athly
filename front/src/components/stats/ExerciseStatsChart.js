import React, { useMemo } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Colors } from '../../constants/theme';

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
  const screenW = Dimensions.get('window').width;
  const chartW = Math.max(220, screenW - 72);

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
        segments={4}
        yAxisSuffix={metric === 'volume' ? '' : 'kg'}
        chartConfig={CHART_CONFIG}
        style={styles.chart}
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
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#0A0A0A',
  },
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
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
});
