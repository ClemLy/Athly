import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── MultiLootModal ────────────────────────────────────────────────────────────
// Popup d'équipe explosive (Section VII) : affichée dès que le dernier membre
// du lobby termine sa séance — le salon passe 'completed', tout le monde se
// déverrouille simultanément et voit le bonus XP Multi appliqué.
//
// Props :
//   visible         bool
//   memberCount     number
//   bonusPercent    number (0..0.50)
//   bonusXp         number — montant XP réellement crédité
//   onClose         () => void

export default function MultiLootModal({ visible, memberCount, bonusPercent, bonusXp, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="trophy" size={34} color={Colors.gold} />
          </View>

          <Text style={styles.eyebrow}>SÉANCE D'ÉQUIPE TERMINÉE</Text>
          <Text style={styles.title}>Butin distribué !</Text>
          <Text style={styles.body}>
            Vous avez terminé cette séance à {memberCount} - l'effort collectif paie.
          </Text>

          <View style={styles.bonusChip}>
            <Ionicons name="flash" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.bonusChipTxt}>
              Bonus Multi +{Math.round(bonusPercent * 100)}% {bonusXp != null ? `(+${bonusXp} XP)` : ''}
            </Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeBtnTxt}>Nickel !</Text>
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
    borderRadius:    24,
    borderWidth:     1,
    borderColor:     'rgba(255,215,0,0.4)',
    padding:         28,
    alignItems:      'center',
    shadowColor:     Colors.gold,
    shadowOffset:    { width: 0, height: 20 },
    shadowOpacity:   0.5,
    shadowRadius:    40,
    elevation:       24,
  },
  iconWrap: {
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  eyebrow: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  body: { color: Colors.textSecondary, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  bonusChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: 13,
    paddingVertical: 12, paddingHorizontal: 18, marginBottom: 22, width: '100%',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  bonusChipTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  closeBtn: {
    width: '100%', height: 50, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  closeBtnTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
});
