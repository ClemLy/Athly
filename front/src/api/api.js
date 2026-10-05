import axios from 'axios';
import { API_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, removeToken } from '../utils/authStorage';
import {
  describeApiError,
  NETWORK_ERROR_MSG,
  SESSION_EXPIRED_MSG as SESSION_EXPIRED_TEXT,
} from '../utils/errorMessages';

// ── Cache réseau dégradé ──────────────────────────────────────────────────────
// Chaque réponse GET réussie est mise en cache. Si le réseau tombe (serveur
// down, offline, cold-start Render), les GET sont servis depuis ce cache avec
// `fromCache: true` au lieu d'échouer → l'UI affiche un état "stale" au lieu
// d'un écran d'erreur. Le cache est purgé à la déconnexion (purgeApiCache).
const API_CACHE_PREFIX = 'athly:apicache:v1:';

async function readApiCache(url) {
  try {
    const raw = await AsyncStorage.getItem(API_CACHE_PREFIX + url);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeApiCache(url, data) {
  // Fire-and-forget : un échec d'écriture du cache ne doit rien bloquer
  AsyncStorage.setItem(API_CACHE_PREFIX + url, JSON.stringify(data)).catch(() => {});
}

// À appeler à la déconnexion : aucune donnée utilisateur ne doit survivre
// dans le cache sur un appareil partagé.
export async function purgeApiCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(API_CACHE_PREFIX));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch {
    // best effort
  }
}

// ── Suivi des requêtes lentes ────────────────────────────────────────────────
// Le serveur (offre gratuite Render) s'endort après une période d'inactivité :
// la première requête peut prendre 20 à 30 s. Au-delà de SLOW_REQUEST_MS, on
// prévient l'interface (ConnectionBanner) pour expliquer l'attente au lieu de
// laisser croire que l'app est bloquée.
const SLOW_REQUEST_MS = 4000;
const pendingRequests = new Map(); // id → timer
const slowListeners = new Set();
let slowState = false;
let requestSeq = 0;

function setSlow(next) {
  if (slowState === next) return;
  slowState = next;
  slowListeners.forEach((fn) => fn(next));
}

export function subscribeSlowRequests(fn) {
  slowListeners.add(fn);
  fn(slowState);
  return () => slowListeners.delete(fn);
}

function trackStart(config) {
  const id = ++requestSeq;
  config.__athlyRequestId = id;
  pendingRequests.set(id, setTimeout(() => setSlow(true), SLOW_REQUEST_MS));
}

function trackEnd(config) {
  const id = config && config.__athlyRequestId;
  if (id && pendingRequests.has(id)) {
    clearTimeout(pendingRequests.get(id));
    pendingRequests.delete(id);
  }
  if (pendingRequests.size === 0) setSlow(false);
}

// Référence vers la fonction signOut de AuthContext, injectée au montage du provider.
// Permet à l'intercepteur (code hors-React) de déclencher la déconnexion proprement.
let _signOutCallback = null;
export function setSignOutCallback(fn) { _signOutCallback = fn; }

// Déclenche signOut depuis n'importe quel module (ex: UserContext sur erreur réseau).
export function triggerSignOut() {
  if (_signOutCallback) _signOutCallback();
}

// Message d'erreur affiché à l'utilisateur quand le token est expiré.
export const SESSION_EXPIRED_MSG = SESSION_EXPIRED_TEXT;

// API de production (même valeur que eas.json) : utilisée si le build web a été
// lancé sans variable API_URL (ex : oubli dans les réglages Vercel), pour que
// l'app déployée ne tape jamais dans le vide sur sa propre origine.
const PRODUCTION_API_URL = 'https://athly-api.onrender.com/api';

// Normalise l'URL fournie dans .env et s'assure d'avoir le préfixe `/api`
const rawApiUrl = API_URL || (process.env.NODE_ENV === 'production' ? PRODUCTION_API_URL : '');
const normalizedEnv = rawApiUrl ? rawApiUrl.replace(/\/+$/g, '') : '';
const baseURL = normalizedEnv.endsWith('/api')
  ? normalizedEnv
  : normalizedEnv
  ? `${normalizedEnv}/api`
  : '';

// Instance Axios avec timeout et baseURL normalisée
const API = axios.create({
  baseURL,
  timeout: 30000, // 30 s : absorbe le démarrage à froid du serveur Render (offre gratuite, ~20-30 s)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Routes d'authentification : publiques. Un 401 y signifie "identifiants
// incorrects", jamais "session expirée" (aucune session n'existe encore).
const AUTH_ROUTE_PATTERN = /^\/?auth\//;

// Intercepteur pour ajouter le token JWT à chaque requête
API.interceptors.request.use(
  async (config) => {
    let token = await getToken();

    // Juste après la connexion, le token peut ne pas être encore écrit : on
    // patiente brièvement (500 ms max), sauf sur les routes publiques d'auth
    // qui n'en ont pas besoin (sinon chaque connexion prendrait 500 ms de plus).
    if (!token && !AUTH_ROUTE_PATTERN.test(config.url || '')) {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      for (let i = 0; i < 5 && !token; i++) {
        await wait(100);
        token = await getToken();
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    trackStart(config);
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur de réponse : gestion centralisée des erreurs + déconnexion JWT.
// Toute erreur rejetée porte `userMessage` (et `message`), une phrase lisible
// prête à afficher (voir utils/errorMessages.js).
API.interceptors.response.use(
  (response) => {
    trackEnd(response.config);
    // Alimente le cache dégradé avec les GET réussis
    if (response.config?.method === 'get' && response.config?.url) {
      writeApiCache(response.config.url, response.data);
    }
    return response;
  },
  async (error) => {
    trackEnd(error.config);
    const err = {
      isAxiosError: error.isAxiosError || false,
      code: error.code || null,
    };

    if (error.response) {
      err.status = error.response.status;
      err.statusText = error.response.statusText;
      err.data = error.response.data;
      err.userMessage = describeApiError(error);
      err.message = err.userMessage;
      err.toString = () => `HTTP ${err.status} ${err.statusText}`;

      // ── 401 hors routes d'auth : session expirée → déconnexion automatique ──
      const url = error.config?.url || '';
      if (err.status === 401 && !AUTH_ROUTE_PATTERN.test(url)) {
        try { await removeToken(); } catch { /* ignore */ }
        if (_signOutCallback) await _signOutCallback();
        err.userMessage = SESSION_EXPIRED_MSG;
        err.message = SESSION_EXPIRED_MSG;
        err.isSessionExpired = true;
      }

      return Promise.reject(err);
    }

    if (error.request) {
      err.network = true;
      err.userMessage = describeApiError(error);
      err.message = err.userMessage || NETWORK_ERROR_MSG;

      // ── Mode dégradé : GET en échec réseau → réponse servie depuis le cache ──
      const cfg = error.config;
      if (cfg?.method === 'get' && cfg?.url) {
        const cached = await readApiCache(cfg.url);
        if (cached !== null) {
          return Promise.resolve({
            data:      cached,
            status:    200,
            fromCache: true,
            config:    cfg,
          });
        }
      }

      return Promise.reject(err);
    }

    err.userMessage = describeApiError(null);
    err.message = err.userMessage;
    return Promise.reject(err);
  }
);

export default API;