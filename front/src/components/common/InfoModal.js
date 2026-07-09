import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── InfoModal ────────────────────────────────────────────────────────────────
// Alerte à un seul bouton (information, erreur, validation simple) — remplace
// Alert.alert(title, message) / Alert.alert(title, message, [{text:'OK'}])
// par une modale graphique cohérente avec le reste de l'app.
//
// Props :
//   visible      bool
//   icon         string   — nom Ionicons affiché dans le badge
//   title        string
//   body         string
//   closeLabel   string   (défaut "OK")
//   destructive  bool     — accent rouge si true (erreurs), orange sinon
//   onClose      () => void

export default function InfoModal({
  visible, icon = 'information-circle-outline', title, body,
  closeLabel = 'OK', destructive = false, onClose,
}) {
  const accent = destructive ? '#EF4444' : Colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { borderColor: `${accent}38` }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}1A`, borderColor: `${accent}45` }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>

          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}

          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: accent, shadowColor: accent }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeTxt}>{closeLabel}</Text>
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
    borderWidth:      1,
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
  closeTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
