import * as Haptics from 'expo-haptics';

// ─── Service Haptique centralisé (Section X) ───────────────────────────────────
// Point d'entrée unique pour tous les retours physiques de l'app — évite de
// ré-écrire `try { Haptics.xxxAsync(...) } catch {}` à chaque appel. Web n'a
// pas de vibreur (expo-haptics y est un no-op silencieux), donc aucune garde
// de plateforme n'est nécessaire ici.
//
// Intensités volontairement poussées au maximum de ce qu'expose expo-haptics
// (retour jugé trop discret en usage réel) — pas de Light/selectionAsync seul,
// qui passent quasi inaperçus sur la plupart des téléphones :
//  - success() : action réussie (série cochée, clic d'action, bouton rapide) —
//                impact Medium, net et immédiat.
//  - heavy()   : moment marquant (clôture de séance, level-up, ouverture de
//                coffre, déblocage de titre) — double impact Heavy.
//  - error()   : erreur / avertissement (pseudo injurieux, annulation d'abandon) —
//                impact Heavy + triple vibration d'avertissement.
//  - selection(): feedback de sélection neutre (toggle, tap sur une liste) —
//                garde le primitif le plus léger, utilisé avec parcimonie.

async function success() {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
}

async function heavy() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); }, 90);
  } catch (_) {}
}

async function error() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (_) {}
}

async function selection() {
  try { await Haptics.selectionAsync(); } catch (_) {}
}

export const haptics = { success, heavy, error, selection };
