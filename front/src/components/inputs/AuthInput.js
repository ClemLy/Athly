import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

const BORDER_IDLE = 'rgba(255,255,255,0.08)';

export default function AuthInput({
  label, icon, value, onChangeText, placeholder,
  secureTextEntry, isPassword, showPassword, setShowPassword,
  error, onBlur, style, ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const labelId = `auth-input-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  // Bordure qui s'allume au focus (couleur non animable nativement : JS driver,
  // 150 ms, imperceptible en coût).
  const focus = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(focus, {
      toValue: isFocused ? 1 : 0, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: false,
    }).start();
  }, [isFocused, focus]);

  const borderColor = error
    ? Colors.error
    : focus.interpolate({ inputRange: [0, 1], outputRange: [BORDER_IDLE, Colors.primary] });
  const backgroundColor = focus.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.035)', 'rgba(254,116,57,0.06)'] });

  const iconColor = error ? Colors.error : isFocused ? Colors.primary : Colors.textMuted;

  return (
    <View style={[styles.group, style]}>
      <Text style={[styles.label, isFocused && styles.labelFocused]} nativeID={labelId}>{label}</Text>
      <Animated.View style={[styles.inputContainer, { borderColor, backgroundColor }]}>
        {icon ? <Ionicons name={icon} size={19} color={iconColor} style={styles.icon} /> : null}
        <TextInput
          style={styles.input}
          accessibilityLabel={label}
          accessibilityLabelledBy={labelId}
          aria-invalid={error ? true : undefined}
          placeholder={placeholder}
          placeholderTextColor="rgba(154,160,174,0.6)"
          selectionColor={Colors.primary}
          cursorColor={Colors.primary}
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
              color={isFocused ? Colors.textSecondary : Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={Colors.error} style={{ marginTop: 2 }} />
          <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: {
    color: Colors.textSecondary,
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 2,
  },
  labelFocused: { color: Colors.textPrimary },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
  },
  icon: { marginRight: 12 },
  // 16 px minimum : en dessous, Safari iOS zoome la page à chaque focus
  input: { flex: 1, color: Colors.textPrimary, fontSize: 16, height: '100%' },
  errorRow: { flexDirection: 'row', gap: 6, marginTop: 7, marginLeft: 2 },
  errorText: { flex: 1, color: Colors.error, fontSize: 13, lineHeight: 18 },
});
