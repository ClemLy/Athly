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
