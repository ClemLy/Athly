import React, { useMemo } from 'react';
import { View, Text, Dimensions, Platform, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { Colors, MUSCLE_GROUP_COLORS } from '../../constants/theme';
import { findMuscleGroup } from '../../constants/exerciseFilters';

// Pie chart de la distribution musculaire (volume par groupe).
// `distribution` : objet { groupId: kg }
//
export default function MuscleDistributionPieChart({ distribution = {}, height = 180 }) {
  const data = useMemo(() => {
    const entries = Object.entries(distribution || {});
    return entries
      .filter(([, v]) => Number(v) > 0)
      .map(([groupId, volume]) => {
        const group = findMuscleGroup(groupId);
        const color = MUSCLE_GROUP_COLORS[groupId] || MUSCLE_GROUP_COLORS.other;
        return {
          name: group ? group.label : 'Autre',
          population: Math.max(1, Math.round(Number(volume))),
          color,
          legendFontColor: Colors.textPrimary,
          legendFontSize: 12,
        };
      });
  }, [distribution]);

  const rawW = Dimensions.get('window').width;
  const screenW = Platform.OS === 'web' ? Math.min(430, rawW) : rawW;
  const chartW = Math.max(200, screenW - 104);

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Aucune répartition pour la période</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: chartW, overflow: 'hidden' }]}>
      <PieChart
        data={data}
        width={chartW}
        height={height}
        chartConfig={CHART_CONFIG}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="10"
        absolute={false}
        hasLegend
      />
    </View>
  );
}

const CHART_CONFIG = {
  color: () => Colors.textPrimary,
  labelColor: () => Colors.textPrimary,
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
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
