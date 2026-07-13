import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import BirthdayConfetti from './BirthdayConfetti';

// ─── BirthdayModal ────────────────────────────────────────────────────────────
// Modale festive violette déclenchée à l'ouverture de l'app le jour de
// l'anniversaire de l'utilisateur (voir BirthdayCelebration.js).
//
// Quand un cadeau vient d'être accordé (rewarded), la modale s'ouvre en mode
// "cadeau emballé" : il faut appuyer pour l'ouvrir avant de voir le détail
// des récompenses (déjà créditées en base côté serveur — voir
// reward.controller.js → checkBirthday — l'ouverture n'est qu'une mise en
// scène, pas une seconde étape d'octroi).
//
// Props :
//   visible        bool
//   pseudo         string | null
//   rewarded       bool — true la première ouverture du jour (cadeau tout juste accordé)
//   chestKeyAdded  bool — +1 CHEST_KEY déjà crédité en base
//   trophyUnlocked bool — au moins un trophée déjà débloqué en base
//   onClose        () => void

export default function BirthdayModal({ visible, pseudo, rewarded, chestKeyAdded, trophyUnlocked, onClose }) {
  const [opened, setOpened] = useState(false);
  const giftScale = useRef(new Animated.Value(1)).current;
  const rewardsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setOpened(false);
      giftScale.setValue(1);
      rewardsOpacity.setValue(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleOpenGift = () => {
    Animated.sequence([
      Animated.spring(giftScale, { toValue: 1.25, friction: 4, useNativeDriver: true }),
      Animated.timing(giftScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setOpened(true);
    Animated.timing(rewardsOpacity, { toValue: 1, duration: 320, delay: 100, useNativeDriver: true }).start();
  };

  const showWrappedGift = rewarded && !opened;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <BirthdayConfetti active={visible && (!rewarded || opened)} />

        <View style={styles.card}>
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: giftScale }] }]}>
            <Ionicons name={showWrappedGift ? 'gift' : 'sparkles'} size={34} color={Colors.rankViolet} />
          </Animated.View>

          <Text style={styles.title}>
            Joyeux Anniversaire{pseudo ? ` ${pseudo}` : ''} !
          </Text>

          {showWrappedGift ? (
            <>
              <Text style={styles.body}>
                Toute l'équipe Athly te souhaite une excellente année. Un cadeau t'attend juste en dessous...
              </Text>
              <TouchableOpacity style={styles.openBtn} onPress={handleOpenGift} activeOpacity={0.85}>
                <Ionicons name="gift-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.openBtnTxt}>Ouvrir mon cadeau</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.body}>
                {rewarded
                  ? "Toute l'équipe Athly te souhaite une excellente année. Tes récompenses sont déjà dans ton inventaire !"
                  : "Toute l'équipe Athly te souhaite une excellente année. Profite bien de ta journée !"}
              </Text>

              {rewarded && (
                <Animated.View style={[styles.rewardRow, { opacity: rewardsOpacity }]}>
                  {chestKeyAdded && (
                    <View style={styles.rewardChip}>
                      <Ionicons name="gift-outline" size={14} color={Colors.rankViolet} />
                      <Text style={styles.rewardChipTxt}>+1 Coffre</Text>
                    </View>
                  )}
                  {trophyUnlocked && (
                    <View style={styles.rewardChip}>
                      <Ionicons name="trophy-outline" size={14} color={Colors.gold} />
                      <Text style={styles.rewardChipTxt}>Trophée débloqué</Text>
                    </View>
                  )}
                </Animated.View>
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.closeBtnTxt}>Merci Athly !</Text>
              </TouchableOpacity>
            </>
          )}
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
    backgroundColor: Colors.bgDeep2,
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
  openBtn: {
    flexDirection:    'row',
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
  openBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
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
