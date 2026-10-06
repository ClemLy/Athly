import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, MUSCLE_GROUP_COLORS } from '../../constants/theme';
import { findMuscleGroup } from '../../constants/exerciseFilters';
import { plural } from '../../utils/format';

// Carte "hero" de l'accueil : la séance recommandée (groupe le moins travaillé),
// prête à lancer en un geste, avec une sortie vers les autres séances.
//
// Props :
//   - title : petit sur-titre
//   - templateName : nom de la séance (ex. "Séance Pull")
//   - reason : pourquoi cette séance, en une phrase
//   - exerciseCount, durationMin
//   - groupId (optionnel) : teinte la carte
//   - onStart : () => void
//   - onBrowse : () => void (optionnel) : « Autre séance »
//
export default function HeroSessionCard({
  title = 'Recommandée pour toi',
  templateName,
  reason,
  exerciseCount = 0,
  durationMin = 0,
  groupId = null,
  onStart,
  onBrowse,
}) {
  const tone = groupId && MUSCLE_GROUP_COLORS[groupId] ? MUSCLE_GROUP_COLORS[groupId] : Colors.primary;
  const groupLabel = groupId ? (findMuscleGroup(groupId) || {}).label : null;
  const narrow = useWindowDimensions().width < 360;

  return (
    <View style={[styles.card, { borderColor: `${tone}40` }]}>
      <View style={[styles.glow, { backgroundColor: tone }]} pointerEvents="none" />
      <View style={styles.watermark} pointerEvents="none">
        <Ionicons name="barbell" size={132} color={tone} />
      </View>

      <View style={styles.kickerRow}>
        <View style={[styles.kickerDot, { backgroundColor: tone }]} />
        <Text style={styles.kicker}>{title}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1} accessibilityRole="header">{templateName || 'Séance'}</Text>
      {reason ? <Text style={styles.reason} numberOfLines={3}>{reason}</Text> : null}

      <View style={styles.metaRow}>
        {groupLabel ? (
          <View style={[styles.pill, { backgroundColor: `${tone}22` }]}>
            <Text style={[styles.pillText, { color: tone }]}>{groupLabel}</Text>
          </View>
        ) : null}
        <View style={styles.pill}>
          <Ionicons name="barbell-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.pillText}>{plural(exerciseCount, 'exercice')}</Text>
        </View>
        <View style={styles.pill}>
          <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.pillText}>~{durationMin} min</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Démarrer ${templateName || 'la séance'}`}
          style={styles.cta}
          onPress={onStart}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={16} color="#fff" />
          <Text style={styles.ctaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>Démarrer</Text>
        </TouchableOpacity>
        {onBrowse ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Choisir une autre séance"
            style={[styles.secondary, narrow && styles.secondaryNarrow]}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={onBrowse}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal" size={16} color={Colors.textPrimary} />
            <Text style={styles.secondaryText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {narrow ? 'Autre' : 'Autre séance'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.10,
  },
  watermark: {
    position: 'absolute',
    top: -14,
    right: -18,
    opacity: 0.07,
    transform: [{ rotate: '-24deg' }],
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  kickerDot: { width: 7, height: 7, borderRadius: 3.5 },
  kicker: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  name: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  reason: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cta: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 15,
    backgroundColor: Colors.primary,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondary: {
    flexShrink: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryNarrow: { paddingHorizontal: 14 },
  secondaryText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
});
