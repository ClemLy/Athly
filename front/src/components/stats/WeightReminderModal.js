import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── WeightReminderModal ──────────────────────────────────────────────────────
// Rappel hebdomadaire de pesée (Section VI) : déclenché au lancement de l'app
// si aucune pesée n'a été enregistrée depuis plus de 7 jours (voir
// WeightReminderCheck.js, monté une fois dans navigation/index.js).
//
// Modale custom (jamais Alert.alert), cohérente avec ConfirmModal.js.
//
// Props :
//   visible     bool
//   onEnter     () => void — "Entrer mon poids" → ouvre WeightEntryModal
//   onLater     () => void — "Plus tard" → ferme sans pénalité, ne re-sollicite
//                             pas avant la semaine suivante (géré par l'appelant)

export default function WeightReminderModal({ visible, onEnter, onLater }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="trending-down" size={28} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Petit rappel poids</Text>
          <Text style={styles.body}>
            Tiens, tu n'as pas encore entré ton poids cette semaine ! Rentre-le pour garder un suivi au top.
          </Text>

          <TouchableOpacity style={styles.enterBtn} onPress={onEnter} activeOpacity={0.85}>
            <Ionicons name="scale-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.enterBtnTxt}>Entrer mon poids</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.laterBtn} onPress={onLater} activeOpacity={0.75}>
            <Text style={styles.laterTxt}>Plus tard</Text>
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
    backgroundColor: Colors.bgDeep2,
    borderRadius:    22,
    borderWidth:     1,
    borderColor:     `${Colors.primary}38`,
    padding:         28,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.65,
    shadowRadius:    32,
    elevation:       20,
  },
  iconWrap: {
    width:            60,
    height:           60,
    borderRadius:     18,
    backgroundColor:  `${Colors.primary}1A`,
    borderWidth:      1,
    borderColor:      `${Colors.primary}45`,
    justifyContent:   'center',
    alignItems:       'center',
    marginBottom:     18,
  },
  title: {
    color:          Colors.textPrimary,
    fontSize:       18,
    fontWeight:     '800',
    letterSpacing:  -0.3,
    marginBottom:   10,
    textAlign:      'center',
  },
  body: {
    color:        Colors.textSecondary,
    fontSize:     14,
    lineHeight:   21,
    textAlign:    'center',
    marginBottom: 24,
  },
  enterBtn: {
    flexDirection:    'row',
    width:            '100%',
    height:           50,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    backgroundColor:  Colors.primary,
    marginBottom:     10,
    shadowColor:      Colors.primary,
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  enterBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  laterBtn:  { width: '100%', height: 44, justifyContent: 'center', alignItems: 'center' },
  laterTxt:  { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
});
