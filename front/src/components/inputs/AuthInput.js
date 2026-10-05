import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

export default function AuthInput({
  label, icon, value, onChangeText, placeholder,
  secureTextEntry, isPassword, showPassword, setShowPassword,
  error, onBlur, ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const labelId = `auth-input-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const borderColor = error
    ? Colors.error
    : isFocused
    ? Colors.primary
    : 'rgba(255,255,255,0.06)';

  const iconColor = error
    ? Colors.error
    : isFocused
    ? Colors.primary
    : Colors.textMuted;

  return (
    <View style={styles.group}>
      <Text style={styles.label} nativeID={labelId}>{label}</Text>
      <View style={[styles.inputContainer, { borderColor }]}>
        <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />
        <TextInput
          style={styles.input}
          accessibilityLabel={label}
          accessibilityLabelledBy={labelId}
          aria-invalid={error ? true : undefined}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardAppearance="dark"
          onFocus={() => setIsFocused(true)}
          onBlur={() => { setIsFocused(false); onBlur?.(); }}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 22, 31, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
  },
  icon: { marginRight: 12 },
  // 16 px minimum : en dessous, Safari iOS zoome la page à chaque focus
  input: { flex: 1, color: Colors.textPrimary, fontSize: 16, height: '100%' },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginLeft: 2,
  },
});
