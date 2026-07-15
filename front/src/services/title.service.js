import API from '../api/api';

// ─── Titres déblocables (Section X) ────────────────────────────────────────────

export async function getTitles() {
  const res = await API.get('/profile/titles');
  return res.data;
}

// titleId: string pour équiper, null pour déséquiper.
export async function equipTitle(titleId) {
  const res = await API.post('/profile/equip-title', { titleId });
  return res.data;
}
