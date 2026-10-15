import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Rect, Circle } from 'react-native-svg';

// ─── Coffre dessiné ───────────────────────────────────────────────────────────
// Bois sombre cerclé de laiton. Le couvercle et le corps sont deux SVG
// distincts (même repère 100 × 100) pour que l'ouverture puisse animer le
// couvercle seul. `seam` : lueur entre couvercle et corps (couleur de rareté).

const BRASS = ['#F6D27A', '#D79A32', '#8A5A16'];
const WOOD_LID = ['#6B4423', '#4A2D15'];
const WOOD_BODY = ['#5A3819', '#3A2410'];

let seq = 0;

function Gradients({ id }) {
  return (
    <Defs>
      <LinearGradient id={`${id}brass`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={BRASS[0]} />
        <Stop offset="0.5" stopColor={BRASS[1]} />
        <Stop offset="1" stopColor={BRASS[2]} />
      </LinearGradient>
      <LinearGradient id={`${id}lid`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={WOOD_LID[0]} />
        <Stop offset="1" stopColor={WOOD_LID[1]} />
      </LinearGradient>
      <LinearGradient id={`${id}body`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={WOOD_BODY[0]} />
        <Stop offset="1" stopColor={WOOD_BODY[1]} />
      </LinearGradient>
    </Defs>
  );
}

export function ChestLid({ size }) {
  const id = `cl${(seq += 1)}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Gradients id={id} />
      <Path d="M12,50 L12,36 Q12,18 50,18 Q88,18 88,36 L88,50 Z" fill={`url(#${id}lid)`} />
      <Path d="M20,24 Q50,14 80,24" stroke="#000" strokeOpacity={0.25} strokeWidth={1.2} fill="none" />
      <Path d="M22,50 L22,22 Q25,20 30,19.4 L30,50 Z" fill={`url(#${id}brass)`} />
      <Path d="M70,50 L70,19.4 Q75,20 78,22 L78,50 Z" fill={`url(#${id}brass)`} />
      <Path d="M12,46 L88,46 L88,50 L12,50 Z" fill={`url(#${id}brass)`} />
      <Path d="M18,30 Q50,16 82,30" stroke="#FFF" strokeOpacity={0.18} strokeWidth={2} fill="none" />
    </Svg>
  );
}

export function ChestBody({ size, seam = null }) {
  const id = `cb${(seq += 1)}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Gradients id={id} />
      <Rect x="12" y="50" width="76" height="36" rx="4" fill={`url(#${id}body)`} />
      <Path d="M12,62 L88,62 M12,74 L88,74" stroke="#000" strokeOpacity={0.25} strokeWidth={1} />
      <Rect x="22" y="50" width="8" height="36" fill={`url(#${id}brass)`} />
      <Rect x="70" y="50" width="8" height="36" fill={`url(#${id}brass)`} />
      <Rect x="12" y="82" width="76" height="4" rx="2" fill={`url(#${id}brass)`} />
      {seam ? <Rect x="12" y="49" width="76" height="3" fill={seam} /> : null}
      <Rect x="41" y="46" width="18" height="20" rx="3" fill={`url(#${id}brass)`} />
      <Circle cx="50" cy="54" r="2.6" fill="#2A1A0A" />
      <Path d="M48.8,55 L51.2,55 L52,61 L48,61 Z" fill="#2A1A0A" />
    </Svg>
  );
}

// Coffre complet, statique (inventaire, aperçus).
export default function ChestGlyph({ size = 64, dimmed = false }) {
  return (
    <View style={{ width: size, height: size, opacity: dimmed ? 0.45 : 1 }}>
      <View style={{ position: 'absolute' }}><ChestBody size={size} /></View>
      <View style={{ position: 'absolute' }}><ChestLid size={size} /></View>
    </View>
  );
}
