import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated,
  Modal, TouchableOpacity, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/theme';
import { MAX_FEATURED } from '../../hooks/useFeaturedTrophies';

const GLOW = {
  bronze:   { opacity: 0.55, radius: 12, elevation: 8  },
  silver:   { opacity: 0.78, radius: 20, elevation: 16 },
  gold:     { opacity: 0.92, radius: 28, elevation: 22 },
  platinum: { opacity: 1.0,  radius: 36, elevation: 28 },
  diamond:  { opacity: 1.0,  radius: 44, elevation: 36 },
  // legacy compat
  low:      { opacity: 0.55, radius: 12, elevation: 8  },
  medium:   { opacity: 0.82, radius: 22, elevation: 18 },
  high:     { opacity: 1.0,  radius: 36, elevation: 28 },
};

// ─── TrophySlot ───────────────────────────────────────────────────────────────

function TrophySlot({ trophy, onPress }) {
  const { icon, label, condition, desc, color, gradientColors, unlocked, tier, glowIntensity } = trophy;
  const gleamX = useRef(new Animated.Value(-56)).current;

  useEffect(() => {
    if (!unlocked) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(gleamX, { toValue: -56, duration: 1, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(gleamX, { toValue: 76, duration: 520, useNativeDriver: true }),
        Animated.delay(380),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [unlocked, gleamX]);

  const glow = GLOW[tier] || GLOW[glowIntensity] || GLOW.bronze;

  return (
    <TouchableOpacity
      style={[styles.slot, unlocked && { borderColor: color + '35', borderTopColor: color + '90', borderWidth: 0.8 }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.iconWrap, unlocked && { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: glow.opacity, shadowRadius: glow.radius, elevation: glow.elevation }]}>
        {unlocked ? (
          <LinearGradient colors={gradientColors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.iconGradient}>
            <Animated.View pointerEvents="none" style={[styles.gleam, { transform: [{ translateX: gleamX }, { rotate: '22deg' }] }]} />
            <Ionicons name={icon} size={28} color="#fff" />
          </LinearGradient>
        ) : (
          <View style={styles.iconLocked}>
            <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.14)" />
          </View>
        )}
      </View>
      <Text style={[styles.label, { color: unlocked ? Colors.textPrimary : Colors.textMuted }]}>{label}</Text>
      <Text style={[styles.desc, { color: unlocked ? color : 'rgba(255,255,255,0.15)' }]}>
        {condition || desc || ''}
      </Text>
    </TouchableOpacity>
  );
}

// ─── EmptySlot ────────────────────────────────────────────────────────────────

function EmptySlot({ onPress }) {
  return (
    <TouchableOpacity style={styles.emptySlot} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.emptyIcon}>
        <Ionicons name="add" size={22} color="rgba(255,255,255,0.18)" />
      </View>
      <Text style={styles.emptyLabel}>Choisir</Text>
      <Text style={styles.emptyHint}>Voir tout</Text>
    </TouchableOpacity>
  );
}

// ─── FeaturedModal : tap sur un trophée mis en avant ─────────────────────────

function FeaturedModal({ trophy, onClose, onUnfeature }) {
  const { icon, label, condition, desc, epicDesc, color, gradientColors, unlocked } = trophy;
  const scale   = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, tension: 130, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 190, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.modalCard, { transform: [{ scale }], opacity }]}>
          <Pressable style={styles.modalInner} onPress={() => {}}>
            <View style={[styles.modalIconShadow, { shadowColor: color }]}>
              <LinearGradient colors={gradientColors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.modalIconGradient}>
                <Ionicons name={icon} size={52} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={[styles.modalLabel, { color }]}>{label}</Text>
            <Text style={styles.modalCondition}>{condition || desc || ''}</Text>

            <View style={[styles.badge, { backgroundColor: color + '1A', borderColor: color + '55' }]}>
              <Ionicons name="checkmark-circle" size={13} color={color} />
              <Text style={[styles.badgeText, { color }]}>Débloqué · En vitrine</Text>
            </View>

            <View style={[styles.modalDivider, { backgroundColor: color + '30' }]} />

            <Text style={styles.modalEpicDesc}>{epicDesc || ''}</Text>

            <TouchableOpacity
              style={[styles.unfeaturedBtn, { borderColor: color + '40' }]}
              onPress={onUnfeature}
              activeOpacity={0.75}
            >
              <Ionicons name="star" size={13} color={color} />
              <Text style={[styles.unfeaturedBtnText, { color }]}>Retirer de la vitrine</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.closeBtn, { borderColor: 'rgba(255,255,255,0.15)' }]} onPress={onClose} activeOpacity={0.75}>
              <Text style={styles.closeTxt}>Fermer</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── TrophyGrid ───────────────────────────────────────────────────────────────

// featuredIds + toggleFeatured proviennent du parent (ProfileScreen via useFeaturedTrophies)
// → évite un état stale quand l'utilisateur revient de TrophyRoomScreen
export default function TrophyGrid({ evaluatedCatalog = [], featuredIds = [], toggleFeatured, onNavigateToRoom }) {
  const [selected, setSelected] = useState(null);

  const slots = Array.from({ length: MAX_FEATURED }, (_, i) => {
    const id = featuredIds[i];
    return id ? (evaluatedCatalog.find((t) => t.id === id) || null) : null;
  });

  const handleUnfeature = (id) => {
    toggleFeatured(id);
    setSelected(null);
  };

  return (
    <>
      <View style={styles.row}>
        {slots.map((trophy, i) =>
          trophy ? (
            <TrophySlot key={trophy.id} trophy={trophy} onPress={() => setSelected(trophy)} />
          ) : (
            <EmptySlot key={`empty-${i}`} onPress={onNavigateToRoom} />
          )
        )}
      </View>

      {selected && (
        <FeaturedModal
          trophy={selected}
          onClose={() => setSelected(null)}
          onUnfeature={() => handleUnfeature(selected.id)}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },

  slot: {
    flex: 1, backgroundColor: 'rgba(22,22,31,0.97)', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  iconWrap: { width: 56, height: 56, borderRadius: 18, marginBottom: 10 },
  iconGradient: {
    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderTopWidth: 0.8, borderTopColor: 'rgba(255,255,255,0.48)',
    borderWidth: 0.8, borderColor: 'rgba(255,255,255,0.08)',
  },
  gleam: { position: 'absolute', top: -8, width: 16, height: 80, backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 6 },
  iconLocked: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.8, borderColor: 'rgba(255,255,255,0.07)' },
  label: { fontSize: 12, fontWeight: '800', textAlign: 'center', letterSpacing: 0.3 },
  desc:  { fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 3, letterSpacing: 0.2 },

  emptySlot: {
    flex: 1, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 18, marginBottom: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.22)', letterSpacing: 0.3 },
  emptyHint:  { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.14)', marginTop: 3 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.74)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: { width: '100%', backgroundColor: 'rgba(20,20,28,0.94)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderTopColor: 'rgba(255,255,255,0.22)', shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.70, shadowRadius: 48, elevation: 32 },
  modalInner: { paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' },
  modalIconShadow: { marginBottom: 20, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.90, shadowRadius: 32, elevation: 24 },
  modalIconGradient: { width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  modalLabel:    { fontSize: 26, fontWeight: '900', letterSpacing: 0.4, marginBottom: 5 },
  modalCondition:{ color: Colors.textMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0.4, marginBottom: 14 },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginBottom: 4 },
  badgeText:     { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  modalDivider:  { width: '55%', height: 1, marginVertical: 20 },
  modalEpicDesc: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 22, marginBottom: 20, paddingHorizontal: 4 },

  unfeaturedBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  unfeaturedBtnText: { fontSize: 14, fontWeight: '700' },
  closeBtn: { paddingVertical: 10, paddingHorizontal: 40, borderRadius: 14, borderWidth: 1 },
  closeTxt: { fontSize: 14, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.4 },
});
