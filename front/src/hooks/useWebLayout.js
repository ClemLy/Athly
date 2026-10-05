import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// ─── Détection du contexte d'affichage web ────────────────────────────────────
// Athly est pensée pour le téléphone. Sur un ordinateur (souris + grand écran),
// on affiche la page d'installation ; partout ailleurs (téléphone en portrait
// ou paysage, tablette, PWA installée), l'application.
//
// On se base sur les capacités de l'appareil (pointeur précis + survol) et non
// sur la seule largeur : un téléphone en paysage dépasse 768 px de large mais
// reste un écran tactile.

const DESKTOP_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 768px)';
const STANDALONE_QUERY = '(display-mode: standalone)';
const FORCE_APP_KEY = 'athly:web:force-app';

const canMatch = Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function';

function readForceApp() {
  try { return window.sessionStorage.getItem(FORCE_APP_KEY) === '1'; } catch { return false; }
}

function computeIsDesktop() {
  if (!canMatch) return false;
  if (window.matchMedia(STANDALONE_QUERY).matches) return false;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export function useWebLayout() {
  const [isDesktop, setIsDesktop] = useState(computeIsDesktop);
  const [forceApp, setForceApp] = useState(() => (canMatch ? readForceApp() : false));

  useEffect(() => {
    if (!canMatch) return undefined;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(computeIsDesktop());
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  const openAppAnyway = () => {
    try { window.sessionStorage.setItem(FORCE_APP_KEY, '1'); } catch { /* navigation privée */ }
    setForceApp(true);
  };

  return {
    // Page d'installation : ordinateur, sauf si l'utilisateur a choisi d'essayer l'app
    showInstallPage: isDesktop && !forceApp,
    // App affichée sur un écran large (tablette, ordinateur) : colonne centrée
    isWideScreen: Platform.OS === 'web' && (isDesktop || forceApp),
    openAppAnyway,
  };
}
