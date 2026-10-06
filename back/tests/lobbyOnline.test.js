'use strict';

// Mode en ligne : quitter une séance Multi, invitations visibles dans l'app,
// classement de la semaine.

const request      = require('supertest');
const mongoose     = require('mongoose');
const app          = require('../app');
const User         = require('../models/User');
const Friendship   = require('../models/Friendship');
const WorkoutLobby = require('../models/WorkoutLobby');
const Workout      = require('../models/Workout');

async function createAndLoginUser(pseudo, email) {
  await request(app).post('/api/auth/register').send({ pseudo, email, password: 'Password123!' });
  await User.updateOne({ email }, { isVerified: true });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

const befriend = (a, b) => Friendship.create({ requester: a.userId, recipient: b.userId, status: 'accepted' });
const post = (url, who, body) => request(app).post(url).set('Authorization', `Bearer ${who.token}`).send(body || {});
const get = (url, who) => request(app).get(url).set('Authorization', `Bearer ${who.token}`);

describe('Mode en ligne — Multi & classement', () => {
  let alice, bob, carol;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await WorkoutLobby.deleteMany({});
    await Workout.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await WorkoutLobby.deleteMany({});
    await Workout.deleteMany({});
    alice = await createAndLoginUser('AliceOnline', 'alice.online@athly.fr');
    bob   = await createAndLoginUser('BobOnline', 'bob.online@athly.fr');
    carol = await createAndLoginUser('CarolOnline', 'carol.online@athly.fr');
    await befriend(alice, bob);
    await befriend(alice, carol);
  });

  async function lobbyWith(members) {
    const res = await post('/api/lobby/create', members[0]);
    const id = res.body.lobby._id;
    for (const m of members.slice(1)) await post(`/api/lobby/${id}/join`, m);
    return id;
  }

  describe('POST /api/lobby/:id/leave', () => {
    it('✅ Salon : le membre parti ne bloque plus le démarrage', async () => {
      const id = await lobbyWith([alice, bob, carol]);
      await post(`/api/lobby/${id}/ready`, alice);
      await post(`/api/lobby/${id}/ready`, bob);

      const res = await post(`/api/lobby/${id}/leave`, carol);
      expect(res.statusCode).toBe(200);

      const lobby = await WorkoutLobby.findById(id);
      expect(lobby.memberCount).toBe(2);
      expect(lobby.status).toBe('active');
    });

    it("✅ L'hôte qui part transmet son rôle", async () => {
      const id = await lobbyWith([alice, bob]);
      await post(`/api/lobby/${id}/leave`, alice);
      const lobby = await WorkoutLobby.findById(id);
      expect(lobby.creatorId.toString()).toBe(bob.userId);
      expect(lobby.status).toBe('waiting');
    });

    it('✅ Un salon vide est supprimé', async () => {
      const id = await lobbyWith([alice]);
      await post(`/api/lobby/${id}/leave`, alice);
      expect(await WorkoutLobby.findById(id)).toBeNull();
    });

    it('✅ Séance en cours : si les restants ont fini, elle est clôturée pour eux', async () => {
      const id = await lobbyWith([alice, bob, carol]);
      for (const m of [alice, bob, carol]) await post(`/api/lobby/${id}/ready`, m);
      await post(`/api/lobby/${id}/finish`, alice);
      await post(`/api/lobby/${id}/finish`, bob);

      await post(`/api/lobby/${id}/leave`, carol);

      const lobby = await WorkoutLobby.findById(id);
      expect(lobby.status).toBe('completed');
      expect(lobby.memberCount).toBe(2);
      expect(lobby.xpBonusPercent).toBe(0.15);
    });

    it('✅ Idempotent : quitter deux fois ou un salon inconnu répond 200', async () => {
      const id = await lobbyWith([alice, bob]);
      expect((await post(`/api/lobby/${id}/leave`, bob)).statusCode).toBe(200);
      expect((await post(`/api/lobby/${id}/leave`, bob)).statusCode).toBe(200);
      expect((await post(`/api/lobby/${new mongoose.Types.ObjectId()}/leave`, bob)).statusCode).toBe(200);
    });
  });

  describe('Invitations dans l\'app', () => {
    it('✅ Une invitation apparaît pour l\'ami invité, avec son auteur', async () => {
      const id = await lobbyWith([alice]);
      await post(`/api/lobby/${id}/invite`, alice, { friendId: bob.userId });

      const res = await get('/api/lobby/invites', bob);
      expect(res.statusCode).toBe(200);
      expect(res.body.invites).toHaveLength(1);
      expect(res.body.invites[0].lobbyId).toBe(id);
      expect(res.body.invites[0].from.pseudo).toBe('AliceOnline');
      expect(res.body.invites[0].memberCount).toBe(1);
    });

    it('✅ Rejoindre consomme l\'invitation', async () => {
      const id = await lobbyWith([alice]);
      await post(`/api/lobby/${id}/invite`, alice, { friendId: bob.userId });
      await post(`/api/lobby/${id}/join`, bob);
      expect((await get('/api/lobby/invites', bob)).body.invites).toHaveLength(0);
    });

    it('✅ Ignorer retire l\'invitation', async () => {
      const id = await lobbyWith([alice]);
      await post(`/api/lobby/${id}/invite`, alice, { friendId: bob.userId });
      expect((await post(`/api/lobby/${id}/decline`, bob)).statusCode).toBe(200);
      expect((await get('/api/lobby/invites', bob)).body.invites).toHaveLength(0);
    });

    it('✅ Une séance déjà démarrée n\'est plus proposée', async () => {
      const id = await lobbyWith([alice, carol]);
      await post(`/api/lobby/${id}/invite`, alice, { friendId: bob.userId });
      await post(`/api/lobby/${id}/ready`, alice);
      await post(`/api/lobby/${id}/ready`, carol);
      expect((await get('/api/lobby/invites', bob)).body.invites).toHaveLength(0);
    });

    it('❌ 422 si l\'ami est déjà dans la séance', async () => {
      const id = await lobbyWith([alice, bob]);
      const res = await post(`/api/lobby/${id}/invite`, alice, { friendId: bob.userId });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('GET /api/friends/leaderboard?period=week', () => {
    it('✅ Classe par XP gagnée depuis lundi, séances comptées', async () => {
      await User.updateOne({ _id: alice.userId }, { xp: 50000 });
      await Workout.create([
        { user: bob.userId, name: 'S1', status: 'finished', xpEarned: 300, date: new Date() },
        { user: bob.userId, name: 'S2', status: 'finished', xpEarned: 200, date: new Date() },
        { user: alice.userId, name: 'S3', status: 'finished', xpEarned: 100, date: new Date() },
        { user: alice.userId, name: 'Vieille', status: 'finished', xpEarned: 9999, date: new Date(Date.now() - 40 * 86400000) },
        { user: carol.userId, name: 'En cours', status: 'in_progress', xpEarned: 999, date: new Date() },
      ]);

      const res = await get('/api/friends/leaderboard?period=week', alice);
      expect(res.statusCode).toBe(200);
      const [first, second, third] = res.body.leaderboard;
      expect(first.user.pseudo).toBe('BobOnline');
      expect(first.weeklyXp).toBe(500);
      expect(first.weeklySessions).toBe(2);
      expect(second.user.pseudo).toBe('AliceOnline');
      expect(second.weeklyXp).toBe(100);
      expect(second.isMe).toBe(true);
      expect(third.weeklyXp).toBe(0);
    });

    it('✅ Sans paramètre : classement XP total inchangé', async () => {
      await User.updateOne({ _id: carol.userId }, { xp: 9000 });
      const res = await get('/api/friends/leaderboard', alice);
      expect(res.body.leaderboard[0].user.pseudo).toBe('CarolOnline');
      expect(res.body.leaderboard[0].weeklyXp).toBeUndefined();
    });
  });
});
