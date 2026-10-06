import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgGrad,
  RadialGradient,
  Stop,
  Path,
  Circle as SvgCircle,
  Text as SvgText,
} from 'react-native-svg';
import { BG, SHAPE_BLEED, CANVAS_HALF, buildFrame, gradientDefs, ringWidth } from './frameGeometry';

// ─── Color definitions ────────────────────────────────────────────────────────

export const COLOR_DEFS = [
  { id: 'none',        name: 'Défaut',       unlockLevel: 0,   colors: null,                                                                              animated: false, glowColor: null,                     borderWidth: 2   },
  { id: 'iron',        name: 'Acier',        unlockLevel: 1,   colors: ['#8A9BB0','#C5D0DC','#A8B8C8','#C5D0DC','#8A9BB0'],                               animated: false, glowColor: null,                     borderWidth: 2.5 },
  { id: 'bronze',      name: 'Bronze',       unlockLevel: 11,  colors: ['#6B3A1A','#CD7F32','#E8A060','#FFB870','#E8A060','#CD7F32','#6B3A1A'],           animated: false, glowColor: null,                     borderWidth: 3   },
  { id: 'silver',      name: 'Argent',       unlockLevel: 31,  colors: ['#9CA3AF','#D1D5DB','#F3F4F6','#FFFFFF','#F3F4F6','#D1D5DB','#9CA3AF'],           animated: false, glowColor: 'rgba(209,213,219,0.50)', borderWidth: 3   },
  { id: 'sapphire',    name: 'Saphir',       unlockLevel: 51,  colors: ['#1E3A8A','#2563EB','#60A5FA','#BFDBFE','#60A5FA','#2563EB','#1E3A8A'],           animated: false, glowColor: 'rgba(96,165,250,0.60)',  borderWidth: 3.5 },
  { id: 'warrior',     name: 'Warrior',      unlockLevel: 71,  colors: ['#3B0764','#6D28D9','#A78BFA','#C4B5FD','#A78BFA','#6D28D9','#3B0764'],           animated: false, glowColor: 'rgba(167,139,250,0.65)', borderWidth: 4   },
  { id: 'elite',       name: 'Élite',        unlockLevel: 91,  colors: ['#1E1B4B','#4338CA','#6E6AF0','#A5B4FC','#E0E7FF','#A5B4FC','#6E6AF0','#1E1B4B'], animated: true,  glowColor: 'rgba(110,106,240,0.75)', borderWidth: 4   },
  { id: 'master',      name: 'Maître',       unlockLevel: 111, colors: ['#4A044E','#7E22CE','#A855F7','#C084FC','#F0ABFC','#C084FC','#A855F7','#4A044E'], animated: true,  glowColor: 'rgba(192,132,252,0.80)', borderWidth: 4.5 },
  { id: 'grandmaster', name: 'Grand Maître', unlockLevel: 141, colors: ['#5B21B6','#9333EA','#C084FC','#F0ABFC','#FFFFFF','#F0ABFC','#C084FC','#9333EA'], animated: true,  glowColor: 'rgba(240,171,252,0.85)', borderWidth: 5   },
  { id: 'legend',      name: 'Légende',      unlockLevel: 171, colors: ['#4C1D95','#7C3AED','#A855F7','#C084FC','#F5D0FE','#FFFFFF','#F5D0FE','#C084FC'], animated: true,  glowColor: 'rgba(245,208,254,0.90)', borderWidth: 5.5 },
  { id: 'god',         name: 'ATHLY GOD',    unlockLevel: 200, colors: ['#78350F','#B45309','#D97706','#F59E0B','#FDE68A','#FFD700','#FDE68A','#F59E0B','#D97706'], animated: true, glowColor: 'rgba(255,215,0,0.95)', borderWidth: 6 },
  // Cosmétique Unique — débloquée en réclamant l'item FRAME_COLOR_BLOOD_SANG
  // (streak de groupe 30j à 5 membres), jamais par le niveau : unlockLevel
  // n'est là que pour l'affichage, `special` court-circuite le calcul de
  // verrouillage (voir isColorLocked dans BorderPicker.js).
  { id: 'bloodsang',   name: 'Rouge Sang', unlockLevel: Infinity, special: true, specialFlag: 'FRAME_COLOR_BLOODSANG',
    colors: ['#3D0000','#7A0000','#A30000','#FF2E4D','#A30000','#7A0000','#3D0000'],
    animated: true, glowColor: 'rgba(163,0,0,0.80)', borderWidth: 5 },
];

// Le dessin de chaque forme vit dans frameGeometry.js ; `SHAPE_BLEED` y
// donne le débord de ses ornements autour de l'anneau.
export const SHAPE_DEFS = [
  { id: 'circle', name: 'Cercle',   unlockLevel: 0   },
  { id: 'hex',    name: 'Hexagone', unlockLevel: 11  },
  { id: 'oct',    name: 'Octogone', unlockLevel: 31  },
  { id: 'shield', name: 'Bouclier', unlockLevel: 51  },
  { id: 'spike',  name: 'Éclairs',  unlockLevel: 71  },
  { id: 'neon',   name: 'Néon',     unlockLevel: 91  },
  { id: 'crown',  name: 'Couronne', unlockLevel: 141 },
  { id: 'wings',  name: 'Ailes',    unlockLevel: 171 },
  { id: 'divine', name: 'Divin',    unlockLevel: 200 },
  // Cosmétique Unique — débloquée en réclamant l'item PROFILE_FRAME_BLOOD_BOND
  // (niveau d'amitié 5), jamais par le niveau (voir isShapeLocked).
  { id: 'dragonfang', name: 'Croc de Dragon', unlockLevel: Infinity, special: true, specialFlag: 'FRAME_SHAPE_DRAGONFANG' },
];

export const FRAME_DEFS = COLOR_DEFS.map((c) => ({
  id: c.id, name: c.name, unlockLevel: c.unlockLevel,
  colors: c.colors, borderWidth: c.borderWidth, animated: c.animated,
  glowColor: c.glowColor, description: c.name,
}));

export function getColorDef(id) { return COLOR_DEFS.find((c) => c.id === id) || COLOR_DEFS[0]; }
export function getShapeDef(id) { return SHAPE_DEFS.find((s) => s.id === id) || SHAPE_DEFS[0]; }
export function getFrameDef(id) { return FRAME_DEFS.find((f) => f.id === id) || FRAME_DEFS[0]; }

// Débord des ornements au-delà de la boîte de mise en page (l'anneau, 2R × 2R),
// en pixels, pour une taille d'avatar donnée. Les écrans qui affichent le cadre
// réservent cette marge au lieu de réduire l'avatar.
export function getFrameBleed(shapeId, colorId, size) {
  const color = getColorDef(colorId);
  if (!color.colors) return { box: size, R: size / 2, top: 0, bottom: 0, side: 0 };
  const R = size / 2 + ringWidth(color, size);
  const b = SHAPE_BLEED[getShapeDef(shapeId).id] || SHAPE_BLEED.circle;
  return { box: R * 2, R, top: (b.top - 1) * R, bottom: (b.bottom - 1) * R, side: (b.side - 1) * R };
}

// ─── Rendu SVG ───────────────────────────────────────────────────────────────

let gradientSeq = 0;

function FrameSvg({ shapeId, color, size, userInitial }) {
  // Préfixe d'id unique par instance : plusieurs cadres coexistent à l'écran
  // (sélecteur) et leurs dégradés ne doivent pas se marcher dessus.
  const prefix = useRef(`af${(gradientSeq += 1)}`).current;
  const frame = useMemo(() => buildFrame(shapeId, color, size), [shapeId, color, size]);
  const grads = useMemo(() => gradientDefs(color.colors, color.glowColor), [color]);
  const H = frame.R * CANVAS_HALF;
  const paint = (v) => (v && v.startsWith('url:') ? `url(#${prefix}${v.slice(4)})` : v || 'none');

  return (
    <Svg width={H * 2} height={H * 2} viewBox={`${-H} ${-H} ${H * 2} ${H * 2}`} pointerEvents="none">
      <Defs>
        {grads.map((g) => (g.radial ? (
          <RadialGradient key={g.id} id={prefix + g.id} cx="50%" cy="50%" r="50%">
            {g.stops.map((st, i) => <Stop key={i} offset={st.o} stopColor={st.c} stopOpacity={st.a} />)}
          </RadialGradient>
        ) : (
          <SvgGrad key={g.id} id={prefix + g.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
            {g.stops.map((st, i) => <Stop key={i} offset={st.o} stopColor={st.c} stopOpacity={st.a} />)}
          </SvgGrad>
        )))}
      </Defs>
      {frame.layers.map((l, i) => (
        <Path
          key={i}
          d={l.d}
          fill={paint(l.fill)}
          fillRule={l.rule}
          stroke={l.stroke}
          strokeWidth={l.sw}
          strokeLinejoin="round"
          opacity={l.op}
        />
      ))}
      {/* Initiale au centre géométrique exact : centrage parfait pour toutes les formes. */}
      {userInitial ? (
        <SvgText
          x={0}
          y={0}
          textAnchor="middle"
          alignmentBaseline="middle"
          dominantBaseline="central"
          fill="#FFFFFF"
          fontSize={size * 0.4}
          fontWeight="900"
        >
          {userInitial}
        </SvgText>
      ) : null}
    </Svg>
  );
}

// ─── FrameAura — énergie animée des paliers légendaires ──────────────────────

const AURA_SHAPES = new Set(['crown', 'wings', 'divine', 'dragonfang']);

function FrameAura({ R, glowColor }) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,    duration: 1900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 2600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const H = R * CANVAS_HALF;
  const particles = useMemo(() => (
    Array.from({ length: 12 }, (_, i) => {
      const a = (2 * Math.PI * i) / 12 - Math.PI / 5;
      const dist = R * (1.3 + (i % 4) * 0.12);
      return { x: dist * Math.cos(a), y: dist * Math.sin(a), r: R * (0.018 + (i % 3) * 0.01), op: 0.3 + (i % 3) * 0.2 };
    })
  ), [R]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: pulse }]} pointerEvents="none">
      <Svg width={H * 2} height={H * 2} viewBox={`${-H} ${-H} ${H * 2} ${H * 2}`}>
        {particles.map((p, i) => (
          <SvgCircle key={i} cx={p.x} cy={p.y} r={p.r} fill={glowColor} opacity={p.op} />
        ))}
      </Svg>
    </Animated.View>
  );
}

// ─── AvatarFrame ─────────────────────────────────────────────────────────────
//
// Boîte de mise en page = l'anneau (2R × 2R), identique pour toutes les formes :
// l'avatar garde la même taille et la même position quel que soit le cadre.
// Le SVG (canevas de 2 × CANVAS_HALF × R) est centré dessus en absolu, et les
// ornements (couronne, ailes, rayons…) débordent sans affecter la mise en page.
// Voir getFrameBleed() pour réserver la place côté écran.

export default function AvatarFrame({ shapeId = 'circle', colorId = 'none', size = 90, children, userInitial }) {
  const color = getColorDef(colorId);
  if (!color.colors) return <>{children}</>;
  return (
    <FramedAvatar shapeId={getShapeDef(shapeId).id} color={color} size={size} userInitial={userInitial}>
      {children}
    </FramedAvatar>
  );
}

function FramedAvatar({ shapeId, color, size, userInitial, children }) {
  const R = size / 2 + ringWidth(color, size);
  const H = R * CANVAS_HALF;
  const canvas = { position: 'absolute', left: R - H, top: R - H, width: H * 2, height: H * 2 };
  const showAura = AURA_SHAPES.has(shapeId) && !!color.glowColor;

  return (
    <View style={{ width: R * 2, height: R * 2, overflow: 'visible' }}>
      <View style={canvas} pointerEvents="none">
        {showAura && <FrameAura R={R} glowColor={color.glowColor} />}
        <FrameSvg key={`${shapeId}-${color.id}`} shapeId={shapeId} color={color} size={size} userInitial={userInitial} />
      </View>
      {!userInitial && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {children}
        </View>
      )}
    </View>
  );
}

// ─── FrameStage ──────────────────────────────────────────────────────────────
//
// Affiche un cadre centré dans une zone fixe (width × height) en tenant compte
// de ses ornements. L'avatar garde `size` tant que tout rentre ; sinon il est
// réduit juste assez pour qu'aucun ornement ne sorte de la zone.

export function FrameStage({ shapeId = 'circle', colorId = 'none', size, width, height, userInitial, children, style }) {
  const color = getColorDef(colorId);
  if (!color.colors) {
    return <View style={[{ width, height }, styles.center, style]}>{children}</View>;
  }
  const b = SHAPE_BLEED[getShapeDef(shapeId).id] || SHAPE_BLEED.circle;
  const R0 = size / 2 + ringWidth(color, size);
  const k = Math.min(1, width / (2 * b.side * R0), height / ((b.top + b.bottom) * R0));
  const S = size * k;
  const R = S / 2 + ringWidth(color, S);
  const cy = b.top * R + (height - (b.top + b.bottom) * R) / 2;

  return (
    <View style={[{ width, height }, style]}>
      <View style={{ position: 'absolute', left: width / 2 - R, top: cy - R }}>
        <AvatarFrame shapeId={shapeId} colorId={colorId} size={S} userInitial={userInitial}>{children}</AvatarFrame>
      </View>
    </View>
  );
}

// ─── ColorPreview ─────────────────────────────────────────────────────────────

export function ColorPreview({ colorId, size = 44, locked = false }) {
  const color = getColorDef(colorId);

  if (!color.colors) {
    return (
      <View style={{
        width: size + 4, height: size + 4, borderRadius: (size + 4) / 2,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: BG, opacity: locked ? 0.35 : 1,
      }} />
    );
  }

  return (
    <View style={{ opacity: locked ? 0.35 : 1 }}>
      <AvatarFrame shapeId="circle" colorId={colorId} size={size} />
    </View>
  );
}

// ─── ShapePreview ─────────────────────────────────────────────────────────────
// Zone fixe identique pour toutes les formes : les vignettes du sélecteur
// restent alignées et à la même échelle, ornements compris.

export function ShapePreview({ shapeId, colorId = 'bronze', size = 38, locked = false }) {
  const safeColor = getColorDef(colorId).colors ? colorId : 'iron';
  return (
    <FrameStage
      shapeId={shapeId}
      colorId={safeColor}
      size={size}
      width={size * 1.95}
      height={size * 1.62}
      style={{ opacity: locked ? 0.35 : 1 }}
    />
  );
}

// Legacy alias
export function FramePreview({ frameId, size = 44, locked = false }) {
  return <ColorPreview colorId={frameId} size={size} locked={locked} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
