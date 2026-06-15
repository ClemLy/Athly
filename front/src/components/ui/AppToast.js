import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// ─── Config par type ─────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  success: { icon: 'checkmark-circle',   color: '#22C55E' },
  error:   { icon: 'close-circle',        color: '#FF4D4D' },
  warning: { icon: 'warning',             color: '#F59E0B' },
  info:    { icon: 'information-circle',  color: '#4A9EFF' },
};

const SLIDE_OFFSET = -120; // part au-delà du bord supérieur

// ─── AppToast ─────────────────────────────────────────────────────────────────

export default function AppToast({ message, type = 'info', duration = 3500, onHide }) {
  const insets     = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SLIDE_OFFSET)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const timerRef   = useRef(null);

  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SLIDE_OFFSET,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onHide?.());
  }, [translateY, opacity, onHide]);

  useEffect(() => {
    // Entrée
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 160,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    timerRef.current = setTimeout(hide, duration);
    return () => clearTimeout(timerRef.current);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const topOffset = (insets.top || 0) + 12;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: topOffset, transform: [{ translateY }], opacity },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.toast, { borderColor: cfg.color + '40' }]}>
        {/* Barre accent gauche */}
        <View style={[styles.accentBar, { backgroundColor: cfg.color }]} />

        {/* Icône */}
        <Ionicons name={cfg.icon} size={20} color={cfg.color} style={styles.icon} />

        {/* Message */}
        <Text style={styles.message} numberOfLines={3}>{message}</Text>

        {/* Bouton fermer */}
        <TouchableOpacity
          onPress={hide}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 99999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,13,20,0.97)',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    // Ombre portée
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 16,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 48,
  },
  icon: {
    marginHorizontal: 12,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    paddingVertical: 14,
    paddingRight: 4,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexShrink: 0,
  },
});
