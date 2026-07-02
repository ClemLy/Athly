import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
// Modale de confirmation stylisée (fond sombre, carte, boutons) à utiliser à la
// place d'Alert.alert dès qu'une action mérite un rendu cohérent avec le reste
// de l'app plutôt que la boîte de dialogue système.
//
// Props :
//   visible       bool
//   icon          string   — nom Ionicons affiché dans le badge
//   title         string
//   body          string
//   confirmLabel  string
//   cancelLabel   string   (défaut "Annuler")
//   destructive   bool     — accent rouge si true, orange sinon
//   onConfirm     () => void
//   onCancel      () => void

export default function ConfirmModal({
  visible, icon = 'alert-circle-outline', title, body,
  confirmLabel, cancelLabel = 'Annuler', destructive = false,
  onConfirm, onCancel,
}) {
  const accent = destructive ? '#EF4444' : Colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { borderColor: `${accent}38` }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}1A`, borderColor: `${accent}45` }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>

          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: accent, shadowColor: accent }]}
            onPress={onConfirm}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmTxt}>{confirmLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
            <Text style={styles.cancelTxt}>{cancelLabel}</Text>
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
  confirmBtn: {
    width:            '100%',
    height:           50,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    marginBottom:     10,
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  confirmTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  cancelBtn:  { width: '100%', height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cancelTxt:  { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
});
