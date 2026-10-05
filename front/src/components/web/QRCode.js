import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import { Colors } from '../../constants/theme';

// QR code vectoriel, généré localement (aucun service externe ne voit l'URL).
// Un seul <Path> pour tous les modules : rendu net et léger à toute taille.
export default function QRCode({ value, size = 180, color = Colors.backgroundDeep, background = Colors.textPrimary, margin = 2 }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value || ' ');
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (qr.isDark(row, col)) d += `M${col + margin} ${row + margin}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [value, margin]);

  const total = count + margin * 2;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      accessibilityRole="image"
      accessibilityLabel={`QR code vers ${value}`}
    >
      <Rect x="0" y="0" width={total} height={total} fill={background} />
      <Path d={path} fill={color} />
    </Svg>
  );
}
