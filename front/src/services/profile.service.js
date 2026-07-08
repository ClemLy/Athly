import API from '../api/api';

// Synchronise le cadre de profil équipé (forme + couleur) vers le backend,
// pour qu'il soit visible sur le profil public par les amis (useAvatarFrame
// reste la source de vérité locale pour l'affichage instantané côté soi-même).
export async function updateEquippedFrame(shapeId, colorId) {
  const res = await API.put('/users/me/frame', { shapeId, colorId });
  return res.data;
}

// Met à jour la vitrine de trophées mis en avant sur le profil public (max 3).
export async function updateShowcase(achievementIds) {
  const res = await API.put('/users/me/showcase', { achievementIds });
  return res.data;
}

// Met à jour les records d'exercices mis en avant sur le profil (max 6) —
// affichés identiquement sur son propre profil et le profil vu par les amis.
export async function updateRecordsShowcase(exerciseNames) {
  const res = await API.put('/users/me/records-showcase', { exerciseNames });
  return res.data;
}

// Enregistre (ou efface, si null) le token Expo Push de l'appareil courant —
// nécessaire pour recevoir les notifications réellement envoyées par un
// autre appareil (bouton Secouer, réactions du flux d'activité...).
export async function registerPushToken(pushToken) {
  const res = await API.put('/users/me/push-token', { pushToken });
  return res.data;
}
