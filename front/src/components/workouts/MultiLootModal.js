import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── MultiLootModal ────────────────────────────────────────────────────────────
// Récompense d'équipe : affichée quand le dernier membre du salon termine.
// Le chiffre qui compte (l'XP bonus réellement gagnée) est mis en avant.
//
// Props :
//   visible       bool
//   memberCount   number
//   bonusPercent  number (0..0.50)
//   bonusXp       number — XP réellement créditée
//   onClose       () => void

export default function MultiLootModal({ visible, memberCount, bonusPercent, bonusXp, onClose }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.85);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="people" size={30} color={Colors.gold} />
          </View>
          <Text style={styles.title} accessibilityRole="header">Séance d'équipe terminée</Text>
          <Text style={styles.body}>Vous avez terminé à {memberCount}. L'effort collectif paie !</Text>

          <View style={styles.bonusBox}>
            <Text style={styles.bonusValue}>+{bonusXp ?? 0} XP</Text>
            <Text style={styles.bonusLabel}>Bonus d'équipe (+{Math.round((bonusPercent || 0) * 100)} %)</Text>
          </View>

          <TouchableOpacity accessibilityRole="button" style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeBtnTxt}>Continuer</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(5,6,10,0.9)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: Colors.cardDeep, borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', padding: 24, alignItems: 'center',
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,215,0,0.12)', marginBottom: 14,
  },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  body: { color: Colors.textSecondary, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  bonusBox: {
    alignSelf: 'stretch', alignItems: 'center', marginTop: 18, paddingVertical: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,215,0,0.07)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.22)',
  },
  bonusValue: { color: Colors.gold, fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'] },
  bonusLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 2 },
  closeBtn: {
    alignSelf: 'stretch', height: 52, borderRadius: 15, marginTop: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary,
  },
  closeBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
