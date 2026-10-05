import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── Règles de mot de passe (miroir de back/validators/auth.validator.js) ─────
const HAS_LETTER = /[A-Za-zÀ-ÿ]/;
const HAS_DIGIT  = /[0-9]/;
const HAS_UPPER  = /[A-Z]/;
const HAS_SYMBOL = /[^A-Za-zÀ-ÿ0-9]/;
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_RULES = [
  { id: 'length', label: '8 caractères minimum', test: (p) => p.length >= MIN_PASSWORD_LENGTH },
  { id: 'letter', label: 'Une lettre',           test: (p) => HAS_LETTER.test(p) },
  { id: 'digit',  label: 'Un chiffre',           test: (p) => HAS_DIGIT.test(p) },
];

export const PASSWORD_RULES_MESSAGE =
  'Ton mot de passe doit faire 8 caractères minimum, avec au moins une lettre et un chiffre.';

export const isPasswordValid = (pwd) => PASSWORD_RULES.every((r) => r.test(pwd));

// Force indicative (0 à 3), au-delà des règles minimales
function getStrength(pwd) {
  if (!pwd) return 0;
  if (!isPasswordValid(pwd)) return 1;
  return pwd.length >= 12 || (HAS_UPPER.test(pwd) && HAS_SYMBOL.test(pwd)) ? 3 : 2;
}

// Barre de robustesse + liste des règles cochées en direct
export default function PasswordGuide({ password }) {
  if (!password) return null;
  const score = getStrength(password);
  const color = score === 3 ? Colors.success : score === 2 ? Colors.warningAmber : Colors.error;
  const label = score === 3 ? 'Solide' : score === 2 ? 'Correct' : 'Trop faible';
  return (
    <View style={s.wrap}>
      <View style={s.row} accessibilityLabel={`Robustesse du mot de passe : ${label}`}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[s.seg, { backgroundColor: i < score ? color : 'rgba(255,255,255,0.08)' }]}
          />
        ))}
      </View>
      <Text style={[s.lbl, { color }]}>{label}</Text>
      <View style={s.rules}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <View key={rule.id} style={s.rule}>
              <Ionicons
                name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={ok ? Colors.success : Colors.textMuted}
              />
              <Text style={[s.ruleTxt, ok && s.ruleOk]}>{rule.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:    { marginTop: -4, marginBottom: 14 },
  row:     { flexDirection: 'row', gap: 6 },
  seg:     { flex: 1, height: 3, borderRadius: 2 },
  lbl:     { fontSize: 12, fontWeight: '600', marginTop: 6 },
  rules:   { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, columnGap: 14, rowGap: 6 },
  rule:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ruleTxt: { color: Colors.textMuted, fontSize: 12.5 },
  ruleOk:  { color: Colors.textSecondary },
});
