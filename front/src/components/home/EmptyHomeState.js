import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// État "compte vierge" : encourage l'utilisateur à démarrer sa première séance.
//
// Props :
//   - onStart : () => void  — CTA principal (ouvre la liste/builder)
//   - onBrowseTemplates : () => void  — lien secondaire (templates)
//
const FEATURES = [
  { icon: 'flash', label: 'XP & Niveau', desc: 'Cumule tes points et progresse' },
  { icon: 'trophy', label: 'Records perso', desc: 'Bats tes PRs et suis ta force' },
  { icon: 'stats-chart', label: 'Stats détaillées', desc: 'Volume, répartition, courbes' },
];

export default function EmptyHomeState({ onStart, onBrowseTemplates }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.iconHalo}>
          <Ionicons name="barbell" size={48} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Prêt à démarrer ?</Text>
        <Text style={styles.subtitle}>
          Lance ta première séance pour débloquer ton tableau de bord.
        </Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={onStart}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={16} color="#fff" />
          <Text style={styles.ctaText}>Démarrer ma première séance</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.featuresBlock}>
        <Text style={styles.featuresTitle}>Tu vas débloquer</Text>
        {FEATURES.map((f, i) => (
          <View key={`f-${i}`} style={[styles.featureRow, i === FEATURES.length - 1 && styles.featureRowLast]}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={18} color={Colors.secondaryAccent} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {onBrowseTemplates ? (
        <TouchableOpacity
          style={styles.secondaryLink}
          onPress={onBrowseTemplates}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryLinkText}>Voir les templates de séance</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},

  hero: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  iconHalo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(254, 116, 57, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(254, 116, 57, 0.25)',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    lineHeight: 19,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 26,
    marginTop: 22,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },

  featuresBlock: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  featuresTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  featureRowLast: {
    borderBottomWidth: 0,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(110, 106, 240, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  featureDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  secondaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  secondaryLinkText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
});
