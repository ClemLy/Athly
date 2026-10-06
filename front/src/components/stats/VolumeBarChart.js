import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { formatWeight } from '../../utils/format';

// ─── VolumeBarChart ───────────────────────────────────────────────────────────
//
// Volume soulevé par jour / semaine / mois (sortie de computePeriodStats).
// Pas d'axe chiffré illisible : on appuie sur une barre et son détail
// s'affiche au-dessus (période, volume, nombre de séances). La barre en cours
// est sélectionnée par défaut.

const CHART_H = 132;
const BAR_GAP = 6;
const DENSE_LABEL_W = 56;

export default function VolumeBarChart({ buckets = [] }) {
  const lastIndex = Math.max(0, buckets.length - 1);
  const [selected, setSelected] = useState(lastIndex);
  const [rowW, setRowW] = useState(0);

  // Nouvelle période → on revient sur la barre la plus récente.
  const bucketKey = buckets.map((b) => b.key).join('|');
  useEffect(() => { setSelected(lastIndex); }, [bucketKey, lastIndex]);

  const max = useMemo(() => Math.max(0, ...buckets.map((b) => b.volume)), [buckets]);

  if (max <= 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="barbell-outline" size={26} color={Colors.textMuted} />
        <Text style={styles.emptyText}>Aucune séance sur cette période</Text>
      </View>
    );
  }

  const sel = buckets[selected] || buckets[lastIndex];
  const dense = buckets.length > 7;

  return (
    <View>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutLabel} numberOfLines={1}>{capitalize(sel.fullLabel)}</Text>
        <Text style={styles.readoutValue}>
          {sel.volume > 0 ? formatWeight(sel.volume) : 'Repos'}
          {sel.sessions > 0 ? (
            <Text style={styles.readoutSessions}>{`  ·  ${sel.sessions} séance${sel.sessions > 1 ? 's' : ''}`}</Text>
          ) : null}
        </Text>
      </View>

      <View style={styles.bars}>
        {buckets.map((b, i) => {
          const active = i === selected;
          const h = b.volume > 0 ? Math.max(6, (b.volume / max) * CHART_H) : 3;
          return (
            <Pressable
              key={b.key}
              onPress={() => setSelected(i)}
              style={styles.col}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${b.fullLabel} : ${b.volume > 0 ? formatWeight(b.volume) : 'aucune séance'}`}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    { height: h },
                    b.volume > 0
                      ? { backgroundColor: active ? Colors.primary : 'rgba(255,255,255,0.16)' }
                      : styles.barEmpty,
                  ]}
                />
              </View>
              {!dense ? (
                <Text style={[styles.xLabel, active && styles.xLabelActive]} numberOfLines={1}>{b.label}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* 12 mois : colonnes trop étroites pour « sept. » → un mois sur trois
          (dont le mois en cours), centré sous sa barre sans être tronqué. */}
      {dense ? (
        <View style={styles.denseLabels} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
          {rowW > 0 && buckets.map((b, i) => {
            if ((buckets.length - 1 - i) % 3 !== 0) return null;
            const colW = (rowW - BAR_GAP * (buckets.length - 1)) / buckets.length;
            const center = i * (colW + BAR_GAP) + colW / 2;
            return (
              <Text
                key={b.key}
                style={[styles.xLabel, styles.denseLabel, { left: center - DENSE_LABEL_W / 2 }, i === selected && styles.xLabelActive]}
                numberOfLines={1}
              >
                {b.label}
              </Text>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const styles = StyleSheet.create({
  readout: { marginBottom: 14 },
  readoutLabel: { color: Colors.textSecondary, fontSize: 13.5 },
  readoutValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  readoutSessions: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP },
  col: { flex: 1, alignItems: 'center' },
  track: {
    height: CHART_H,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  bar: { width: '78%', maxWidth: 34, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barEmpty: { backgroundColor: 'rgba(255,255,255,0.08)' },
  xLabel: { color: Colors.textMuted, fontSize: 11.5, marginTop: 7, fontWeight: '600' },
  denseLabels: { height: 26 },
  denseLabel: { position: 'absolute', top: 0, width: DENSE_LABEL_W, textAlign: 'center' },
  xLabelActive: { color: Colors.textPrimary, fontWeight: '800' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
