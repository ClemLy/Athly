import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import BirthdayConfetti from './BirthdayConfetti';

// Couleurs par rang — miroir de getRank() (stats.service.js) et
// getRankForLevel() (back/utils/levelHelpers.js), indexé par le libellé
// backend puisque cette modale reçoit `rank` en toutes lettres.
const RANK_COLORS = {
  'ATHLY GOD':    '#FFD700',
  'Légende':      '#C084FC',
  'Grand Maître': '#A855F7',
  'Maître':       '#8B5CF6',
  'Élite':        '#6E6AF0',
  'Warrior':      '#6E6AF0',
  'Compétiteur':  '#3B82F6',
  'Athlète':      '#22C55E',
  'Initié':       '#FBBF24',
  'Novice':       '#FE7439',
};

// ─── LevelUpModal ─────────────────────────────────────────────────────────────
// Modale festive globale — déclenchée par LevelUpCelebration.js quel que soit
// la source du gain de niveau (séance, objet d'inventaire, bonus de groupe…).
//
// Props :
//   visible bool
//   level   number
//   rank    string
//   onClose () => void

export default function LevelUpModal({ visible, level, rank, onClose }) {
  const color = RANK_COLORS[rank] || Colors.primary;
  const badgeScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    badgeScale.setValue(0);
    Animated.spring(badgeScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <BirthdayConfetti active={visible} />

        <View style={[styles.card, { borderColor: `${color}55`, shadowColor: color }]}>
          <Animated.View
            style={[styles.badge, {
              backgroundColor: `${color}18`,
              borderColor: `${color}55`,
              transform: [{ scale: badgeScale }],
            }]}
          >
            <Ionicons name="trending-up" size={36} color={color} />
          </Animated.View>

          <Text style={styles.eyebrow}>NIVEAU SUPÉRIEUR</Text>
          <Text style={[styles.level, { color }]}>Niveau {level}</Text>
          <Text style={styles.rank}>{rank}</Text>

          <Text style={styles.body}>
            Continue comme ça : chaque séance, chaque objet, chaque effort compte.
          </Text>

          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: color, shadowColor: color }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeBtnTxt}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 24,
  },
  card: {
    width:           '100%',
    backgroundColor: '#13131C',
    borderRadius:    22,
    borderWidth:     1,
    padding:         28,
    alignItems:      'center',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.45,
    shadowRadius:    32,
    elevation:       20,
  },
  badge: {
    width:          76,
    height:         76,
    borderRadius:   24,
    borderWidth:    1,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   16,
  },
  eyebrow: {
    color:         Colors.textMuted,
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 2,
    marginBottom:  4,
  },
  level: {
    fontSize:      30,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  rank: {
    color:        Colors.textSecondary,
    fontSize:     14,
    fontWeight:   '700',
    marginTop:    4,
    marginBottom: 16,
  },
  body: {
    color:        Colors.textSecondary,
    fontSize:     14,
    lineHeight:   21,
    textAlign:    'center',
    marginBottom: 22,
  },
  closeBtn: {
    width:            '100%',
    height:           50,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  closeBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
