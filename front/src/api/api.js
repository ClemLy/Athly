import axios from 'axios';
import { API_URL } from '@env';
import { getToken, removeToken } from '../utils/authStorage';

// Référence vers la fonction signOut de AuthContext, injectée au montage du provider.
// Permet à l'intercepteur (code hors-React) de déclencher la déconnexion proprement.
let _signOutCallback = null;
export function setSignOutCallback(fn) { _signOutCallback = fn; }

// Déclenche signOut depuis n'importe quel module (ex: UserContext sur erreur réseau).
export function triggerSignOut() {
  if (_signOutCallback) _signOutCallback();
}

// Message d'erreur affiché à l'utilisateur quand le token est expiré.
export const SESSION_EXPIRED_MSG = 'Votre session a expiré. Veuillez vous reconnecter.';

// Normalise l'URL fournie dans .env et s'assure d'avoir le préfixe `/api`
const normalizedEnv = API_URL ? API_URL.replace(/\/+$/g, '') : '';
const baseURL = normalizedEnv.endsWith('/api')
  ? normalizedEnv
  : normalizedEnv
  ? `${normalizedEnv}/api`
  : '';

// Instance Axios avec timeout et baseURL normalisée
const API = axios.create({
  baseURL,
  timeout: 30000, // 30s — absorbe le cold-start du serveur Render (free tier ~20-30s)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT à chaque requête
API.interceptors.request.use(
  async (config) => {
    // Try to obtain token; if absent, wait a short time and retry a few times
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    let token = await getToken();
    if (!token) {
      // retry up to ~500ms total
      const maxAttempts = 5;
      const delay = 100;
      for (let i = 0; i < maxAttempts && !token; i++) {
        await wait(delay);
        token = await getToken();
      }
    }

    // production: do not log token presence

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur de réponse — gestion centralisée des erreurs + déconnexion JWT
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const err = {
      isAxiosError: error.isAxiosError || false,
      message: error.message,
      code: error.code || null,
    };

    if (error.response) {
      err.status = error.response.status;
      err.statusText = error.response.statusText;
      err.data = error.response.data;
      err.toString = () => `HTTP ${err.status} ${err.statusText}`;

      // ── 401 : token expiré ou invalide → déconnexion automatique ────────────
      if (err.status === 401) {
        const serverMsg = (err.data?.message || '').toLowerCase();
        const isExpired = serverMsg.includes('expired') || serverMsg.includes('jwt')
          || serverMsg.includes('token') || serverMsg.includes('unauthorized');

        if (isExpired || !serverMsg) {
          // Nettoie le token côté client
          try { await removeToken(); } catch { /* ignore */ }
          // Déclenche la déconnexion React (réinitialise le contexte + redirige vers Login)
          if (_signOutCallback) await _signOutCallback();
          // Propage une erreur lisible pour les appelants qui souhaitent réagir
          err.message = SESSION_EXPIRED_MSG;
          err.isSessionExpired = true;
        }
      }

      return Promise.reject(err);
    }

    if (error.request) {
      err.network = true;
      err.message = "Aucune réponse du serveur. Vérifiez votre connexion réseau.";
      return Promise.reject(err);
    }

    return Promise.reject(err);
  }
);

export default API;