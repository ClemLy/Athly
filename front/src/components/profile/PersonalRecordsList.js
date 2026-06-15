import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, MUSCLE_GROUP_COLORS } from '../../constants/theme';

// Liste des records personnels pour les exos majeurs.
// `records` : sortie de stats.service.getPersonalRecords()
//
// Props :
//   - records : Array<{ name, group, icon, prWeight, prEstimate1RM, totalSessions, hasData }>
//   - onPressItem : (record) => void  → navigation vers ExerciseStatsScreen
//
export default function PersonalRecordsList({ records = [], onPressItem }) {
  const hasAny = records.some((r) => r.hasData);

  if (records.length === 0) {
    return null;
  }

  if (!hasAny) {
    return (
      <View style={styles.empty}>
        <Ionicons name="trophy-outline" size={32} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Pas encore de records</Text>
        <Text style={styles.emptyText}>
          Termine une séance avec ces mouvements pour commencer à battre tes records.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {records.map((r, i) => (
        <RecordRow
          key={`pr-${i}-${r.name}`}
          record={r}
          isLast={i === records.length - 1}
          onPress={() => onPressItem && onPressItem(r)}
        />
      ))}
    </View>
  );
}

function RecordRow({ record, isLast, onPress }) {
  const tone = MUSCLE_GROUP_COLORS[record.group] || Colors.secondaryAccent;
  const disabled = !record.hasData;
  return (
    <TouchableOpacity
      style={[styles.row, isLast && styles.rowLast]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.85}
    >
      <View style={[styles.iconBox, { borderColor: tone }]}>
        <Ionicons name={record.icon || 'barbell-outline'} size={18} color={tone} />
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{record.name}</Text>
        <Text style={[styles.group, { color: tone }]} numberOfLines={1}>
          {record.totalSessions > 0 ? `${record.totalSessions} session${record.totalSessions > 1 ? 's' : ''}` : 'Pas encore fait'}
        </Text>
      </View>
      <View style={styles.valueBlock}>
        {record.hasData ? (
          <>
            <Text style={styles.value}>{record.prWeight} kg</Text>
            <Text style={styles.valueSub}>1RM ~{record.prEstimate1RM}</Text>
          </>
        ) : (
          <Text style={styles.valueEmpty}>—</Text>
        )}
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={disabled ? Colors.textMuted : Colors.chevron}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: { flex: 1 },
  name: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  group: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  valueBlock: {
    alignItems: 'flex-end',
    marginRight: 6,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  valueSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  valueEmpty: {
    color: Colors.textMuted,
    fontSize: 22,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 4,
  },
  empty: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
});
