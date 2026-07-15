import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { logWeight } from '../../services/weight.service';

// ─── WeightEntryModal ─────────────────────────────────────────────────────────
// Saisie rapide d'une pesée (Section VI) — modale custom partagée entre
// l'écran Statistiques (bouton "+ Ajouter une pesée") et le rappel
// hebdomadaire (WeightReminderModal → "Entrer mon poids").
//
// Props :
//   visible    bool
//   onClose    () => void
//   onSaved    (weight: number) => void — appelé après enregistrement réussi

export default function WeightEntryModal({ visible, onClose, onSaved }) {
  const [value, setValue]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (visible) { setValue(''); setError(''); setSaving(false); }
  }, [visible]);

  const handleSave = async () => {
    const weight = parseFloat(value.replace(',', '.'));
    if (!value || isNaN(weight) || weight < 20 || weight > 400) {
      setError('Entre un poids valide (20–400 kg).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await logWeight(weight);
      onSaved?.(weight);
      onClose?.();
    } catch (e) {
      setError(e?.data?.message || 'Impossible d\'enregistrer ta pesée.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="scale-outline" size={28} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Entrer mon poids</Text>
          <Text style={styles.body}>Renseigne ta pesée du jour pour garder ton suivi à jour.</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
              autoFocus
            />
            <Text style={styles.unit}>kg</Text>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnTxt}>Enregistrer</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.cancelTxt}>Annuler</Text>
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
    marginBottom:   8,
    textAlign:      'center',
  },
  body: {
    color:        Colors.textSecondary,
    fontSize:     13,
    lineHeight:   19,
    textAlign:    'center',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection:   'row',
    alignItems:      'center',
    width:           '100%',
    borderWidth:     1,
    borderColor:     Colors.borderSubtle,
    borderRadius:    13,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    height:          54,
  },
  input: {
    flex:       1,
    color:      Colors.textPrimary,
    fontSize:   22,
    fontWeight: '800',
  },
  unit: { color: Colors.textMuted, fontSize: 15, fontWeight: '700' },
  error: { color: Colors.error, fontSize: 12, marginTop: 8, alignSelf: 'flex-start' },
  saveBtn: {
    width:            '100%',
    height:           50,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    backgroundColor:  Colors.primary,
    marginTop:        20,
    marginBottom:     10,
    shadowColor:      Colors.primary,
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  cancelBtn:  { width: '100%', height: 44, justifyContent: 'center', alignItems: 'center' },
  cancelTxt:  { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
});
