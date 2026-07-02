import API from '../api/api';

// Outil de test God Mode → backend (voir back/controllers/debug.controller.js).
// Aligne xp/level/rank backend sur `level` — jamais exposé en production
// (l'endpoint renvoie 404 côté serveur si NODE_ENV=production).
export async function syncBackendLevel(level) {
  const res = await API.post('/debug/sync-level', { level });
  return res.data;
}
