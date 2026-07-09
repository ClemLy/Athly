import { useMemo } from 'react';
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

// ─── useGoogleAuth ────────────────────────────────────────────────────────────
// Connexion Google en un clic (Section VIII) : demande un idToken via le SDK
// Expo Auth Session, à envoyer ensuite à POST /api/auth/google (vérifié côté
// serveur — voir back/services/auth.service.js → googleLogin).
//
// Les Client IDs viennent de .env (voir .env.example pour la marche à suivre
// dans Google Cloud Console). Tant qu'ils ne sont pas renseignés, `isConfigured`
// vaut false et le bouton doit rester désactivé côté écran appelant.

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

  const idToken = useMemo(() => {
    if (!response || response.type !== 'success') return null;
    return response.authentication?.idToken || response.params?.id_token || null;
  }, [response]);

  return {
    isConfigured,
    request,
    response,
    idToken,
    promptAsync,
  };
}
