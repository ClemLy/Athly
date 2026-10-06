import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';
import { FrameStage } from '../profile/AvatarFrame';

// ─── UserAvatar ───────────────────────────────────────────────────────────────
// Avatar d'un joueur avec SON cadre équipé (`user.equippedFrame`) : dans le
// mode en ligne, on reconnaît ses amis à leur cadre, et les cadres débloqués
// se voient enfin ailleurs que sur son propre profil. Sans cadre : pastille
// avec l'initiale. La boîte fait toujours `size` × `size` (ornements inclus).

export default function UserAvatar({ user, size = 44, style }) {
  const initial = (user?.pseudo ?? '?').charAt(0).toUpperCase();
  const frame = user?.equippedFrame || {};
  const shapeId = frame.shapeId || 'circle';
  const colorId = frame.colorId || 'none';
  const inner = Math.round(size * 0.74);

  return (
    <FrameStage
      shapeId={shapeId}
      colorId={colorId}
      size={inner}
      width={size}
      height={size}
      userInitial={colorId !== 'none' ? initial : undefined}
      style={style}
    >
      <View style={[styles.plain, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <Text style={[styles.initial, { fontSize: inner * 0.42 }]}>{initial}</Text>
      </View>
    </FrameStage>
  );
}

const styles = StyleSheet.create({
  plain: {
    backgroundColor: 'rgba(254,116,57,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(254,116,57,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: Colors.primary, fontWeight: '800' },
});
