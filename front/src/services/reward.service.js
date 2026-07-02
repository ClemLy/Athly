import API from '../api/api';

// Enregistre la date de naissance (une seule fois — verrouillée côté backend).
export async function setBirthdate(dateISO) {
  const res = await API.post('/rewards/birthdate', { birthdate: dateISO });
  return res.data;
}

// À appeler au login / au chargement de l'app : vérifie si c'est le jour J
// et accorde le cadeau d'anniversaire (une fois par an).
export async function checkBirthday() {
  const res = await API.post('/rewards/birthday/check');
  return res.data;
}

export async function getAchievements() {
  const res = await API.get('/rewards/achievements');
  return res.data;
}
