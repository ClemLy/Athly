import React, { useRef, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

function pad(n) { return String(n).padStart(2, '0'); }
function formatTime(s) {
  const sec = Math.max(0, Math.round(s));
  const m = Math.floor(sec / 60);
  return `${pad(m)}:${pad(sec % 60)}`;
}

export default function ShortSessionWarningModal({ visible, onModify, onForce, elapsedSeconds }) {
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 140, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.88);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onModify}
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="time-outline" size={38} color={Colors.error} />
          </View>

          <Text style={styles.title}>Séance trop courte</Text>
          <Text style={styles.body}>
            Ta séance ne dure que{' '}
            <Text style={styles.bodyAccent}>{formatTime(elapsedSeconds || 0)}</Text>
            .{'\n'}Il faut au moins{' '}
            <Text style={styles.bodyAccent}>5 minutes</Text>
            {' '}pour valider des XP.
          </Text>

          <View style={styles.warningRow}>
            <Ionicons name="alert-circle-outline" size={13} color={Colors.warningAmber} />
            <Text style={styles.warningText}>
              Valider quand même n'accordera aucun XP et ne comptera pas pour la streak.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={onModify} activeOpacity={0.85}>
            <Ionicons name="pencil-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Modifier la séance</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={onForce} activeOpacity={0.7}>
            <Text style={styles.ghostBtnText}>Valider quand même (0 XP)</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#13131C',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.28)',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 20,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,77,77,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 16,
  },
  bodyAccent: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
    width: '100%',
  },
  warningText: {
    flex: 1,
    color: Colors.warningAmber,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 54,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  ghostBtn: {
    width: '100%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ghostBtnText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
