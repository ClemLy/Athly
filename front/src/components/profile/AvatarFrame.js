import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgGrad,
  RadialGradient,
  Stop,
  Path,
  Circle as SvgCircle,
  Ellipse,
  Text as SvgText,
} from 'react-native-svg';

const BG = '#0D0D15';

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
];

export const SHAPE_DEFS = [
  { id: 'circle', name: 'Cercle',   unlockLevel: 0,   extraPad: 0,  extraTop: 0  },
  { id: 'hex',    name: 'Hexagone', unlockLevel: 11,  extraPad: 2,  extraTop: 0  },
  { id: 'oct',    name: 'Octogone', unlockLevel: 31,  extraPad: 2,  extraTop: 0  },
  { id: 'shield', name: 'Bouclier', unlockLevel: 51,  extraPad: 4,  extraTop: 0  },
  { id: 'spike',  name: 'Éclairs',  unlockLevel: 71,  extraPad: 12, extraTop: 0  },
  { id: 'neon',   name: 'Néon',     unlockLevel: 91,  extraPad: 8,  extraTop: 0  },
  { id: 'crown',  name: 'Couronne', unlockLevel: 141, extraPad: 6,  extraTop: 30 },
  { id: 'wings',  name: 'Ailes',    unlockLevel: 171, extraPad: 28, extraTop: 0  },
  { id: 'divine', name: 'Divin',    unlockLevel: 200, extraPad: 16, extraTop: 16 },
];

export const FRAME_DEFS = COLOR_DEFS.map((c) => ({
  id: c.id, name: c.name, unlockLevel: c.unlockLevel,
  colors: c.colors, borderWidth: c.borderWidth, animated: c.animated,
  glowColor: c.glowColor, description: c.name,
}));

export function getColorDef(id) { return COLOR_DEFS.find((c) => c.id === id) || COLOR_DEFS[0]; }
export function getShapeDef(id) { return SHAPE_DEFS.find((s) => s.id === id) || SHAPE_DEFS[0]; }
export function getFrameDef(id) { return FRAME_DEFS.find((f) => f.id === id) || FRAME_DEFS[0]; }

// ─── SVG path helpers ─────────────────────────────────────────────────────────

function polyPath(cx, cy, r, sides, rotDeg = 0) {
  const rotRad = (rotDeg * Math.PI) / 180;
  const pts = Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * i) / sides + rotRad;
    return `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return pts.join(' ') + ' Z';
}

function shieldPath(cx, cy, r) {
  const w = r * 0.82, topY = cy - r * 0.88;
  return [
    `M${(cx - w).toFixed(1)},${topY.toFixed(1)}`,
    `L${(cx + w).toFixed(1)},${topY.toFixed(1)}`,
    `L${(cx + r * 0.95).toFixed(1)},${(cy - r * 0.18).toFixed(1)}`,
    `L${(cx + r * 0.62).toFixed(1)},${(cy + r * 0.55).toFixed(1)}`,
    `L${cx.toFixed(1)},${(cy + r).toFixed(1)}`,
    `L${(cx - r * 0.62).toFixed(1)},${(cy + r * 0.55).toFixed(1)}`,
    `L${(cx - r * 0.95).toFixed(1)},${(cy - r * 0.18).toFixed(1)}`, 'Z',
  ].join(' ');
}

function spikePath(cx, cy, hexR, spikeR) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const aV = (2 * Math.PI * i) / 6 - Math.PI / 2;
    pts.push(`${(cx + hexR * Math.cos(aV)).toFixed(1)},${(cy + hexR * Math.sin(aV)).toFixed(1)}`);
    const aM = aV + Math.PI / 6;
    pts.push(`${(cx + spikeR * Math.cos(aM)).toFixed(1)},${(cy + spikeR * Math.sin(aM)).toFixed(1)}`);
  }
  return 'M' + pts.join(' L') + ' Z';
}

function chamfPath(cx, cy, hw, hh, cut) {
  return [
    `M${(cx - hw + cut).toFixed(1)},${(cy - hh).toFixed(1)}`,
    `L${(cx + hw - cut).toFixed(1)},${(cy - hh).toFixed(1)}`,
    `L${(cx + hw).toFixed(1)},${(cy - hh + cut).toFixed(1)}`,
    `L${(cx + hw).toFixed(1)},${(cy + hh - cut).toFixed(1)}`,
    `L${(cx + hw - cut).toFixed(1)},${(cy + hh).toFixed(1)}`,
    `L${(cx - hw + cut).toFixed(1)},${(cy + hh).toFixed(1)}`,
    `L${(cx - hw).toFixed(1)},${(cy + hh - cut).toFixed(1)}`,
    `L${(cx - hw).toFixed(1)},${(cy - hh + cut).toFixed(1)}`, 'Z',
  ].join(' ');
}

// ── Sovereign Crown (Couronne Royale) ─────────────────────────────────────────
// 5 graduated spikes: outer-left, inner-left, center (tallest), inner-right, outer-right.
// Bezier-smooth valleys between spikes, base band at bottom.
function sovereignCrown(cx, baseY, h, w) {
  const bandH    = h * 0.22;
  const bandTopY = baseY - bandH;
  const lEdge = cx - w, rEdge = cx + w;

  const spikes = [
    { x: cx - w * 0.90, y: baseY - h * 0.52 },
    { x: cx - w * 0.46, y: baseY - h * 0.80 },
    { x: cx,            y: baseY - h         },
    { x: cx + w * 0.46, y: baseY - h * 0.80 },
    { x: cx + w * 0.90, y: baseY - h * 0.52 },
  ];
  const valleys = [
    { x: cx - w * 0.685, y: bandTopY - h * 0.04 },
    { x: cx - w * 0.230, y: bandTopY - h * 0.12 },
    { x: cx + w * 0.230, y: bandTopY - h * 0.12 },
    { x: cx + w * 0.685, y: bandTopY - h * 0.04 },
  ];

  const kH = w * 0.055;
  const kV = h * 0.15;

  return (
    `M${lEdge.toFixed(1)},${baseY.toFixed(1)} ` +
    `L${lEdge.toFixed(1)},${bandTopY.toFixed(1)} ` +
    // left edge → spike[0]
    `C${lEdge.toFixed(1)},${(bandTopY - kV * 0.5).toFixed(1)} ` +
    `${(spikes[0].x - kH).toFixed(1)},${spikes[0].y.toFixed(1)} ` +
    `${spikes[0].x.toFixed(1)},${spikes[0].y.toFixed(1)} ` +
    // spike[0] → valley[0]
    `C${(spikes[0].x + kH).toFixed(1)},${spikes[0].y.toFixed(1)} ` +
    `${(valleys[0].x - kH * 0.5).toFixed(1)},${valleys[0].y.toFixed(1)} ` +
    `${valleys[0].x.toFixed(1)},${valleys[0].y.toFixed(1)} ` +
    // valley[0] → spike[1]
    `C${(valleys[0].x + kH * 0.5).toFixed(1)},${valleys[0].y.toFixed(1)} ` +
    `${(spikes[1].x - kH).toFixed(1)},${spikes[1].y.toFixed(1)} ` +
    `${spikes[1].x.toFixed(1)},${spikes[1].y.toFixed(1)} ` +
    // spike[1] → valley[1]
    `C${(spikes[1].x + kH).toFixed(1)},${spikes[1].y.toFixed(1)} ` +
    `${(valleys[1].x - kH * 0.5).toFixed(1)},${valleys[1].y.toFixed(1)} ` +
    `${valleys[1].x.toFixed(1)},${valleys[1].y.toFixed(1)} ` +
    // valley[1] → spike[2] (center, tallest)
    `C${(valleys[1].x + kH * 0.5).toFixed(1)},${valleys[1].y.toFixed(1)} ` +
    `${(spikes[2].x - kH).toFixed(1)},${spikes[2].y.toFixed(1)} ` +
    `${spikes[2].x.toFixed(1)},${spikes[2].y.toFixed(1)} ` +
    // spike[2] → valley[2]
    `C${(spikes[2].x + kH).toFixed(1)},${spikes[2].y.toFixed(1)} ` +
    `${(valleys[2].x - kH * 0.5).toFixed(1)},${valleys[2].y.toFixed(1)} ` +
    `${valleys[2].x.toFixed(1)},${valleys[2].y.toFixed(1)} ` +
    // valley[2] → spike[3]
    `C${(valleys[2].x + kH * 0.5).toFixed(1)},${valleys[2].y.toFixed(1)} ` +
    `${(spikes[3].x - kH).toFixed(1)},${spikes[3].y.toFixed(1)} ` +
    `${spikes[3].x.toFixed(1)},${spikes[3].y.toFixed(1)} ` +
    // spike[3] → valley[3]
    `C${(spikes[3].x + kH).toFixed(1)},${spikes[3].y.toFixed(1)} ` +
    `${(valleys[3].x - kH * 0.5).toFixed(1)},${valleys[3].y.toFixed(1)} ` +
    `${valleys[3].x.toFixed(1)},${valleys[3].y.toFixed(1)} ` +
    // valley[3] → spike[4]
    `C${(valleys[3].x + kH * 0.5).toFixed(1)},${valleys[3].y.toFixed(1)} ` +
    `${(spikes[4].x - kH).toFixed(1)},${spikes[4].y.toFixed(1)} ` +
    `${spikes[4].x.toFixed(1)},${spikes[4].y.toFixed(1)} ` +
    // spike[4] → right edge
    `C${(spikes[4].x + kH).toFixed(1)},${spikes[4].y.toFixed(1)} ` +
    `${rEdge.toFixed(1)},${(bandTopY - kV * 0.5).toFixed(1)} ` +
    `${rEdge.toFixed(1)},${bandTopY.toFixed(1)} ` +
    `L${rEdge.toFixed(1)},${baseY.toFixed(1)} Z`
  );
}

// Primary wing (large swept back)
function wingPath(cx, cy, oR, wW, wH, left) {
  const s = left ? -1 : 1;
  return (
    `M${(cx + s * oR).toFixed(1)},${cy.toFixed(1)} ` +
    `C${(cx + s * (oR + wW * 0.4)).toFixed(1)},${(cy - wH * 0.28).toFixed(1)} ` +
    ` ${(cx + s * (oR + wW)).toFixed(1)},${(cy - wH * 0.68).toFixed(1)} ` +
    ` ${(cx + s * (oR + wW * 0.58)).toFixed(1)},${(cy - wH * 0.92).toFixed(1)} ` +
    `L${(cx + s * (oR + wW * 0.18)).toFixed(1)},${(cy - oR * 0.48).toFixed(1)} ` +
    `L${(cx + s * oR).toFixed(1)},${(cy - oR * 0.28).toFixed(1)} Z`
  );
}

// Secondary wing layer (smaller — feather depth)
function wingPath2(cx, cy, oR, wW, wH, left) {
  const s = left ? -1 : 1;
  const sc = 0.65;
  return (
    `M${(cx + s * oR * 0.88).toFixed(1)},${(cy + oR * 0.15).toFixed(1)} ` +
    `C${(cx + s * (oR + wW * 0.28 * sc)).toFixed(1)},${(cy - wH * 0.12 * sc).toFixed(1)} ` +
    ` ${(cx + s * (oR + wW * 0.78 * sc)).toFixed(1)},${(cy - wH * 0.5 * sc).toFixed(1)} ` +
    ` ${(cx + s * (oR + wW * 0.40 * sc)).toFixed(1)},${(cy - wH * 0.68 * sc).toFixed(1)} ` +
    `L${(cx + s * (oR + wW * 0.08 * sc)).toFixed(1)},${(cy - oR * 0.38).toFixed(1)} ` +
    `L${(cx + s * oR * 0.88).toFixed(1)},${(cy - oR * 0.18).toFixed(1)} Z`
  );
}

// Feather quill lines
function featherLinesPath(cx, cy, oR, wW, wH, left, count = 4) {
  const s = left ? -1 : 1;
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.6) / (count + 0.4);
    const bx = cx + s * (oR + wW * t * 0.55);
    const by = cy - wH * t * 0.87;
    const ex = bx - s * wW * 0.2;
    const ey = by + wH * 0.17;
    return `M${bx.toFixed(1)},${by.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`;
  }).join(' ');
}

// Circle path
function circlePath(cx, cy, r) {
  return (
    `M${(cx + r).toFixed(1)},${cy.toFixed(1)} ` +
    `A${r},${r} 0 1 0 ${(cx - r).toFixed(1)},${cy.toFixed(1)} ` +
    `A${r},${r} 0 1 0 ${(cx + r).toFixed(1)},${cy.toFixed(1)} Z`
  );
}

// Single triangular ray
function rayTri(cx, cy, r1, r2, angle, halfW) {
  const p = angle + Math.PI / 2;
  const b1x = cx + r1 * Math.cos(angle) - halfW * Math.cos(p);
  const b1y = cy + r1 * Math.sin(angle) - halfW * Math.sin(p);
  const b2x = cx + r1 * Math.cos(angle) + halfW * Math.cos(p);
  const b2y = cy + r1 * Math.sin(angle) + halfW * Math.sin(p);
  const tx = cx + r2 * Math.cos(angle);
  const ty = cy + r2 * Math.sin(angle);
  return `M${b1x.toFixed(1)},${b1y.toFixed(1)} L${tx.toFixed(1)},${ty.toFixed(1)} L${b2x.toFixed(1)},${b2y.toFixed(1)} Z`;
}

function rayPattern(cx, cy, outerR, rayLen, count, halfW, startAngle = -Math.PI / 2) {
  return Array.from({ length: count }, (_, i) => {
    const a = (2 * Math.PI * i) / count + startAngle;
    return rayTri(cx, cy, outerR, outerR + rayLen, a, halfW);
  }).join(' ');
}

function diamondAt(x, y, r) {
  return (
    `M${x.toFixed(1)},${(y - r).toFixed(1)} ` +
    `L${(x + r * 0.65).toFixed(1)},${y.toFixed(1)} ` +
    `L${x.toFixed(1)},${(y + r).toFixed(1)} ` +
    `L${(x - r * 0.65).toFixed(1)},${y.toFixed(1)} Z`
  );
}

function fourStops(colors) {
  const l = colors.length - 1;
  return [colors[0], colors[Math.round(l * 0.33)] || colors[0], colors[Math.round(l * 0.67)] || colors[l], colors[l]];
}

// ─── FrameAura — animated energy for Legendary tiers ─────────────────────────

const AURA_SHAPES = new Set(['crown', 'wings', 'divine']);

function FrameAura({ cx, cy, outerR, glowColor, auraGradId }) {
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,    duration: 1900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.15, duration: 2600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const particles = useMemo(() => (
    Array.from({ length: 14 }, (_, i) => {
      const a = (2 * Math.PI * i) / 14 - Math.PI / 5;
      const dist = outerR * (1.25 + (i % 4) * 0.13);
      return { x: cx + dist * Math.cos(a), y: cy + dist * Math.sin(a), r: 1.1 + (i % 4) * 0.55, op: 0.28 + (i % 3) * 0.22 };
    })
  ), [cx, cy, outerR]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: pulse }]} pointerEvents="none">
      <Svg width="100%" height="100%" overflow="visible" pointerEvents="none">
        <Defs>
          <RadialGradient id={auraGradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={glowColor} stopOpacity="0.28" />
            <Stop offset="55%"  stopColor={glowColor} stopOpacity="0.09" />
            <Stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={cx} cy={cy} rx={outerR * 2.2} ry={outerR * 2.2} fill={`url(#${auraGradId})`} />
        {particles.map((p, i) => (
          <SvgCircle key={i} cx={p.x} cy={p.y} r={p.r} fill={glowColor} opacity={p.op} />
        ))}
      </Svg>
    </Animated.View>
  );
}

// ─── AvatarFrame ─────────────────────────────────────────────────────────────
//
// Architecture: SVG draws frame ring + inner dark fill.
// Children (avatar letter) render ON TOP of SVG → always visible, always centered.
// Circle shape handled separately (no SVG).

export default function AvatarFrame({ shapeId = 'circle', colorId = 'none', size = 90, children, userInitial }) {
  const color = getColorDef(colorId);
  const shape = getShapeDef(shapeId);

  if (!color.colors) return <>{children}</>;

  const bw       = color.borderWidth;
  const extraPad = shape.extraPad;
  const extraTop = shape.extraTop;
  const totalW   = size + bw * 2 + extraPad * 2;
  const totalH   = totalW + extraTop;
  const cx       = totalW / 2;
  // cy = center of the inner frame (not counting extraTop offset)
  const cy       = extraTop + totalW / 2;
  const outerR   = size / 2 + bw;
  const innerR   = size / 2;
  const gradId   = useRef(`fg-${Math.random().toString(36).slice(2, 7)}`).current;
  const aGradId  = useRef(`ag-${Math.random().toString(36).slice(2, 7)}`).current;
  const stops    = fourStops(color.colors);
  const glowColor = color.glowColor || 'transparent';
  const glowOp   = color.glowColor ? 0.30 : 0;
  const glowW    = bw * 4.5;
  const midColor = color.colors[Math.floor(color.colors.length / 2)];
  const topColor = color.colors[color.colors.length - 1];

  // ── Circle — separate implementation: nested Views for shadow + clip ────────
  if (shapeId === 'circle') {
    const outerSize = size + bw * 2;
    return (
      // Outer View: shadow/glow, NO overflow:hidden (so glow isn't clipped)
      <View style={{
        width: outerSize, height: outerSize,
        borderRadius: outerSize / 2,
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: color.glowColor ? 0.9 : 0,
        shadowRadius: bw * 5,
        elevation: bw * 6,
      }}>
        {/* Gradient ring — clipped to circle by inner overflow:hidden */}
        <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: outerSize / 2, overflow: 'hidden' }}>
          <LinearGradient colors={color.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </View>
        {/* Inner dark background */}
        <View style={{
          position: 'absolute', top: bw, left: bw,
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: BG,
        }} />
        {/* Avatar content — initial letter or children */}
        <View style={{
          position: 'absolute', top: bw, left: bw,
          width: size, height: size, borderRadius: size / 2,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {userInitial
            ? <Text style={{ color: '#FFFFFF', fontSize: size * 0.40, fontWeight: '900' }}>{userInitial}</Text>
            : children}
        </View>
      </View>
    );
  }

  // ── Non-circle: compute paths ─────────────────────────────────────────────
  //
  // SVG draws the frame. Children render AFTER (on top of) the SVG.
  // Exactly 6 Path elements → stable React tree (no reconciliation errors).
  // Per-shape detail encoded as compound paths in extra1D / extra2D.

  let outerD, innerD, extra1D, extra2D;
  let extra1Fill, extra1Op, extra1Stroke, extra1StrokeW;
  let extra2Fill, extra2Op, extra2Stroke, extra2StrokeW;

  extra1D = 'M0,0'; extra1Fill = 'none'; extra1Op = 0; extra1Stroke = 'none'; extra1StrokeW = 0;
  extra2D = 'M0,0'; extra2Fill = 'none'; extra2Op = 0; extra2Stroke = 'none'; extra2StrokeW = 0;

  switch (shapeId) {
    case 'hex':
      outerD = polyPath(cx, cy, outerR, 6, 0);
      innerD = polyPath(cx, cy, innerR, 6, 0);
      break;

    case 'oct':
      outerD = polyPath(cx, cy, outerR, 8, 22.5);
      innerD = polyPath(cx, cy, innerR, 8, 22.5);
      break;

    case 'shield':
      outerD = shieldPath(cx, cy, outerR);
      innerD = shieldPath(cx, cy, innerR);
      break;

    // ── Éclairs — inner hex engraving + spoke lines + tip V-notches ──────────
    case 'spike': {
      const sL = 8;
      outerD = spikePath(cx, cy, outerR * 0.92, outerR + sL);
      innerD = polyPath(cx, cy, innerR, 6, -30);

      const iHexD = polyPath(cx, cy, innerR * 0.78, 6, -30);
      const spokesD = Array.from({ length: 6 }, (_, i) => {
        const a = (2 * Math.PI * i) / 6 - Math.PI / 2;
        const r1 = innerR * 0.32, r2 = innerR * 0.76;
        return `M${(cx + r1 * Math.cos(a)).toFixed(1)},${(cy + r1 * Math.sin(a)).toFixed(1)} L${(cx + r2 * Math.cos(a)).toFixed(1)},${(cy + r2 * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      const tipsD = Array.from({ length: 6 }, (_, i) => {
        const aM = (2 * Math.PI * i) / 6 - Math.PI / 2 + Math.PI / 6;
        const tipX = cx + (outerR + sL) * Math.cos(aM);
        const tipY = cy + (outerR + sL) * Math.sin(aM);
        const arm = 3.5, la = aM - 0.42, ra = aM + 0.42;
        return (
          `M${(tipX - arm * Math.cos(la)).toFixed(1)},${(tipY - arm * Math.sin(la)).toFixed(1)} ` +
          `L${tipX.toFixed(1)},${tipY.toFixed(1)} ` +
          `L${(tipX - arm * Math.cos(ra)).toFixed(1)},${(tipY - arm * Math.sin(ra)).toFixed(1)}`
        );
      }).join(' ');

      extra1D = iHexD + ' ' + spokesD + ' ' + tipsD;
      extra1Fill = 'none'; extra1Op = 0.48;
      extra1Stroke = topColor; extra1StrokeW = 0.7;
      break;
    }

    // ── Néon — chamfered square with double border ────────────────────────────
    case 'neon': {
      const cut = outerR * 0.22;
      outerD = chamfPath(cx, cy, outerR, outerR, cut);
      innerD = chamfPath(cx, cy, innerR, innerR, innerR * 0.22);
      const aR = innerR + bw * 0.38;
      extra1D = chamfPath(cx, cy, aR, aR, aR * 0.22);
      extra1Fill = 'none'; extra1Op = 0.55;
      extra1Stroke = topColor; extra1StrokeW = 1.2;
      break;
    }

    // ── Couronne Royale — 5-spike bezier crown + gems + base band ────────────
    case 'crown': {
      const cH = Math.max(extraTop - 2, 12);
      const cW = outerR * 1.38;
      outerD = polyPath(cx, cy, outerR, 8, 22.5);
      innerD = polyPath(cx, cy, innerR, 8, 22.5);

      const crownTopY = cy - outerR;
      extra1D = sovereignCrown(cx, crownTopY, cH, cW);
      extra1Fill = topColor; extra1Op = 1;

      // Ornament spike + valley positions match sovereignCrown exactly
      const bandTopY2 = crownTopY - cH * 0.22;
      const crownSpikes = [
        { x: cx - cW * 0.90, y: crownTopY - cH * 0.52 },
        { x: cx - cW * 0.46, y: crownTopY - cH * 0.80 },
        { x: cx,             y: crownTopY - cH         },
        { x: cx + cW * 0.46, y: crownTopY - cH * 0.80 },
        { x: cx + cW * 0.90, y: crownTopY - cH * 0.52 },
      ];
      const crownValleys = [
        { x: cx - cW * 0.685, y: bandTopY2 - cH * 0.04 },
        { x: cx - cW * 0.230, y: bandTopY2 - cH * 0.12 },
        { x: cx + cW * 0.230, y: bandTopY2 - cH * 0.12 },
        { x: cx + cW * 0.685, y: bandTopY2 - cH * 0.04 },
      ];
      const gR = 2.5;
      const gemsD = (
        diamondAt(crownSpikes[0].x, crownSpikes[0].y, gR) + ' ' +
        diamondAt(crownSpikes[1].x, crownSpikes[1].y, gR * 1.15) + ' ' +
        diamondAt(crownSpikes[2].x, crownSpikes[2].y, gR * 1.45) + ' ' +
        diamondAt(crownSpikes[3].x, crownSpikes[3].y, gR * 1.15) + ' ' +
        diamondAt(crownSpikes[4].x, crownSpikes[4].y, gR)
      );
      const valleyDotsD = crownValleys.map((v) => circlePath(v.x, v.y, 1.1)).join(' ');
      const sepD = (
        `M${(cx - cW + 4).toFixed(1)},${(bandTopY2 + 1.2).toFixed(1)} ` +
        `L${(cx + cW - 4).toFixed(1)},${(bandTopY2 + 1.2).toFixed(1)} ` +
        `L${(cx + cW - 4).toFixed(1)},${(bandTopY2 + 2.8).toFixed(1)} ` +
        `L${(cx - cW + 4).toFixed(1)},${(bandTopY2 + 2.8).toFixed(1)} Z`
      );
      extra2D = gemsD + ' ' + valleyDotsD + ' ' + sepD;
      extra2Fill = '#FFFFFF'; extra2Op = 0.72;
      break;
    }

    // ── Ailes — primary + secondary + feather quills ──────────────────────────
    case 'wings': {
      const wW = extraPad * 1.85, wH = outerR * 1.42;
      outerD = polyPath(cx, cy, outerR, 6, 0);
      innerD = polyPath(cx, cy, innerR, 6, 0);

      const lw1 = wingPath(cx, cy, outerR, wW, wH, true);
      const rw1 = wingPath(cx, cy, outerR, wW, wH, false);
      const lw2 = wingPath2(cx, cy, outerR, wW, wH, true);
      const rw2 = wingPath2(cx, cy, outerR, wW, wH, false);
      extra1D = lw1 + ' ' + rw1 + ' ' + lw2 + ' ' + rw2;
      extra1Fill = midColor; extra1Op = 0.78;

      const lF = featherLinesPath(cx, cy, outerR, wW, wH, true);
      const rF = featherLinesPath(cx, cy, outerR, wW, wH, false);
      extra2D = lF + ' ' + rF;
      extra2Fill = 'none'; extra2Op = 0.50;
      extra2Stroke = topColor; extra2StrokeW = 0.75;
      break;
    }

    // ── Divin — 8+8 ray star + ornament ring + diamond dots ─────────────────
    case 'divine': {
      const rL = extraPad - 1, rL2 = rL * 0.52;
      const primaryRays   = rayPattern(cx, cy, outerR, rL,  8, 2.6, -Math.PI / 2);
      const secondaryRays = rayPattern(cx, cy, outerR, rL2, 8, 1.4, -Math.PI / 2 + Math.PI / 8);
      extra1D = primaryRays + ' ' + secondaryRays;
      extra1Fill = topColor; extra1Op = 0.88;

      const iRingR = innerR * 0.70;
      const innerRingD = circlePath(cx, cy, iRingR);
      const dotsD = Array.from({ length: 8 }, (_, i) => {
        const a = (2 * Math.PI * i) / 8 - Math.PI / 2;
        return diamondAt(cx + iRingR * Math.cos(a), cy + iRingR * Math.sin(a), 2.4);
      }).join(' ');
      extra2D = innerRingD + ' ' + dotsD;
      extra2Fill = 'none'; extra2Op = 0.55;
      extra2Stroke = topColor; extra2StrokeW = 1.0;

      outerD = circlePath(cx, cy, outerR);
      innerD = circlePath(cx, cy, innerR);
      break;
    }

    default:
      outerD = polyPath(cx, cy, outerR, 6, 0);
      innerD = polyPath(cx, cy, innerR, 6, 0);
  }

  const showAura = AURA_SHAPES.has(shapeId) && !!color.glowColor;

  // Expand SVG physically beyond its container so the glow stroke has room to bleed
  // without being clipped by the SVG bitmap bounds (the "carré PNG" bug).
  // The container keeps its original totalW×totalH footprint; the SVG is offset by
  // -glowPad on top/left, viewBox shifted correspondingly so all path coordinates are
  // unchanged in the SVG coordinate system.
  const glowPad = Math.max(8, Math.round(bw * 5));
  const svgW = totalW + glowPad * 2;
  const svgH = totalH + glowPad * 2;

  return (
    // No shouldRasterizeIOS / renderToHardwareTextureAndroid — those ops rasterize
    // the view to a bitmap exactly its bounds size, clipping any overflow content.
    <View
      style={{ width: totalW, height: totalH, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' }}
    >
      {/* Aura for Legendary tiers — behind frame SVG */}
      {showAura && (
        <FrameAura cx={cx} cy={cy} outerR={outerR} glowColor={glowColor} auraGradId={aGradId} />
      )}

      {/*
        Main frame SVG. Physically svgW×svgH, positioned -glowPad from the container
        top-left so the coordinate origin in the SVG matches the container origin.
        The negative-offset viewBox keeps cx/cy/outerR/innerR unchanged.
        Glow strokes bleed into the extra glowPad margin instead of being cut off.
      */}
      <Svg
        key={`${shapeId}-${colorId}`}
        width={svgW}
        height={svgH}
        viewBox={`${-glowPad} ${-glowPad} ${svgW} ${svgH}`}
        style={{ position: 'absolute', top: -glowPad, left: -glowPad }}
        pointerEvents="none"
      >
        <Defs>
          <SvgGrad id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor={stops[0]} />
            <Stop offset="33%"  stopColor={stops[1]} />
            <Stop offset="67%"  stopColor={stops[2]} />
            <Stop offset="100%" stopColor={stops[3]} />
          </SvgGrad>
        </Defs>
        {/* Extra layer 2: feather lines, ornament rings, gem details */}
        <Path d={extra2D} fill={extra2Fill} stroke={extra2Stroke} strokeWidth={extra2StrokeW} opacity={extra2Op} />
        {/* Extra layer 1: crown body, wing layers, divine rays */}
        <Path d={extra1D} fill={extra1Fill} stroke={extra1Stroke} strokeWidth={extra1StrokeW} opacity={extra1Op} />
        {/* Wide soft glow halo (shape-conforming) */}
        <Path d={outerD} fill="none" stroke={glowColor} strokeWidth={glowW * 2} opacity={glowOp * 0.45} />
        {/* Tight inner glow */}
        <Path d={outerD} fill="none" stroke={glowColor} strokeWidth={glowW}     opacity={glowOp} />
        {/* Frame ring fill */}
        <Path d={outerD} fill={`url(#${gradId})`} />
        {/* Inner dark background — provides contrast behind the avatar letter */}
        <Path d={innerD} fill={BG} />
        {/*
          Initial letter — rendered inside the SVG at the exact geometric center (cx, cy).
          textAnchor="middle" + dominantBaseline="central" guarantee pixel-perfect centering
          regardless of shape, extraPad, or extraTop.
        */}
        {userInitial && (
          <SvgText
            x={cx}
            y={cy}
            textAnchor="middle"
            alignmentBaseline="middle"
            dominantBaseline="central"
            fill="#FFFFFF"
            fontSize={size * 0.40}
            fontWeight="900"
          >
            {userInitial}
          </SvgText>
        )}
      </Svg>

      {/* Children rendered when no userInitial (e.g. image avatar or legacy callers) */}
      {!userInitial && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            width: totalW,
            height: totalW,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          {children}
        </View>
      )}
    </View>
  );
}

// ─── ColorPreview ─────────────────────────────────────────────────────────────

export function ColorPreview({ colorId, size = 44, locked = false }) {
  const color = getColorDef(colorId);
  const bw    = Math.max(1.5, color.borderWidth * 0.65);
  const outer = size + bw * 2;

  if (!color.colors) {
    return (
      <View style={{
        width: outer, height: outer, borderRadius: outer / 2,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: BG, opacity: locked ? 0.35 : 1,
      }} />
    );
  }

  return (
    <View style={{ width: outer, height: outer, borderRadius: outer / 2, overflow: 'hidden', opacity: locked ? 0.35 : 1 }}>
      <LinearGradient colors={color.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: bw, left: bw, width: size, height: size, borderRadius: size / 2, backgroundColor: BG }} />
    </View>
  );
}

// ─── ShapePreview ─────────────────────────────────────────────────────────────

export function ShapePreview({ shapeId, colorId = 'bronze', size = 38, locked = false }) {
  const color    = getColorDef(colorId);
  const shape    = getShapeDef(shapeId);
  const colors   = color.colors || ['#8A9BB0', '#C5D0DC'];
  const stops    = fourStops(colors);
  const bw       = 2.5;
  const outerR   = size / 2 + bw;
  const innerR   = size / 2;
  const pad      = shape.extraPad * 0.5;
  const eTop     = shape.extraTop * 0.4;
  const totalW   = size + bw * 2 + pad * 2;
  const totalH   = totalW + eTop;
  const cx       = totalW / 2;
  const cy       = eTop + totalW / 2;
  const gradId   = `sp-${shapeId}-${colorId}`;
  const midColor = colors[Math.floor(colors.length / 2)];
  const topColor = colors[colors.length - 1];

  let outerD, innerD, extra1D, extra1Fill, extra1Op, extra1Stroke, extra1StrokeW;
  extra1D = 'M0,0'; extra1Fill = 'none'; extra1Op = 0; extra1Stroke = 'none'; extra1StrokeW = 0;

  switch (shapeId) {
    case 'hex':
      outerD = polyPath(cx, cy, outerR, 6, 0);
      innerD = polyPath(cx, cy, innerR, 6, 0);
      break;
    case 'oct':
      outerD = polyPath(cx, cy, outerR, 8, 22.5);
      innerD = polyPath(cx, cy, innerR, 8, 22.5);
      break;
    case 'shield':
      outerD = shieldPath(cx, cy, outerR);
      innerD = shieldPath(cx, cy, innerR);
      break;
    case 'spike': {
      outerD = spikePath(cx, cy, outerR * 0.92, outerR + 5);
      innerD = polyPath(cx, cy, innerR, 6, -30);
      extra1D = polyPath(cx, cy, innerR * 0.78, 6, -30);
      extra1Fill = 'none'; extra1Op = 0.45;
      extra1Stroke = topColor; extra1StrokeW = 0.6;
      break;
    }
    case 'neon': {
      outerD = chamfPath(cx, cy, outerR, outerR, outerR * 0.22);
      innerD = chamfPath(cx, cy, innerR, innerR, innerR * 0.22);
      break;
    }
    case 'crown': {
      const cH = Math.max(eTop - 1, 5);
      const cW = outerR * 1.32;
      outerD = polyPath(cx, cy, outerR, 8, 22.5);
      innerD = polyPath(cx, cy, innerR, 8, 22.5);
      const crownTopY = cy - outerR;
      extra1D = sovereignCrown(cx, crownTopY, cH, cW);
      extra1Fill = topColor; extra1Op = 1;
      break;
    }
    case 'wings': {
      const wingW = outerR * 0.75, wingH = outerR * 0.9;
      outerD = polyPath(cx, cy, outerR, 6, 0);
      innerD = polyPath(cx, cy, innerR, 6, 0);
      const lw1 = wingPath(cx, cy, outerR, wingW, wingH, true);
      const rw1 = wingPath(cx, cy, outerR, wingW, wingH, false);
      const lw2 = wingPath2(cx, cy, outerR, wingW, wingH, true);
      const rw2 = wingPath2(cx, cy, outerR, wingW, wingH, false);
      extra1D = lw1 + ' ' + rw1 + ' ' + lw2 + ' ' + rw2;
      extra1Fill = midColor; extra1Op = 0.78;
      break;
    }
    case 'divine': {
      outerD = circlePath(cx, cy, outerR);
      innerD = circlePath(cx, cy, innerR);
      const rL = Math.max(pad - 1, 3), rL2 = rL * 0.5;
      const pRays = rayPattern(cx, cy, outerR, rL,  8, 2.2, -Math.PI / 2);
      const sRays = rayPattern(cx, cy, outerR, rL2, 8, 1.2, -Math.PI / 2 + Math.PI / 8);
      extra1D = pRays + ' ' + sRays;
      extra1Fill = topColor; extra1Op = 0.85;
      break;
    }
    case 'circle':
      outerD = circlePath(cx, cy, outerR);
      innerD = circlePath(cx, cy, innerR);
      break;
    default:
      outerD = polyPath(cx, cy, outerR, 6, 0);
      innerD = polyPath(cx, cy, innerR, 6, 0);
  }

  return (
    <View style={{ width: totalW, height: totalH, opacity: locked ? 0.35 : 1 }}>
      <Svg key={shapeId} width={totalW} height={totalH}>
        <Defs>
          <SvgGrad id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor={stops[0]} />
            <Stop offset="33%"  stopColor={stops[1]} />
            <Stop offset="67%"  stopColor={stops[2]} />
            <Stop offset="100%" stopColor={stops[3]} />
          </SvgGrad>
        </Defs>
        <Path d={extra1D} fill={extra1Fill} stroke={extra1Stroke} strokeWidth={extra1StrokeW} opacity={extra1Op} />
        <Path d={outerD}  fill={`url(#${gradId})`} />
        <Path d={innerD}  fill={BG} />
      </Svg>
    </View>
  );
}

// Legacy alias
export function FramePreview({ frameId, size = 44, locked = false }) {
  return <ColorPreview colorId={frameId} size={size} locked={locked} />;
}
