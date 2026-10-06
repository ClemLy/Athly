import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useChartWidth } from '../../hooks/useChartWidth';
import { shortDate } from '../../services/periodStats';

// ─── WeightProgressChart ──────────────────────────────────────────────────────
// L'essentiel d'abord, en clair : poids actuel, évolution depuis la première
// pesée et chemin restant jusqu'à l'objectif. La courbe (poids réel + objectif
// en pointillés) vient ensuite pour qui veut le détail.
//
// `history` : Array<{ weight: number, date: string|Date }> — triée
// chronologiquement (voir weight.service.js → getWeightHistory).
// `goal`    : number | null — `poidsCible` du profil utilisateur.

const kg = (n) => `${String(Math.round(Number(n) * 10) / 10).replace('.', ',')} kg`;

export default function WeightProgressChart({ history = [], goal = null, height = 180 }) {
  const chartW = useChartWidth(64, 220);

  const points = useMemo(
    () => (Array.isArray(history) ? history : [])
      .filter((p) => p && Number(p.weight) > 0 && !Number.isNaN(new Date(p.date).getTime()))
      .map((p) => ({ weight: Number(p.weight), date: new Date(p.date) })),
    [history],
  );

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { minHeight: 150 }]}>
        <Ionicons name="scale-outline" size={28} color={Colors.textMuted} style={{ marginBottom: 10 }} />
        <Text style={styles.emptyText}>Aucune pesée enregistrée</Text>
        <Text style={styles.emptyHint}>Ajoute ton poids pour suivre ton évolution.</Text>
      </View>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const change = Math.round((last.weight - first.weight) * 10) / 10;
  const hasGoal = Number(goal) > 0;
  const remaining = hasGoal ? Math.round(Math.abs(last.weight - goal) * 10) / 10 : null;
  const atGoal = hasGoal && remaining < 0.1;
  // Va dans le bon sens si l'écart à l'objectif s'est réduit depuis la 1re pesée.
  const towardGoal = hasGoal && Math.abs(last.weight - goal) < Math.abs(first.weight - goal);
  const progress = hasGoal && first.weight !== goal
    ? Math.min(1, Math.max(0, (first.weight - last.weight) / (first.weight - goal)))
    : atGoal ? 1 : 0;

  const now = new Date();
  const labels = points.map((p, i) => (
    i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2) ? shortDate(p.date) : ''
  ));
  // chart-kit gère mal un seul point : on le duplique.
  const data = points.length === 1 ? [last.weight, last.weight] : points.map((p) => p.weight);
  const lbls = points.length === 1 ? [labels[0], ''] : labels;
  const datasets = [{ data, color: () => Colors.primary, strokeWidth: 3 }];
  if (hasGoal) {
    datasets.push({ data: data.map(() => Number(goal)), color: () => Colors.gold, strokeWidth: 2, strokeDashArray: [6, 5], withDots: false });
  }

  return (
    <View>
      {/* ── Résumé ── */}
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.current}>{kg(last.weight)}</Text>
          <Text style={styles.caption}>Dernière pesée le {shortDate(last.date, now)}</Text>
        </View>
        {points.length > 1 ? (
          <View style={styles.changeBox}>
            <Text style={[styles.change, { color: towardGoal ? Colors.valid : Colors.textPrimary }]}>
              {change > 0 ? '+' : change < 0 ? '−' : ''}{kg(Math.abs(change))}
            </Text>
            <Text style={styles.caption}>depuis le {shortDate(first.date, now)}</Text>
          </View>
        ) : null}
      </View>

      {hasGoal ? (
        <View style={styles.goal}>
          <View style={styles.goalHead}>
            <Ionicons name={atGoal ? 'checkmark-circle' : 'flag-outline'} size={15} color={atGoal ? Colors.valid : Colors.gold} />
            <Text style={styles.goalText}>
              Objectif {kg(goal)}
              <Text style={styles.goalRest}>{atGoal ? '  ·  atteint, bravo !' : `  ·  encore ${kg(remaining)}`}</Text>
            </Text>
          </View>
          <View style={styles.goalTrack}>
            <View style={[styles.goalFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      ) : null}

      {/* ── Courbe ── */}
      {points.length > 1 ? (
        <View style={styles.chartWrap} accessibilityLabel={`Courbe de poids : de ${kg(first.weight)} à ${kg(last.weight)}`}>
          <LineChart
            data={{ labels: lbls, datasets }}
            width={chartW}
            height={height}
            bezier
            withInnerLines={false}
            withOuterLines={false}
            fromZero={false}
            segments={3}
            formatYLabel={(v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',')}
            chartConfig={CHART_CONFIG}
            style={styles.chart}
          />
        </View>
      ) : null}
    </View>
  );
}

const CHART_CONFIG = {
  backgroundGradientFrom: Colors.cardDeep,
  backgroundGradientFromOpacity: 0,
  backgroundGradientTo: Colors.cardDeep,
  backgroundGradientToOpacity: 0,
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(254, 116, 57, ${opacity})`,
  labelColor: () => Colors.textMuted,
  fillShadowGradientOpacity: 0.12,
  propsForDots: { r: '3.5', strokeWidth: '2', stroke: Colors.backgroundDeep },
  propsForLabels: { fontSize: 11 },
};

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  current: { color: Colors.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  caption: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  changeBox: { alignItems: 'flex-end' },
  change: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },

  goal: { marginTop: 16 },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  goalText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  goalRest: { color: Colors.textSecondary, fontWeight: '600' },
  goalTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.gold },

  chartWrap: { marginTop: 14, overflow: 'hidden' },
  chart: { marginLeft: -12 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  emptyText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptyHint: { color: Colors.textMuted, fontSize: 13.5, textAlign: 'center', marginTop: 6 },
});
