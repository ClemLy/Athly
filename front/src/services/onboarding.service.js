import API from '../api/api';

// ─── Onboarding / Tutoriel interactif ──────────────────────────────────────────
// Marque le tutoriel terminé côté backend — best-effort : la vérité immédiate
// reste AsyncStorage (voir TutorialContext.js), ce flag serveur ne sert que la
// cohérence inter-appareils. Ne jamais bloquer l'UI sur cet appel.
export async function completeOnboarding() {
  const res = await API.post('/users/me/complete-onboarding');
  return res.data;
}
