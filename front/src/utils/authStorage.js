import * as SecureStore from "expo-secure-store";
import { TOKEN_KEY } from '@env';

const KEY = TOKEN_KEY || 'jwt';
const SESSION_ONLY_KEY = 'athly_session_only';

export async function saveToken(token) {
  await SecureStore.setItemAsync(KEY, token);
}

export async function getToken() {
  return await SecureStore.getItemAsync(KEY);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(KEY);
}

export async function setSessionOnly(isSessionOnly) {
  if (isSessionOnly) {
    await SecureStore.setItemAsync(SESSION_ONLY_KEY, 'true');
  } else {
    try { await SecureStore.deleteItemAsync(SESSION_ONLY_KEY); } catch {}
  }
}

export async function getSessionOnly() {
  const val = await SecureStore.getItemAsync(SESSION_ONLY_KEY);
  return val === 'true';
}
