import API from '../api/api';

// ─── Lobby Multi (Section VII) ────────────────────────────────────────────────

export async function createLobby() {
  const res = await API.post('/lobby/create');
  return res.data;
}

export async function getLobby(lobbyId) {
  const res = await API.get(`/lobby/${lobbyId}`);
  return res.data;
}

export async function inviteToLobby(lobbyId, friendId) {
  const res = await API.post(`/lobby/${lobbyId}/invite`, { friendId });
  return res.data;
}

export async function joinLobby(lobbyId) {
  const res = await API.post(`/lobby/${lobbyId}/join`);
  return res.data;
}

export async function readyLobby(lobbyId) {
  const res = await API.post(`/lobby/${lobbyId}/ready`);
  return res.data;
}

export async function unreadyLobby(lobbyId) {
  const res = await API.post(`/lobby/${lobbyId}/unready`);
  return res.data;
}

export async function finishLobby(lobbyId) {
  const res = await API.post(`/lobby/${lobbyId}/finish`);
  return res.data;
}
