import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// Carte PR + suggestion de progression pour un exercice.
// Props : prWeight, prVolume, prEstimate1RM, suggestedNext (objet { weight, reason, delta })
export default function PRCard({ prWeight = 0, prVolume = 0, prEstimate1RM = 0, suggestedNext = null, totalSessions = 0 }) {
  const hasData = totalSessions > 0;
  const suggestedReason = suggestedNext && suggestedNext.reason;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Records personnels</Text>
      <View style={styles.statsGrid}>
        <Stat icon="trophy" label="Poids max" value={hasData ? `${prWeight} kg` : '—'} />
        <Stat icon="barbell" label="Volume max" value={hasData ? `${Math.round(prVolume)} kg` : '—'} />
        <Stat icon="rocket" label="1RM estimé" value={hasData ? `${prEstimate1RM} kg` : '—'} />
      </View>

      <View style={styles.divider} />

      <View style={styles.suggestRow}>
        <View style={styles.suggestIcon}>
          <Ionicons name="trending-up" size={20} color={Colors.primary} />
        </View>
        <View style={styles.suggestContent}>
          <Text style={styles.suggestLabel}>Prochaine séance</Text>
          {suggestedNext ? (
            suggestedReason === 'progress' ? (
              <Text style={styles.suggestText}>
                <Text style={styles.suggestStrong}>{suggestedNext.weight} kg</Text>
                <Text style={styles.suggestDelta}>{`  +${suggestedNext.delta} kg`}</Text>
              </Text>
            ) : (
              <Text style={styles.suggestText}>
                <Text style={styles.suggestStrong}>{suggestedNext.weight} kg</Text>
                <Text style={styles.suggestHint}>  · consolide</Text>
              </Text>
            )
          ) : (
            <Text style={styles.suggestHintAlone}>
              {hasData ? 'Pas assez de données' : 'Aucune session enregistrée'}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function Stat({ icon, label, value }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    padding: 16,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 6,
    marginBottom: 2,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#23232b',
    marginVertical: 14,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(254, 116, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestContent: { flex: 1 },
  suggestLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  suggestText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 3,
  },
  suggestStrong: {
    color: Colors.textPrimary,
  },
  suggestDelta: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  suggestHint: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  suggestHintAlone: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
});
