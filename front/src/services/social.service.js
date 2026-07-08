import API from '../api/api';

// ─── Amis (Brique III) ────────────────────────────────────────────────────────

export async function searchUsers(query) {
  const res = await API.get(`/friends/search?q=${encodeURIComponent(query)}`);
  return res.data;
}

export async function sendFriendRequest(friendId) {
  const res = await API.post('/friends/request', { friendId });
  return res.data;
}

export async function acceptFriendRequest(requestId) {
  const res = await API.put(`/friends/accept/${requestId}`);
  return res.data;
}

export async function declineFriendRequest(requestId) {
  const res = await API.put(`/friends/decline/${requestId}`);
  return res.data;
}

// Annule une demande d'ami que J'AI ENVOYÉE (pendant du "refuser" côté destinataire).
export async function cancelFriendRequest(requestId) {
  const res = await API.delete(`/friends/request/${requestId}`);
  return res.data;
}

// Retire un ami (rompt une amitié acceptée) — l'un ou l'autre membre peut le faire.
export async function removeFriend(friendshipId) {
  const res = await API.delete(`/friends/${friendshipId}`);
  return res.data;
}

export async function getFriendsList() {
  const res = await API.get('/friends/list');
  return res.data;
}

export async function getPendingRequests() {
  const res = await API.get('/friends/pending');
  return res.data;
}

export async function getFriendProfile(friendId) {
  const res = await API.get(`/friends/profile/${friendId}`);
  return res.data;
}

export async function getLeaderboard() {
  const res = await API.get('/friends/leaderboard');
  return res.data;
}

// Classement par exercice au sein du réseau d'amis (meilleur poids soulevé).
export async function getExerciseLeaderboard(exercise) {
  const res = await API.get(`/exercises/leaderboard?exercise=${encodeURIComponent(exercise)}`);
  return res.data;
}

// Tous mes records (un par exercice déjà pratiqué) — alimente le sélecteur
// "mettre en avant jusqu'à 6 records" du profil.
export async function getMyRecords() {
  const res = await API.get('/exercises/my-records');
  return res.data;
}

// ─── Groupes de Streak (Brique IV) ────────────────────────────────────────────

export async function getMyGroup() {
  const res = await API.get('/groups/my-group');
  return res.data;
}

export async function inviteToGroup(friendIds, name) {
  const res = await API.post('/groups/invite', { friendIds, name });
  return res.data;
}

export async function respondToGroupInvite(groupId, accept) {
  const res = await API.put(`/groups/respond/${groupId}`, { accept });
  return res.data;
}

export async function shakeMember(groupId, memberId) {
  const res = await API.post(`/groups/${groupId}/shake/${memberId}`);
  return res.data;
}

export async function checkGroupStreak(groupId) {
  const res = await API.post(`/groups/${groupId}/check-streak`);
  return res.data;
}

export async function leaveGroup() {
  const res = await API.post('/groups/leave');
  return res.data;
}

// ─── Flux d'activité « Taquineries & High-Fives » (Brique IV) ─────────────────

export async function getActivityFeed() {
  const res = await API.get('/activity/feed');
  return res.data;
}

export async function reactToActivityEvent(eventId, emoji) {
  const res = await API.post(`/activity/${eventId}/react`, { emoji });
  return res.data;
}

// ─── Parrainage (Brique III) ──────────────────────────────────────────────────

export async function claimReferral(code) {
  const res = await API.post('/referral/claim', { code });
  return res.data;
}
