import React, { useRef } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../constants/theme';

// ─── Saisie d'un code à 6 chiffres ────────────────────────────────────────────
// Partagé par la vérification d'email et le mot de passe oublié.
//  - Cases fluides : s'adaptent à la largeur disponible (aucun débordement sur
//    les petits écrans 320-360 px), plafonnées à 52 px sur les grands.
//  - Coller le code entier (depuis l'email) dans n'importe quelle case remplit
//    les 6 cases d'un coup ; idem pour le remplissage automatique iOS/Android
//    (autoComplete="one-time-code").
//  - Retour arrière intuitif : vide la case, puis recule.

const CODE_LENGTH = 6;

export default function OTPCodeInput({ value, onChange, disabled, hasError, onComplete, autoFocus }) {
  const inputRefs = useRef([]);

  const setDigits = (digits, focusIndex) => {
    const next = digits.slice(0, CODE_LENGTH);
    onChange(next);
    if (next.length === CODE_LENGTH) {
      inputRefs.current[CODE_LENGTH - 1]?.blur?.();
      onComplete?.(next);
    } else if (focusIndex != null) {
      inputRefs.current[Math.min(focusIndex, CODE_LENGTH - 1)]?.focus();
    }
  };

  const handleChange = (text, index) => {
    const digits = text.replace(/[^0-9]/g, '');

    // Collage / remplissage automatique : plusieurs chiffres d'un coup
    if (digits.length > 1) {
      const merged = (value.slice(0, index) + digits).slice(0, CODE_LENGTH);
      setDigits(merged, merged.length);
      return;
    }

    const chars = value.split('');
    chars[index] = digits;
    const joined = chars.join('').slice(0, CODE_LENGTH);
    if (digits && index < CODE_LENGTH - 1) {
      setDigits(joined, index + 1);
    } else {
      setDigits(joined, null);
    }
  };

  const handleKeyPress = ({ nativeEvent: { key } }, index) => {
    if (key !== 'Backspace') return;
    const chars = value.split('');
    if (!value[index] && index > 0) {
      chars[index - 1] = '';
      onChange(chars.join(''));
      inputRefs.current[index - 1]?.focus();
    } else {
      chars[index] = '';
      onChange(chars.join(''));
    }
  };

  return (
    <View style={s.row} accessibilityLabel="Code de vérification à 6 chiffres">
      {Array.from({ length: CODE_LENGTH }).map((_, i) => {
        const filled = !!value[i];
        return (
          <TextInput
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            style={[s.box, filled && s.boxFilled, hasError && s.boxError]}
            value={value[i] || ''}
            onChangeText={(text) => handleChange(text, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            inputMode="numeric"
            keyboardAppearance="dark"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            textContentType={i === 0 ? 'oneTimeCode' : 'none'}
            // Laisse passer un collage complet ; le découpage est fait dans handleChange
            maxLength={i === 0 ? CODE_LENGTH : 2}
            selectTextOnFocus
            editable={!disabled}
            autoFocus={autoFocus && i === 0}
            textAlign="center"
            accessibilityLabel={`Chiffre ${i + 1} sur ${CODE_LENGTH}`}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 8,
    marginVertical: 24,
  },
  box: {
    flex: 1,
    maxWidth: 52,
    minWidth: 0,
    aspectRatio: 0.82,
    borderRadius: 12,
    backgroundColor: 'rgba(22, 22, 31, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    padding: 0,
    ...(Platform.OS === 'web' ? { caretColor: Colors.primary } : null),
  },
  boxFilled: { borderColor: Colors.primary },
  boxError:  { borderColor: Colors.error },
});
