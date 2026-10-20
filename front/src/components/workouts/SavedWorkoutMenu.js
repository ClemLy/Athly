import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { haptics } from '../../services';
import { plural } from '../../utils/format';

// ─── Menu d'une séance enregistrée ────────────────────────────────────────────
// Feuille du bas avec des actions claires (icône, titre, courte explication) :
// Lancer, Modifier, Dupliquer, puis Supprimer à part, en rouge.
//
// Props : saved ({ name, exercises }) | null (fermé), onClose,
//   onLaunch, onEdit, onDuplicate, onDelete  (chacun reçoit la séance)

function Action({ icon, label, hint, onPress, danger }) {
  const color = danger ? Colors.error : Colors.primary;
  return (
    <Pressable
      onPress={() => { haptics.selection(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <View style={[styles.actionIcon, { backgroundColor: danger ? 'rgba(239,68,68,0.12)' : 'rgba(254,116,57,0.12)' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.actionLabel, danger && { color: Colors.error }]}>{label}</Text>
        {hint ? <Text style={styles.actionHint} numberOfLines={2}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function SavedWorkoutMenu({ saved, onClose, onLaunch, onEdit, onDuplicate, onDelete }) {
  const insets = useSafeAreaInsets();
  const count = Array.isArray(saved?.exercises) ? saved.exercises.length : 0;
  // Chaque action ferme d'abord la feuille, puis agit.
  const run = (fn) => () => { onClose(); fn?.(saved); };

  return (
    <Modal visible={!!saved} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: Math.max(14, insets.bottom + 10) }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={styles.headIcon}><Ionicons name="bookmark" size={20} color={Colors.primary} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{saved?.name}</Text>
              <Text style={styles.sub}>{plural(count, 'exercice')}</Text>
            </View>
          </View>

          <Action icon="play" label="Lancer la séance" hint="Voir le détail puis commencer" onPress={run(onLaunch)} />
          <Action icon="create-outline" label="Modifier" hint="Exercices, séries, échauffement, nom" onPress={run(onEdit)} />
          <Action icon="copy-outline" label="Dupliquer" hint="Crée une copie que tu peux changer sans toucher à l’original" onPress={run(onDuplicate)} />
          <View style={styles.sep} />
          <Action icon="trash-outline" label="Supprimer" hint="Définitif, tu ne pourras pas la récupérer" danger onPress={run(onDelete)} />

          <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: {
    width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: Colors.bgDeep2,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)', paddingTop: 8, paddingHorizontal: 12,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingBottom: 12 },
  headIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(254,116,57,0.12)' },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 14 },
  actionPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: '700' },
  actionHint: { color: Colors.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 6, marginHorizontal: 8 },
  cancel: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  cancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
});
