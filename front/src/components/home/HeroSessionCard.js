import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, MUSCLE_GROUP_COLORS } from '../../constants/theme';

// Carte "hero" affichée sur la page d'accueil pour utilisateur actif.
// Présente la séance recommandée (algorithme : muscle le moins travaillé).
//
// Props :
//   - title : "Séance recommandée" / "Continuer le programme"
//   - templateName : nom de la séance (ex. "Séance Pull")
//   - reason : phrase courte (ex. "Ton dos n'a pas été travaillé depuis 8 jours")
//   - exerciseCount, durationMin
//   - groupId (optionnel) — colore l'accent latéral
//   - onStart : () => void
//
export default function HeroSessionCard({
  title = 'Séance recommandée',
  templateName,
  reason,
  exerciseCount = 0,
  durationMin = 0,
  groupId = null,
  onStart,
}) {
  const tone = groupId && MUSCLE_GROUP_COLORS[groupId] ? MUSCLE_GROUP_COLORS[groupId] : Colors.primary;

  return (
    <View style={styles.card}>
      <View style={[styles.bar, { backgroundColor: tone }]} />
      <View style={styles.body}>
        <Text style={styles.kicker}>{title}</Text>
        <Text style={styles.name} numberOfLines={1}>{templateName || 'Séance'}</Text>
        {reason ? <Text style={styles.reason} numberOfLines={2}>{reason}</Text> : null}

        <View style={styles.metaRow}>
          <Ionicons name="barbell-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.meta}>{exerciseCount} exercices</Text>
          <View style={styles.metaDot} />
          <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.meta}>~{durationMin} min</Text>
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={onStart}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={14} color="#fff" />
          <Text style={styles.ctaText}>Démarrer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.cardDeep,
    borderRadius: 18,
    overflow: 'hidden',
  },
  bar: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: 18,
  },
  kicker: {
    color: Colors.secondaryAccent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  reason: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: 12,
    marginLeft: 4,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
    marginHorizontal: 8,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 16,
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
});
