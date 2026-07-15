import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import BirthdayConfetti from '../profile/BirthdayConfetti';
import { getFriendshipTitle } from '../../data/friendshipTitles';

// Progression de couleur vers le Rouge Sang du niveau 5 ("Lien de Sang") —
// même esprit que RANK_COLORS dans LevelUpModal.js, mais indexé par niveau
// d'amitié (1 à 5) plutôt que par rang de niveau de joueur.
const FRIENDSHIP_LEVEL_COLORS = {
  1: Colors.textSecondary,
  2: '#FF8FA3',
  3: '#FF4D6D',
  4: '#E11D48',
  5: Colors.uniqueBlood,
};

// ─── FriendshipLevelUpModal ───────────────────────────────────────────────────
// Célébration dédiée à la montée de niveau d'amitié — miroir visuel de
// LevelUpModal.js (badge, carte, confettis) mais avec les couleurs et le
// message du lien d'amitié. Niveau 5 = message spécial (récompense Unique).
//
// Props :
//   visible bool
//   pseudo  string  — nom de l'ami concerné
//   level   number  — nouveau niveau d'amitié (1–5)
//   onClose () => void

export default function FriendshipLevelUpModal({ visible, pseudo, level, onClose }) {
  const color = FRIENDSHIP_LEVEL_COLORS[level] || FRIENDSHIP_LEVEL_COLORS[1];
  const isMax = level >= 5;
  const friendshipTitle = getFriendshipTitle(level);
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
            <Ionicons name="heart" size={36} color={color} />
          </Animated.View>

          <Text style={styles.eyebrow}>NIVEAU D'AMITIÉ</Text>
          <Text style={[styles.level, { color }]}>Niveau {level}/5</Text>
          <Text style={[styles.title, { color }]}>{friendshipTitle.label}</Text>
          <Text style={styles.rank}>avec {pseudo}</Text>

          <Text style={styles.body}>
            {isMax
              ? "Niveau d'amitié maximum atteint ! Une récompense UNIQUE t'attend dans ton inventaire."
              : 'Continuez à vous entraîner ensemble pour renforcer ce lien.'}
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
    backgroundColor: Colors.bgDeep2,
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
  title: {
    fontSize:   13,
    fontWeight: '700',
    marginTop:  6,
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
