import API from '../api/api';

// Synchronise le cadre de profil équipé (forme + couleur) vers le backend,
// pour qu'il soit visible sur le profil public par les amis (useAvatarFrame
// reste la source de vérité locale pour l'affichage instantané côté soi-même).
export async function updateEquippedFrame(shapeId, colorId) {
  const res = await API.put('/users/me/frame', { shapeId, colorId });
  return res.data;
}

// Synchronise la vitrine de trophées (max 3 IDs) vers le backend, pour
// qu'elle soit visible en haut du profil public par les amis.
export async function updateShowcase(achievementIds) {
  const res = await API.put('/users/me/showcase', { achievementIds });
  return res.data;
}
