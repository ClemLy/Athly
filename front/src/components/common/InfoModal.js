import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { modalStyles } from './modalStyles';

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
  const accent = destructive ? Colors.destructive : Colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={[modalStyles.card, { borderColor: `${accent}38` }]}>
          <View style={[modalStyles.iconWrap, { backgroundColor: `${accent}1A`, borderColor: `${accent}45` }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>

          <Text style={modalStyles.title}>{title}</Text>
          {body ? <Text style={modalStyles.body}>{body}</Text> : null}

          <TouchableOpacity
            style={[modalStyles.ctaBtn, { backgroundColor: accent, shadowColor: accent }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={modalStyles.ctaTxt}>{closeLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
