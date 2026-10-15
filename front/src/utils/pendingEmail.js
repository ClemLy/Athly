import AsyncStorage from '@react-native-async-storage/async-storage';

// Adresse en attente de confirmation : l'URL de la PWA ne garde pas les
// paramètres d'écran, on la conserve pour survivre à un rechargement de page.
const KEY = 'athly:pendingVerifyEmail:v1';

export function rememberPendingEmail(email) {
  AsyncStorage.setItem(KEY, email).catch(() => {});
}

export async function readPendingEmail() {
  try { return (await AsyncStorage.getItem(KEY)) || ''; } catch { return ''; }
}

export function clearPendingEmail() {
  AsyncStorage.removeItem(KEY).catch(() => {});
}
