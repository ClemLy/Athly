import { Platform } from 'react-native';
import * as SecureStore from "expo-secure-store";
import { TOKEN_KEY } from '@env';

const KEY = TOKEN_KEY || 'jwt';
const SESSION_ONLY_KEY = 'athly_session_only';

// expo-secure-store n'existe pas sur web : fallback localStorage
const isWeb = Platform.OS === 'web';

// Sur le web, "Rester connecté" décoché range le jeton dans sessionStorage :
// il survit à un rafraîchissement de la page et disparaît à la fermeture de
// l'onglet. Coché, il va dans localStorage (persistant).
export async function saveToken(token, { sessionOnly = false } = {}) {
  if (isWeb) {
    const keep = sessionOnly ? sessionStorage : localStorage;
    const drop = sessionOnly ? localStorage : sessionStorage;
    drop.removeItem(KEY);
    keep.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function getToken() {
  if (isWeb) return localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
  return await SecureStore.getItemAsync(KEY);
}

export async function removeToken() {
  if (isWeb) { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); return; }
  await SecureStore.deleteItemAsync(KEY);
}

export async function setSessionOnly(isSessionOnly) {
  if (isWeb) {
    if (isSessionOnly) sessionStorage.setItem(SESSION_ONLY_KEY, 'true');
    else sessionStorage.removeItem(SESSION_ONLY_KEY);
    return;
  }
  if (isSessionOnly) {
    await SecureStore.setItemAsync(SESSION_ONLY_KEY, 'true');
  } else {
    try { await SecureStore.deleteItemAsync(SESSION_ONLY_KEY); } catch {}
  }
}

export async function getSessionOnly() {
  if (isWeb) return sessionStorage.getItem(SESSION_ONLY_KEY) === 'true';
  const val = await SecureStore.getItemAsync(SESSION_ONLY_KEY);
  return val === 'true';
}
