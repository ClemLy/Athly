import API from '../api/api';

// Outil de test God Mode → backend (voir back/controllers/debug.controller.js).
// Aligne xp/level/rank backend sur `level` — jamais exposé en production
// (l'endpoint renvoie 404 côté serveur si NODE_ENV=production).
export async function syncBackendLevel(level) {
  const res = await API.post('/debug/sync-level', { level });
  return res.data;
}

// Crédite `amount` CHEST_KEY dans l'inventaire backend (défaut 1).
export async function giveChests(amount = 1) {
  const res = await API.post('/debug/godmode/give-chests', { amount });
  return res.data;
}

// Génère (ou régénère) un faux réseau social : 2 amis acceptés + 1 demande
// en attente reçue, pour tester Classement/Groupe/Accepter-Refuser.
export async function generateMockSocial() {
  const res = await API.post('/debug/godmode/mock-social');
  return res.data;
}
