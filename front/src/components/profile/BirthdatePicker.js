import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function daysInMonth(month, year) {
  return new Date(year ?? 2024, month + 1, 0).getDate();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// ─── BirthdatePicker ──────────────────────────────────────────────────────────
// Sélecteur de date de naissance en 3 rangées de puces scrollables (jour / mois
// / année). Aucune dépendance native → identique sur mobile et Web/PWA.
//
// Anti-triche : une fois `value` renseigné, le champ est verrouillé (lecture
// seule) — la modification se fait exclusivement côté backend (setBirthdate),
// qui refuse toute écriture si isBirthdateSet est déjà true.
//
// Props :
//   value      Date | null — date déjà enregistrée en base (verrouille le champ)
//   onConfirm  (Date) => Promise<void> — appelé après la confirmation finale ;
//              doit re-throw en cas d'échec pour garder la modale ouverte.

export default function BirthdatePicker({ value, onConfirm }) {
  const locked = !!value;
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep]   = useState('pick'); // 'pick' | 'confirm'
  const [day, setDay]     = useState(null);
  const [month, setMonth] = useState(null); // 0-11
  const [year, setYear]   = useState(null);
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 101 }, (_, i) => currentYear - i),
    [currentYear],
  );
  const maxDay = daysInMonth(month ?? 0, year);
  const days   = useMemo(() => Array.from({ length: maxDay }, (_, i) => i + 1), [maxDay]);

  const canContinue = day != null && month != null && year != null;

  const openPicker = () => {
    if (locked) return;
    setDay(null);
    setMonth(null);
    setYear(null);
    setStep('pick');
    setModalOpen(true);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    setDay((d) => Math.min(d, daysInMonth(month, year)));
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const clampedDay = Math.min(day, daysInMonth(month, year));
      const dateObj = new Date(Date.UTC(year, month, clampedDay));
      await onConfirm(dateObj);
      setModalOpen(false);
    } catch (_) {
      // La modale reste ouverte (étape confirmation) pour permettre un nouvel essai.
      // L'erreur est déjà affichée par l'appelant (toast).
    } finally {
      setSaving(false);
    }
  };

  const formattedValue = value
    ? `${pad2(value.getUTCDate())}/${pad2(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`
    : null;
  const formattedPending = canContinue ? `${pad2(day)}/${pad2(month + 1)}/${year}` : '-';

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={openPicker}
        activeOpacity={locked ? 1 : 0.7}
        disabled={locked}
      >
        {locked && (
          <Ionicons name="lock-closed" size={13} color={Colors.textMuted} style={{ marginRight: 6 }} />
        )}
        <Text style={[styles.triggerTxt, locked && styles.triggerTxtLocked]}>
          {formattedValue || 'Choisir une date'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !saving && setModalOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {step === 'pick' ? (
              <>
                <Text style={styles.title}>Date de naissance</Text>
                <Text style={styles.subtitle}>
                  Cette date ne pourra plus être modifiée après validation.
                </Text>

                <ChipScroll label="Jour"  items={days}                       selected={day}   onSelect={setDay}   format={(d) => String(d)} />
                <ChipScroll label="Mois"  items={MONTHS.map((_, i) => i)}    selected={month} onSelect={setMonth} format={(i) => MONTHS[i]} />
                <ChipScroll label="Année" items={years}                      selected={year}  onSelect={setYear}  format={(y) => String(y)} />

                <TouchableOpacity
                  style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
                  onPress={handleContinue}
                  disabled={!canContinue}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnTxt}>Continuer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setModalOpen(false)} activeOpacity={0.75}>
                  <Text style={styles.secondaryBtnTxt}>Annuler</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.warnIconWrap}>
                  <Ionicons name="alert-circle-outline" size={28} color={Colors.warningAmber} />
                </View>
                <Text style={styles.title}>Confirmer ta date de naissance</Text>
                <Text style={styles.confirmDate}>{formattedPending}</Text>
                <Text style={styles.subtitle}>
                  Attention, cette date ne pourra plus être modifiée par la suite. Vérifie-la avant de valider.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnTxt}>{saving ? 'Enregistrement…' : 'Valider définitivement'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('pick')} disabled={saving} activeOpacity={0.75}>
                  <Text style={styles.secondaryBtnTxt}>Modifier</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function ChipScroll({ label, items, selected, onSelect, format }) {
  return (
    <View style={styles.chipScrollWrap}>
      <Text style={styles.chipScrollLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollContent}>
        {items.map((item) => {
          const isSel = selected === item;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, isSel && styles.chipSel]}
              onPress={() => onSelect(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipTxt, isSel && styles.chipTxtSel]}>{format(item)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Trigger (dans une SettingsRow) ───────────────────────────────────────────
  trigger:         { flexDirection: 'row', alignItems: 'center' },
  triggerTxt:      { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' },
  triggerTxtLocked:{ color: Colors.textMuted },

  // ── Modal ─────────────────────────────────────────────────────────────────────
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 20,
  },
  card: {
    width:           '100%',
    backgroundColor: '#13131C',
    borderRadius:    22,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.09)',
    padding:         24,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.65,
    shadowRadius:    32,
    elevation:       20,
  },
  title: {
    color:         Colors.textPrimary,
    fontSize:      17,
    fontWeight:    '800',
    letterSpacing: -0.2,
    marginBottom:  8,
    textAlign:     'center',
  },
  subtitle: {
    color:        Colors.textSecondary,
    fontSize:     12.5,
    lineHeight:   18,
    textAlign:    'center',
    marginBottom: 18,
  },
  confirmDate: {
    color:        Colors.primary,
    fontSize:     26,
    fontWeight:   '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  warnIconWrap: {
    width:           56,
    height:           56,
    borderRadius:     18,
    backgroundColor:  'rgba(245,158,11,0.10)',
    borderWidth:      1,
    borderColor:      'rgba(245,158,11,0.28)',
    justifyContent:   'center',
    alignItems:       'center',
    marginBottom:     14,
  },

  // ── Chip scrollers ───────────────────────────────────────────────────────────
  chipScrollWrap:    { width: '100%', marginBottom: 14 },
  chipScrollLabel:   { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  chipScrollContent: { gap: 6, paddingRight: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      9,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.09)',
    backgroundColor:   'rgba(255,255,255,0.04)',
  },
  chipSel:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt:    { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTxtSel: { color: '#fff' },

  // ── Boutons ───────────────────────────────────────────────────────────────────
  primaryBtn: {
    width:            '100%',
    height:           50,
    borderRadius:     13,
    backgroundColor:  Colors.primary,
    justifyContent:   'center',
    alignItems:       'center',
    marginTop:        4,
    marginBottom:     10,
    shadowColor:      Colors.primary,
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.35,
    shadowRadius:     12,
    elevation:        6,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnTxt:       { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  secondaryBtn:        { width: '100%', height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnTxt:     { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
});
