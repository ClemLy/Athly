import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, MUSCLE_GROUP_COLORS } from '../../constants/theme';
import { formatWeight } from '../../utils/format';

// ─── MuscleBalance ────────────────────────────────────────────────────────────
//
// Part du volume par groupe musculaire, en barres horizontales triées : bien
// plus lisible qu'un camembert pour comparer des parts proches. Un conseil
// signale les groupes principaux délaissés sur la période.
//
// Props :
//   muscles   [{ id, label, volume, share }] trié (computePeriodStats)
//   neglected [label]

export default function MuscleBalance({ muscles = [], neglected = [] }) {
  if (muscles.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="body-outline" size={26} color={Colors.textMuted} />
        <Text style={styles.emptyText}>Aucune séance sur cette période</Text>
      </View>
    );
  }

  const top = muscles[0].share || 1;

  return (
    <View>
      <View style={styles.list}>
        {muscles.map((m) => {
          const color = MUSCLE_GROUP_COLORS[m.id] || MUSCLE_GROUP_COLORS.other;
          const pct = Math.round(m.share * 100);
          return (
            <View
              key={m.id}
              style={styles.row}
              accessible
              accessibilityLabel={`${m.label} : ${pct} % du volume, ${formatWeight(m.volume)}`}
            >
              <View style={styles.rowHead}>
                <Text style={styles.name}>{m.label}</Text>
                <Text style={styles.pct}>
                  {pct < 1 ? '< 1' : pct} %
                  <Text style={styles.kg}>{`   ${formatWeight(m.volume)}`}</Text>
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(2, (m.share / top) * 100)}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>

      {neglected.length > 0 ? (
        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={16} color={Colors.gold} style={styles.tipIcon} />
          <Text style={styles.tipText}>
            {neglected.length === 1 ? 'Peu travaillé' : 'Peu travaillés'} sur la période :{' '}
            <Text style={styles.tipStrong}>{neglected.join(', ')}</Text>
            . Pense à les ajouter pour un physique équilibré.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  row: {},
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  pct: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  kg: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },

  tip: {
    flexDirection: 'row',
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.18)',
  },
  tipIcon: { marginTop: 1, marginRight: 9 },
  tipText: { flex: 1, color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  tipStrong: { color: Colors.textPrimary, fontWeight: '700' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
