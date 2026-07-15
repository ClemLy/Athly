import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  GOOGLE_EXPO_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '@env';

// Ferme proprement l'onglet du navigateur système ouvert par promptAsync()
// une fois l'auth terminée — sans ça l'onglet reste bloqué en attente sur
// certaines plateformes (voir la doc expo-auth-session).
WebBrowser.maybeCompleteAuthSession();

// Clé sessionStorage utilisée pour vérifier l'état retour d'un flux en plein
// écran (voir plus bas — PWA installée). sessionStorage survit à une
// navigation complète de la page (contrairement à un state React), ce qui
// est indispensable ici puisque tout le contexte JS est détruit pendant que
// Google Sign-In s'affiche.
const PENDING_STATE_KEY = 'athly:google:pending_state:v1';

function isStandaloneDisplayMode() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator?.standalone === true; // Safari iOS n'a pas display-mode
  return Boolean(mediaStandalone || iosStandalone);
}

// ─── useGoogleAuth ────────────────────────────────────────────────────────────
// Connexion Google en un clic (Section VIII) : demande un idToken via le SDK
// Expo Auth Session, à envoyer ensuite à POST /api/auth/google (vérifié côté
// serveur — voir back/services/auth.service.js → googleLogin).
//
// Les Client IDs viennent de .env (voir .env.example pour la marche à suivre
// dans Google Cloud Console). Tant qu'ils ne sont pas renseignés, `isConfigured`
// vaut false et le bouton doit rester désactivé côté écran appelant.
//
// ── Cas particulier PWA installée (Section IX) ────────────────────────────
// expo-auth-session ouvre une popup (window.open + postMessage) pour récupérer
// le résultat côté web. Ce mécanisme est fragile depuis une PWA en mode
// standalone (surtout iOS Safari "Ajouter à l'écran d'accueil") : window.open
// y fait souvent sortir l'utilisateur de l'app installée sans jamais pouvoir
// relayer le message à la fenêtre d'origine, et la connexion reste bloquée.
// Dans ce cas précis, on bascule sur une redirection plein écran (navigue
// loin de l'app, puis revient dessus) : l'idToken est alors récupéré au
// prochain montage du hook via le hash de l'URL de retour, pas via la Promise
// de promptAsync (qui ne peut pas survivre au rechargement complet de la page).

export function useGoogleAuth() {
  const isConfigured = Boolean(
    GOOGLE_EXPO_CLIENT_ID || GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_EXPO_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
  });

  const [redirectIdToken, setRedirectIdToken] = useState(null);

  // Récupère un éventuel idToken laissé dans le hash de l'URL par le flux de
  // redirection plein écran (PWA standalone) — vérifié une seule fois au
  // montage, jamais pendant le flux popup normal (le hash n'existe alors pas
  // sur CETTE page, seulement sur la popup).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!window.location.hash || !window.location.hash.includes('id_token=')) return;

    let expectedState = null;
    try { expectedState = window.sessionStorage.getItem(PENDING_STATE_KEY); } catch (_) {}

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const returnedIdToken = hashParams.get('id_token');
    const returnedState   = hashParams.get('state');

    // Nettoie systématiquement l'URL — un idToken ne doit jamais rester
    // visible dans la barre d'adresse ou l'historique du navigateur.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    try { window.sessionStorage.removeItem(PENDING_STATE_KEY); } catch (_) {}

    // Anti-CSRF : le state retourné doit correspondre exactement à celui
    // généré avant la redirection (voir handlePromptAsync ci-dessous).
    if (returnedIdToken && expectedState && returnedState === expectedState) {
      setRedirectIdToken(returnedIdToken);
    }
  }, []);

  const idToken = useMemo(() => {
    if (redirectIdToken) return redirectIdToken;
    if (!response || response.type !== 'success') return null;
    return response.authentication?.idToken || response.params?.id_token || null;
  }, [response, redirectIdToken]);

  const handlePromptAsync = useCallback(async (...args) => {
    if (isStandaloneDisplayMode() && request?.url && request?.state) {
      try { window.sessionStorage.setItem(PENDING_STATE_KEY, request.state); } catch (_) {}
      window.location.assign(request.url);
      // La navigation détruit ce contexte JS avant toute résolution possible —
      // le résultat sera repris par l'effet ci-dessus au prochain montage.
      return { type: 'opened' };
    }
    return promptAsync(...args);
  }, [request, promptAsync]);

  return {
    isConfigured,
    request,
    response,
    idToken,
    promptAsync: handlePromptAsync,
  };
}
