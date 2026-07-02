import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import BirthdayConfetti from './BirthdayConfetti';

// ─── BirthdayModal ────────────────────────────────────────────────────────────
// Modale festive violette déclenchée à l'ouverture de l'app le jour de
// l'anniversaire de l'utilisateur (voir BirthdayCelebration.js).
//
// Props :
//   visible  bool
//   pseudo   string | null
//   rewarded bool — true la première ouverture du jour (cadeau tout juste accordé)
//   onClose  () => void

export default function BirthdayModal({ visible, pseudo, rewarded, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <BirthdayConfetti active={visible} />

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconEmoji}>🎂</Text>
          </View>

          <Text style={styles.title}>
            Joyeux Anniversaire{pseudo ? ` ${pseudo}` : ''} ! 🎉
          </Text>

          <Text style={styles.body}>
            {rewarded
              ? "Toute l'équipe Athly te souhaite une excellente année. Ton coffre et ton trophée t'attendent dans ton inventaire !"
              : "Toute l'équipe Athly te souhaite une excellente année. Profite bien de ta journée !"}
          </Text>

          {rewarded && (
            <View style={styles.rewardRow}>
              <View style={styles.rewardChip}>
                <Ionicons name="gift-outline" size={14} color={Colors.rankViolet} />
                <Text style={styles.rewardChipTxt}>+1 Coffre</Text>
              </View>
              <View style={styles.rewardChip}>
                <Ionicons name="trophy-outline" size={14} color={Colors.gold} />
                <Text style={styles.rewardChipTxt}>Trophée débloqué</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeBtnTxt}>Merci Athly !</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 24,
  },
  card: {
    width:           '100%',
    backgroundColor: '#13131C',
    borderRadius:    22,
    borderWidth:     1,
    borderColor:     'rgba(139,92,246,0.35)',
    padding:         28,
    alignItems:      'center',
    shadowColor:     Colors.rankViolet,
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.45,
    shadowRadius:    32,
    elevation:       20,
  },
  iconWrap: {
    width:            72,
    height:           72,
    borderRadius:     24,
    backgroundColor:  'rgba(139,92,246,0.14)',
    borderWidth:      1,
    borderColor:      'rgba(139,92,246,0.35)',
    justifyContent:   'center',
    alignItems:       'center',
    marginBottom:     18,
  },
  iconEmoji: { fontSize: 34 },
  title: {
    color:          Colors.textPrimary,
    fontSize:       19,
    fontWeight:     '800',
    letterSpacing:  -0.3,
    marginBottom:   12,
    textAlign:      'center',
  },
  body: {
    color:      Colors.textSecondary,
    fontSize:   14,
    lineHeight: 21,
    textAlign:  'center',
    marginBottom: 20,
  },
  rewardRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  22,
  },
  rewardChip: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              5,
    paddingHorizontal: 10,
    paddingVertical:  6,
    borderRadius:     10,
    backgroundColor:  'rgba(255,255,255,0.05)',
    borderWidth:      1,
    borderColor:      'rgba(255,255,255,0.09)',
  },
  rewardChipTxt: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  closeBtn: {
    width:            '100%',
    height:           50,
    borderRadius:     13,
    backgroundColor:  Colors.rankViolet,
    justifyContent:   'center',
    alignItems:       'center',
    shadowColor:      Colors.rankViolet,
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  closeBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
