import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const VARIANTS = {
  error: {
    icon: 'alert-circle',
    color: '#FF4D4D',
    bg: 'rgba(255, 77, 77, 0.10)',
    border: 'rgba(255, 77, 77, 0.30)',
    iconBg: 'rgba(255, 77, 77, 0.15)',
  },
  warning: {
    icon: 'warning',
    color: '#FFA040',
    bg: 'rgba(255, 160, 64, 0.10)',
    border: 'rgba(255, 160, 64, 0.28)',
    iconBg: 'rgba(255, 160, 64, 0.15)',
  },
  info: {
    icon: 'information-circle',
    color: '#8B8FE8',
    bg: 'rgba(110, 106, 240, 0.10)',
    border: 'rgba(110, 106, 240, 0.28)',
    iconBg: 'rgba(110, 106, 240, 0.15)',
  },
  success: {
    icon: 'checkmark-circle',
    color: '#44FF88',
    bg: 'rgba(68, 255, 136, 0.10)',
    border: 'rgba(68, 255, 136, 0.28)',
    iconBg: 'rgba(68, 255, 136, 0.15)',
  },
};

export default function NotificationBanner({ message, type = 'error' }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    translateY.setValue(-6);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const v = VARIANTS[type] || VARIANTS.error;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }], backgroundColor: v.bg, borderColor: v.border },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: v.iconBg }]}>
        <Ionicons name={v.icon} size={14} color={v.color} />
      </View>
      <Text style={[styles.text, { color: v.color }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 2,
    backgroundColor: 'rgba(14, 14, 22, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
