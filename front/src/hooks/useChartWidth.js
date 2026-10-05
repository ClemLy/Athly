import { Platform, useWindowDimensions } from 'react-native';

// Largeur disponible pour un graphique, recalculée quand l'écran change
// (rotation, redimensionnement). Sur le web, l'app est plafonnée à 480 px
// (voir App.js) : le graphique ne doit jamais dépasser cette colonne.
const WEB_APP_MAX_WIDTH = 480;

export function useChartWidth(horizontalPadding, minWidth = 200) {
  const { width } = useWindowDimensions();
  const frame = Platform.OS === 'web' ? Math.min(WEB_APP_MAX_WIDTH, width) : width;
  return Math.max(minWidth, frame - horizontalPadding);
}
