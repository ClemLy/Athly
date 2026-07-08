import API from '../api/api';

// ─── Suivi de poids (Section VI) ──────────────────────────────────────────────

export async function getWeightHistory() {
  const res = await API.get('/weight/history');
  return res.data;
}

// `date` optionnelle (ISO string) — permet une saisie rétroactive depuis la
// modale de rappel hebdomadaire sans forcer "aujourd'hui".
export async function logWeight(weight, date) {
  const res = await API.post('/weight', date ? { weight, date } : { weight });
  return res.data;
}
