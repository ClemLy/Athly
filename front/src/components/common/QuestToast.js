import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, Animated, StyleSheet, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { QUEST_XP, BONUS_XP } from '../../services/quest.service';

// Animated slide-in toast rendered above everything via Modal.
// Props:
//   visible     bool   — mount/unmount controls the animation cycle
//   questLabel  string — quest name (ignored when isBonus)
//   isBonus     bool   — true for the all-3-quests bonus notification
//   onHide      ()     — called after the toast finishes dismissing
export default function QuestToast({ visible, questLabel, isBonus = false, onHide }) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(-120);
    opacity.setValue(0);

    const inAnim = Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]);

    const outAnim = Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]);

    inAnim.start();

    const timer = setTimeout(() => {
      outAnim.start(() => {
        if (onHide) onHide();
      });
    }, 2400);

    return () => {
      clearTimeout(timer);
      inAnim.stop();
      outAnim.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, questLabel, isBonus]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={[styles.toast, { transform: [{ translateY }], opacity }]}
        pointerEvents="none"
      >
        <View style={[styles.iconWrap, isBonus && styles.iconWrapBonus]}>
          <Ionicons
            name={isBonus ? 'star' : 'checkmark-circle'}
            size={20}
            color={isBonus ? '#FFD700' : Colors.primary}
          />
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {isBonus ? 'Bonus toutes quêtes !' : 'Quête remplie !'}
          </Text>
          <Text style={[styles.label, isBonus && styles.labelBonus]} numberOfLines={1}>
            {isBonus
              ? `+${BONUS_XP} XP bonus`
              : `${questLabel}  ·  +${QUEST_XP} XP`}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 14, 22, 0.97)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(254, 116, 57, 0.4)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(254, 116, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  iconWrapBonus: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
  },
  content: {
    flex: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  label: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  labelBonus: {
    color: '#FFD700',
  },
});
