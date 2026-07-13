import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { modalStyles } from './modalStyles';

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
  const accent = destructive ? Colors.destructive : Colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={modalStyles.backdrop}>
        <View style={[modalStyles.card, { borderColor: `${accent}38` }]}>
          <View style={[modalStyles.iconWrap, { backgroundColor: `${accent}1A`, borderColor: `${accent}45` }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>

          <Text style={modalStyles.title}>{title}</Text>
          {body ? <Text style={modalStyles.body}>{body}</Text> : null}

          <TouchableOpacity
            style={[modalStyles.ctaBtn, styles.confirmSpacing, { backgroundColor: accent, shadowColor: accent }]}
            onPress={onConfirm}
            activeOpacity={0.85}
          >
            <Text style={modalStyles.ctaTxt}>{confirmLabel}</Text>
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
  confirmSpacing: { marginBottom: 10 },
  cancelBtn:  { width: '100%', height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cancelTxt:  { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
});
