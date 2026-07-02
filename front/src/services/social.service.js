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

// ─── Parrainage (Brique III) ──────────────────────────────────────────────────

export async function claimReferral(code) {
  const res = await API.post('/referral/claim', { code });
  return res.data;
}
