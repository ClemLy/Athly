import React, { useMemo } from 'react';
import { View, Text, Dimensions, Platform, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── WeightProgressChart ──────────────────────────────────────────────────────
// Double courbe (Section VI) : poids réel (ligne pleine) + objectif (ligne
// horizontale en pointillés, si `goal` est renseigné), avec un indicateur du
// delta restant.
//
// `history` : Array<{ weight: number, date: string|Date }> — triée
// chronologiquement (voir weight.service.js → getWeightHistory).
// `goal`    : number | null — `poidsCible` du profil utilisateur.

function formatDate(d) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export default function WeightProgressChart({ history = [], goal = null, height = 200 }) {
  const rawW = Dimensions.get('window').width;
  const screenW = Platform.OS === 'web' ? Math.min(430, rawW) : rawW;
  const chartW = Math.max(220, screenW - 72);

  const { labels, weights, hasData, currentWeight } = useMemo(() => {
    const arr = (Array.isArray(history) ? history : []).filter((p) => p && Number(p.weight) > 0);
    if (arr.length === 0) return { labels: [], weights: [], hasData: false, currentWeight: null };

    const lbls = arr.map((p, i) => {
      if (i === 0 || i === arr.length - 1 || i === Math.floor(arr.length / 2)) return formatDate(p.date);
      return '';
    });
    const values = arr.map((p) => Number(p.weight));
    return { labels: lbls, weights: values, hasData: true, currentWeight: values[values.length - 1] };
  }, [history]);

  if (!hasData) {
    return (
      <View style={[styles.empty, { minHeight: height }]}>
        <Ionicons name="scale-outline" size={30} color={Colors.textMuted} style={{ marginBottom: 10 }} />
        <Text style={styles.emptyText}>Aucune pesée enregistrée</Text>
        <Text style={styles.emptyHint}>Ajoute ton poids pour voir ta courbe apparaître ici.</Text>
      </View>
    );
  }

  // chart-kit gère mal un seul point : on duplique pour éviter un crash visuel.
  const weightData = weights.length === 1 ? [weights[0], weights[0]] : weights;
  const lbls = weights.length === 1 ? [labels[0] || '', labels[0] || ''] : labels;

  const datasets = [{ data: weightData, color: () => Colors.primary, strokeWidth: 3 }];
  if (goal) {
    datasets.push({
      data: weightData.map(() => goal),
      color: () => Colors.gold,
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      withDots: false,
    });
  }

  const delta = goal ? currentWeight - goal : null;
  const atGoal = delta !== null && Math.abs(delta) < 0.1;

  return (
    <View style={styles.wrap}>
      <LineChart
        data={{ labels: lbls, datasets }}
        width={chartW}
        height={height}
        bezier
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLabels
        withHorizontalLabels
        fromZero={false}
        segments={4}
        yAxisSuffix="kg"
        chartConfig={CHART_CONFIG}
        style={styles.chart}
      />

      {goal != null && (
        <View style={styles.deltaRow}>
          <Ionicons name={atGoal ? 'checkmark-circle' : 'flag'} size={15} color={atGoal ? Colors.success : Colors.gold} />
          <Text style={styles.deltaTxt}>
            {atGoal
              ? 'Objectif de poids atteint !'
              : `Plus que ${Math.abs(delta).toFixed(1)} kg avant ton objectif !`}
          </Text>
        </View>
      )}
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
    r: '4',
    strokeWidth: '2',
    stroke: '#0A0A0A',
  },
  propsForBackgroundLines: {
    stroke: '#23232b',
  },
};

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  chart: { marginLeft: -10, borderRadius: 12 },
  deltaRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             7,
    marginTop:       12,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.25)',
    borderRadius:    12,
    paddingVertical: 10,
  },
  deltaTxt: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
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
