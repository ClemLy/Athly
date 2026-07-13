import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { ITEM_CATALOG, RARITY_META } from '../../services';
import BirthdayConfetti from '../profile/BirthdayConfetti';

// ─── ChestOpeningModal ────────────────────────────────────────────────────────
// Séquence d'ouverture de coffre en 3 phases, 100% Animated (useNativeDriver) :
//   1. "shaking"  — le coffre tremble avec une intensité croissante
//   2. "burst"    — flash + explosion d'échelle, halo à la couleur de la rareté
//   3. "reveal"   — l'item tiré apparaît en rebond + confettis si épique+
//
// Props :
//   visible    bool
//   drawnItem  { itemType, rarity } | null — résultat renvoyé par le backend
//   onClose    () => void

export default function ChestOpeningModal({ visible, drawnItem, onClose }) {
  const [phase, setPhase] = useState('shaking'); // shaking | burst | reveal

  const shake     = useRef(new Animated.Value(0)).current;
  const chestScale = useRef(new Animated.Value(1)).current;
  const flash     = useRef(new Animated.Value(0)).current;
  const itemScale = useRef(new Animated.Value(0)).current;
  const itemSpin  = useRef(new Animated.Value(0)).current;
  const glow      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    setPhase('shaking');
    shake.setValue(0);
    chestScale.setValue(1);
    flash.setValue(0);
    itemScale.setValue(0);
    itemSpin.setValue(0);
    glow.setValue(0);

    // Phase 1 : tremblements croissants (3 salves)
    const wobble = (intensity, duration) =>
      Animated.sequence([
        Animated.timing(shake, { toValue: intensity,  duration: duration / 4, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -intensity, duration: duration / 2, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0,          duration: duration / 4, useNativeDriver: true }),
      ]);

    Animated.sequence([
      wobble(4, 300),
      Animated.delay(120),
      wobble(8, 260),
      Animated.delay(80),
      wobble(14, 220),
      // Phase 2 : compression puis explosion + flash
      Animated.parallel([
        Animated.sequence([
          Animated.timing(chestScale, { toValue: 0.82, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(chestScale, { toValue: 1.9,  duration: 240, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(130),
          Animated.timing(flash, { toValue: 1, duration: 110, useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      setPhase('reveal');
      // Phase 3 : reveal de l'item en rebond + halo pulsé
      Animated.parallel([
        Animated.timing(flash,     { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.spring(itemScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.timing(itemSpin,  { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(glow, { toValue: 0.35, duration: 900, useNativeDriver: true }),
          ]),
        ),
      ]).start();
    });

    return () => {
      shake.stopAnimation();
      chestScale.stopAnimation();
      flash.stopAnimation();
      itemScale.stopAnimation();
      itemSpin.stopAnimation();
      glow.stopAnimation();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const item   = drawnItem ? ITEM_CATALOG[drawnItem.itemType] : null;
  const rarity = drawnItem ? RARITY_META[drawnItem.rarity] : null;
  const isBigDrop = drawnItem && ['epic', 'legendary'].includes(drawnItem.rarity);

  const spinDeg = itemSpin.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={phase === 'reveal' ? onClose : undefined}>
      <View style={styles.backdrop}>
        {phase === 'reveal' && isBigDrop && <BirthdayConfetti active />}

        {/* Flash blanc de l'explosion */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />

        {phase !== 'reveal' ? (
          <Animated.View
            style={{ transform: [{ translateX: shake }, { scale: chestScale }] }}
          >
            <Ionicons name="cube" size={104} color={Colors.primary} />
          </Animated.View>
        ) : (
          <View style={styles.revealWrap}>
            {/* Halo pulsé à la couleur de la rareté */}
            <Animated.View
              style={[styles.halo, {
                backgroundColor: rarity?.color ?? Colors.primary,
                opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.22] }),
              }]}
            />
            <Animated.View style={[styles.itemIconWrap, { transform: [{ scale: itemScale }, { rotate: spinDeg }] }]}>
              <Ionicons name={item?.icon ?? 'help-circle-outline'} size={72} color={rarity?.color ?? Colors.textPrimary} />
            </Animated.View>

            <Text style={[styles.rarityLabel, { color: rarity?.color ?? Colors.textSecondary }]}>
              {rarity?.label?.toUpperCase() ?? ''}
            </Text>
            <Text style={styles.itemName}>{item?.name ?? drawnItem?.itemType}</Text>
            <Text style={styles.itemDesc}>{item?.description ?? ''}</Text>

            <TouchableOpacity
              style={[styles.collectBtn, { backgroundColor: rarity?.color ?? Colors.primary }]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.collectTxt}>Récupérer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 32,
  },
  flash: { backgroundColor: '#FFFFFF' },

  revealWrap: { alignItems: 'center', width: '100%' },
  halo: {
    position:     'absolute',
    top:          -70,
    width:        260,
    height:       260,
    borderRadius: 130,
  },
  itemIconWrap: { marginBottom: 18 },
  rarityLabel: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: 3,
    marginBottom:  6,
  },
  itemName: {
    color:        Colors.textPrimary,
    fontSize:     22,
    fontWeight:   '800',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign:    'center',
  },
  itemDesc: {
    color:        Colors.textSecondary,
    fontSize:     14,
    lineHeight:   20,
    textAlign:    'center',
    marginBottom: 30,
  },
  collectBtn: {
    height:            50,
    paddingHorizontal: 40,
    borderRadius:      13,
    justifyContent:    'center',
    alignItems:        'center',
  },
  collectTxt: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
