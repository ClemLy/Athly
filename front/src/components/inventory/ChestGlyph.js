import React, { useRef } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop, Path, Rect, Circle, Ellipse, G,
} from 'react-native-svg';

// ─── Coffre dessiné ───────────────────────────────────────────────────────────
// Bois sombre cerclé de laiton, en relief : ombrage cylindrique (bords sombres,
// centre éclairé), arêtes lumineuses, rivets. Toutes les pièces partagent le
// repère 200 × 200, charnière du couvercle à y = 100 (centre) : l'ouverture
// fait pivoter le couvercle autour de son bord bas (rotateX autour du centre).

let seq = 0;
const useId = (p) => useRef(`${p}${(seq += 1)}`).current;

function WoodAndBrass({ id }) {
  return (
    <Defs>
      {/* Ombrage cylindrique horizontal du bois */}
      <LinearGradient id={`${id}wood`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#2A170A" />
        <Stop offset="0.28" stopColor="#5C3818" />
        <Stop offset="0.5" stopColor="#6E4520" />
        <Stop offset="0.72" stopColor="#5C3818" />
        <Stop offset="1" stopColor="#2A170A" />
      </LinearGradient>
      <LinearGradient id={`${id}woodV`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
        <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0" />
        <Stop offset="1" stopColor="#000000" stopOpacity="0.35" />
      </LinearGradient>
      {/* Laiton poli */}
      <LinearGradient id={`${id}brass`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFE7A3" />
        <Stop offset="0.35" stopColor="#E2A83E" />
        <Stop offset="0.7" stopColor="#A86B1C" />
        <Stop offset="1" stopColor="#6E4210" />
      </LinearGradient>
      <LinearGradient id={`${id}brassH`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#8A5616" />
        <Stop offset="0.5" stopColor="#F3C565" />
        <Stop offset="1" stopColor="#8A5616" />
      </LinearGradient>
      <RadialGradient id={`${id}stud`} cx="35%" cy="30%" r="70%">
        <Stop offset="0" stopColor="#FFF4CC" />
        <Stop offset="0.5" stopColor="#D9A040" />
        <Stop offset="1" stopColor="#6E4210" />
      </RadialGradient>
    </Defs>
  );
}

const studs = (pts, id) => pts.map(([x, y]) => (
  <G key={`${x}-${y}`}>
    <Circle cx={x} cy={y + 0.6} r={3} fill="#000" opacity={0.35} />
    <Circle cx={x} cy={y} r={2.8} fill={`url(#${id}stud)`} />
  </G>
));

export function ChestLid({ size }) {
  const id = useId('cl');
  const lid = 'M30,100 L30,72 C30,47 60,38 100,38 C140,38 170,47 170,72 L170,100 Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <WoodAndBrass id={id} />
      <Path d={lid} fill={`url(#${id}wood)`} />
      <Path d={lid} fill={`url(#${id}woodV)`} />
      {/* Lattes du couvercle */}
      <Path d="M34,66 C60,52 140,52 166,66 M31,84 L169,84" stroke="#000" strokeOpacity={0.3} strokeWidth={1.2} fill="none" />
      {/* Bandes de laiton qui épousent la courbe */}
      <Path d="M52,100 L52,51 C55,48.5 59,47 64,45.8 L64,100 Z" fill={`url(#${id}brass)`} />
      <Path d="M148,100 L148,51 C145,48.5 141,47 136,45.8 L136,100 Z" fill={`url(#${id}brass)`} />
      <Path d="M52,100 L52,51 M148,100 L148,51" stroke="#FFF4CC" strokeOpacity={0.55} strokeWidth={0.8} />
      {/* Cerclage bas du couvercle */}
      <Rect x="27" y="92" width="146" height="9" rx="2.5" fill={`url(#${id}brassH)`} />
      <Rect x="27" y="92" width="146" height="1.4" rx="0.7" fill="#FFF4CC" opacity={0.6} />
      {/* Arête lumineuse du sommet */}
      <Path d="M38,64 C44,48 70,41 100,41 C130,41 156,48 162,64" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={2} fill="none" />
      <Path d={lid} fill="none" stroke="#120802" strokeWidth={1.4} strokeOpacity={0.9} />
      {studs([[58, 62], [58, 80], [142, 62], [142, 80]], id)}
    </Svg>
  );
}

export function ChestBody({ size }) {
  const id = useId('cb');
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <WoodAndBrass id={id} />
      <Rect x="30" y="100" width="140" height="68" rx="5" fill={`url(#${id}wood)`} />
      <Rect x="30" y="100" width="140" height="68" rx="5" fill={`url(#${id}woodV)`} />
      <Path d="M31,123 L169,123 M31,146 L169,146" stroke="#000" strokeOpacity={0.32} strokeWidth={1.2} />
      <Path d="M31,124.2 L169,124.2 M31,147.2 L169,147.2" stroke="#FFF" strokeOpacity={0.06} strokeWidth={1} />
      {/* Bandes verticales */}
      <Rect x="52" y="100" width="12" height="68" fill={`url(#${id}brass)`} />
      <Rect x="136" y="100" width="12" height="68" fill={`url(#${id}brass)`} />
      {/* Cerclage bas + équerres */}
      <Rect x="27" y="160" width="146" height="10" rx="3" fill={`url(#${id}brassH)`} />
      <Path d="M27,138 L27,170 L44,170 L44,163 L34,163 L34,138 Z M173,138 L173,170 L156,170 L156,163 L166,163 L166,138 Z" fill={`url(#${id}brass)`} />
      {/* Serrure */}
      <Path d="M84,97 L116,97 L116,121 Q116,132 100,137 Q84,132 84,121 Z" fill="#000" opacity={0.4} transform="translate(0,1.5)" />
      <Path d="M84,97 L116,97 L116,121 Q116,132 100,137 Q84,132 84,121 Z" fill={`url(#${id}brass)`} />
      <Path d="M86,99 L114,99" stroke="#FFF4CC" strokeOpacity={0.7} strokeWidth={1} />
      <Circle cx="100" cy="111" r="4.2" fill="#1A0E04" />
      <Path d="M98,113 L102,113 L103.4,124 L96.6,124 Z" fill="#1A0E04" />
      <Rect x="30" y="100" width="140" height="68" rx="5" fill="none" stroke="#120802" strokeWidth={1.4} strokeOpacity={0.9} />
      {studs([[58, 112], [58, 135], [142, 112], [142, 135]], id)}
    </Svg>
  );
}

// Lumière qui filtre par la serrure et la jointure (charge).
export function ChestLeak({ size, color }) {
  const id = useId('lk');
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity="0.9" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="100" cy="100" rx="78" ry="7" fill={`url(#${id}g)`} />
      <Rect x="32" y="99" width="136" height="2.2" fill={color} opacity={0.95} />
      <Circle cx="100" cy="114" r="14" fill={`url(#${id}g)`} />
      <Circle cx="100" cy="111" r="3.4" fill="#FFFFFF" />
      <Path d="M98.6,113 L101.4,113 L102.4,123 L97.6,123 Z" fill="#FFFFFF" />
    </Svg>
  );
}

// Intérieur lumineux, visible une fois le couvercle levé.
export function ChestInterior({ size, color }) {
  const id = useId('ci');
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id={`${id}g`} cx="50%" cy="60%" r="55%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="0.35" stopColor={color} stopOpacity="0.95" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="100" cy="100" rx="70" ry="10" fill="#120802" />
      <Ellipse cx="100" cy="99" rx="66" ry="9" fill={`url(#${id}g)`} />
    </Svg>
  );
}

// Ombre de contact sous le coffre.
export function ChestShadow({ size }) {
  const id = useId('cs');
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#000" stopOpacity="0.7" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="100" cy="171" rx="86" ry="10" fill={`url(#${id}g)`} />
    </Svg>
  );
}

// Coffre complet, statique (inventaire, aperçus).
export default function ChestGlyph({ size = 64, dimmed = false }) {
  return (
    <View style={{ width: size, height: size, opacity: dimmed ? 0.45 : 1 }}>
      <View style={{ position: 'absolute' }}><ChestShadow size={size} /></View>
      <View style={{ position: 'absolute' }}><ChestBody size={size} /></View>
      <View style={{ position: 'absolute' }}><ChestLid size={size} /></View>
    </View>
  );
}
