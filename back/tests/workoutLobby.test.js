'use strict';

const request       = require('supertest');
const mongoose      = require('mongoose');
const app           = require('../app');
const User          = require('../models/User');
const Friendship    = require('../models/Friendship');
const WorkoutLobby  = require('../models/WorkoutLobby');

async function createAndLoginUser(pseudo, email) {
  await request(app).post('/api/auth/register').send({ pseudo, email, password: 'Password123!' });
  await User.updateOne({ email }, { isVerified: true });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

async function makeFriends(a, b) {
  return Friendship.create({ requester: a, recipient: b, status: 'accepted' });
}

describe('Lobby Multi — Section VII', () => {
  let alice, bob, carol, dave;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await WorkoutLobby.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await WorkoutLobby.deleteMany({});
    alice = await createAndLoginUser('AliceMulti', 'alice.multi@athly.fr');
    bob   = await createAndLoginUser('BobMulti', 'bob.multi@athly.fr');
    carol = await createAndLoginUser('CarolMulti', 'carol.multi@athly.fr');
    dave  = await createAndLoginUser('DaveMulti', 'dave.multi@athly.fr');
  });

  describe('POST /api/lobby/create', () => {
    it('✅ Crée un lobby waiting avec le créateur comme premier membre', async () => {
      const res = await request(app)
        .post('/api/lobby/create')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(201);
      expect(res.body.lobby.status).toBe('waiting');
      expect(res.body.lobby.memberCount).toBe(1);
      expect(res.body.lobby.members[0].user._id).toBe(alice.userId);
      expect(res.body.lobby.members[0].status).toBe('waiting');
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/lobby/create');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/lobby/:id/invite', () => {
    let lobbyId;
    beforeEach(async () => {
      const res = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${alice.token}`);
      lobbyId = res.body.lobby._id;
    });

    it('✅ Envoie une invitation à un ami accepté (best-effort push)', async () => {
      await makeFriends(alice.userId, bob.userId);

      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/invite`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/BobMulti/);
    });

    it("❌ 403 si la cible n'est pas un ami accepté", async () => {
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/invite`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      expect(res.statusCode).toBe(403);
    });

    it("❌ 403 si l'appelant ne fait pas partie du lobby", async () => {
      await makeFriends(bob.userId, carol.userId);

      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/invite`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ friendId: carol.userId });

      expect(res.statusCode).toBe(403);
    });

    it('❌ 400 sans friendId', async () => {
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/invite`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({});
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/lobby/:id/join', () => {
    let lobbyId;
    beforeEach(async () => {
      const res = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${alice.token}`);
      lobbyId = res.body.lobby._id;
    });

    it('✅ Un autre utilisateur peut rejoindre le lobby', async () => {
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/join`)
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.lobby.memberCount).toBe(2);
      expect(res.body.lobby.members.map((m) => m.user._id)).toContain(bob.userId);
    });

    it('✅ Idempotent : rejoindre deux fois ne duplique pas le membre', async () => {
      await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${bob.token}`);
      const res = await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${bob.token}`);

      expect(res.body.lobby.memberCount).toBe(2);
    });

    it('❌ 422 si le lobby est plein (5 membres)', async () => {
      const extraTokens = [];
      for (let i = 0; i < 3; i++) {
        const u = await createAndLoginUser(`Filler${i}`, `filler${i}@athly.fr`);
        extraTokens.push(u.token);
      }
      await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${bob.token}`);
      await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${carol.token}`);
      for (const t of extraTokens) {
        await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${t}`);
      }
      // 5 membres déjà (Alice + Bob + Carol + 2 fillers) — Dave ne peut plus entrer
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/join`)
        .set('Authorization', `Bearer ${dave.token}`);

      expect(res.statusCode).toBe(422);
    });

    it('❌ 422 si le lobby a déjà démarré (active)', async () => {
      await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${bob.token}`);
      await request(app).post(`/api/lobby/${lobbyId}/ready`).set('Authorization', `Bearer ${alice.token}`);
      await request(app).post(`/api/lobby/${lobbyId}/ready`).set('Authorization', `Bearer ${bob.token}`);

      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/join`)
        .set('Authorization', `Bearer ${carol.token}`);
      expect(res.statusCode).toBe(422);
    });
  });

  describe('POST /api/lobby/:id/ready — passage waiting → active', () => {
    let lobbyId;
    beforeEach(async () => {
      const res = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${alice.token}`);
      lobbyId = res.body.lobby._id;
      await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${bob.token}`);
    });

    it("✅ Le lobby reste 'waiting' tant que tous ne sont pas prêts", async () => {
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/ready`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.lobby.status).toBe('waiting');
      expect(res.body.lobby.members.find((m) => m.user._id === alice.userId).status).toBe('ready');
    });

    it("✅ Passe 'active' dès que 100% des membres sont ready", async () => {
      await request(app).post(`/api/lobby/${lobbyId}/ready`).set('Authorization', `Bearer ${alice.token}`);
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/ready`)
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.body.lobby.status).toBe('active');
    });

    it("✅ Ne s'active PAS si le créateur seul est prêt (1 membre insuffisant)", async () => {
      const soloRes = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${carol.token}`);
      const soloLobbyId = soloRes.body.lobby._id;

      const res = await request(app)
        .post(`/api/lobby/${soloLobbyId}/ready`)
        .set('Authorization', `Bearer ${carol.token}`);

      expect(res.body.lobby.status).toBe('waiting');
    });

    it("✅ Rejoint automatiquement le lobby si pas encore membre", async () => {
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/ready`)
        .set('Authorization', `Bearer ${carol.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.lobby.memberCount).toBe(3);
      expect(res.body.lobby.members.find((m) => m.user._id === carol.userId).status).toBe('ready');
    });

    it('❌ 422 si le lobby est déjà actif', async () => {
      await request(app).post(`/api/lobby/${lobbyId}/ready`).set('Authorization', `Bearer ${alice.token}`);
      await request(app).post(`/api/lobby/${lobbyId}/ready`).set('Authorization', `Bearer ${bob.token}`);

      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/ready`)
        .set('Authorization', `Bearer ${carol.token}`);
      expect(res.statusCode).toBe(422);
    });
  });

  describe('POST /api/lobby/:id/unready — annule son statut ready', () => {
    let lobbyId;
    beforeEach(async () => {
      const res = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${alice.token}`);
      lobbyId = res.body.lobby._id;
      await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${bob.token}`);
      await request(app).post(`/api/lobby/${lobbyId}/ready`).set('Authorization', `Bearer ${alice.token}`);
    });

    it("✅ Repasse le membre à 'waiting'", async () => {
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/unready`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.lobby.members.find((m) => m.user._id === alice.userId).status).toBe('waiting');
    });

    it("❌ 422 si le lobby n'est plus 'waiting'", async () => {
      await request(app).post(`/api/lobby/${lobbyId}/ready`).set('Authorization', `Bearer ${bob.token}`);

      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/unready`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(422);
    });

    it("❌ 403 si l'appelant ne fait pas partie du lobby", async () => {
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/unready`)
        .set('Authorization', `Bearer ${carol.token}`);
      expect(res.statusCode).toBe(403);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post(`/api/lobby/${lobbyId}/unready`);
      expect(res.statusCode).toBe(401);
    });
  });

  describe('God Mode — coéquipiers isTestBot auto-progressés', () => {
    it("✅ Le lobby passe 'active' dès que le seul vrai joueur est ready (bot en miroir)", async () => {
      const bot = await createAndLoginUser('BotMulti', 'bot.multi@athly.fr');
      await User.updateOne({ _id: bot.userId }, { isTestBot: true });

      const createRes = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${alice.token}`);
      const lobbyId = createRes.body.lobby._id;
      await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${bot.token}`);

      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/ready`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.lobby.status).toBe('active');
      expect(res.body.lobby.members.find((m) => m.user._id === bot.userId).status).toBe('ready');
    });

    it("✅ Le lobby passe 'completed' dès que le seul vrai joueur a fini (bot en miroir)", async () => {
      const bot = await createAndLoginUser('BotMulti2', 'bot2.multi@athly.fr');
      await User.updateOne({ _id: bot.userId }, { isTestBot: true });

      const createRes = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${alice.token}`);
      const lobbyId = createRes.body.lobby._id;
      await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${bot.token}`);
      await request(app).post(`/api/lobby/${lobbyId}/ready`).set('Authorization', `Bearer ${alice.token}`);

      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/finish`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.completed).toBe(true);
      expect(res.body.lobby.status).toBe('completed');
      expect(res.body.lobby.xpBonusPercent).toBeCloseTo(0.15);
    });
  });

  describe('POST /api/lobby/:id/finish — passage active → completed + bonus XP', () => {
    // Tous les membres rejoignent D'ABORD (pour que le lobby connaisse déjà
    // son effectif complet), puis tout le monde se déclare prêt — sinon le
    // premier "ready" activerait le lobby avant que les autres n'aient pu
    // rejoindre (voir le garde-fou memberCount >= 2 dans readyLobby).
    async function createActiveLobby(members) {
      const res = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${members[0].token}`);
      const lobbyId = res.body.lobby._id;
      for (const m of members.slice(1)) {
        await request(app).post(`/api/lobby/${lobbyId}/join`).set('Authorization', `Bearer ${m.token}`);
      }
      for (const m of members) {
        await request(app).post(`/api/lobby/${lobbyId}/ready`).set('Authorization', `Bearer ${m.token}`);
      }
      return lobbyId;
    }

    it("✅ Reste 'active' tant que tout le monde n'a pas fini", async () => {
      const lobbyId = await createActiveLobby([alice, bob]);

      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/finish`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.completed).toBe(false);
      expect(res.body.lobby.status).toBe('active');
    });

    it("✅ Passe 'completed' avec le bon bonus XP quand tous ont fini (2 joueurs → 15%)", async () => {
      const lobbyId = await createActiveLobby([alice, bob]);

      await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${alice.token}`);
      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/finish`)
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.body.completed).toBe(true);
      expect(res.body.lobby.status).toBe('completed');
      expect(res.body.lobby.xpBonusPercent).toBeCloseTo(0.15);
    });

    it('✅ Bonus XP à 5 joueurs plafonné à 50%', async () => {
      const eve = await createAndLoginUser('EveMulti', 'eve.multi@athly.fr');
      const lobbyId = await createActiveLobby([alice, bob, carol, dave, eve]);

      let res;
      for (const m of [alice, bob, carol, dave, eve]) {
        res = await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${m.token}`);
      }

      expect(res.body.completed).toBe(true);
      expect(res.body.lobby.xpBonusPercent).toBeCloseTo(0.50);
    });

    it('✅ Débloque FIRST_MULTI_SESSION pour chaque membre à la clôture', async () => {
      const lobbyId = await createActiveLobby([alice, bob]);
      await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${alice.token}`);
      const res = await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${bob.token}`);

      expect(res.body.newlyUnlocked).toContain('FIRST_MULTI_SESSION');

      const aliceUser = await User.findById(alice.userId);
      expect(aliceUser.achievements.some((a) => a.achievementId === 'FIRST_MULTI_SESSION')).toBe(true);
    });

    it('✅ Débloque MULTI_SQUAD_FULL uniquement à 5 joueurs', async () => {
      const lobbyId = await createActiveLobby([alice, bob]);
      await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${alice.token}`);
      const res = await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${bob.token}`);

      expect(res.body.newlyUnlocked).not.toContain('MULTI_SQUAD_FULL');
    });

    it('✅ Incrémente totalMultiSessions pour chaque membre à la clôture', async () => {
      const lobbyId = await createActiveLobby([alice, bob]);
      await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${alice.token}`);
      await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${bob.token}`);

      const aliceUser = await User.findById(alice.userId);
      const bobUser   = await User.findById(bob.userId);
      expect(aliceUser.totalMultiSessions).toBe(1);
      expect(bobUser.totalMultiSessions).toBe(1);
    });

    it('✅ Débloque MULTI_SESSIONS_5 à la 5e séance Multi terminée', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { totalMultiSessions: 4 } });

      const lobbyId = await createActiveLobby([alice, bob]);
      await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${alice.token}`);
      const res = await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${bob.token}`);

      const aliceUser = await User.findById(alice.userId);
      const bobUser   = await User.findById(bob.userId);
      expect(aliceUser.totalMultiSessions).toBe(5);
      expect(aliceUser.achievements.some((a) => a.achievementId === 'MULTI_SESSIONS_5')).toBe(true);
      // Bob n'a fait qu'1 séance Multi : pas encore débloqué pour lui
      expect(bobUser.totalMultiSessions).toBe(1);
      expect(bobUser.achievements.some((a) => a.achievementId === 'MULTI_SESSIONS_5')).toBe(false);
      expect(res.body.newlyUnlocked).not.toContain('MULTI_SESSIONS_5');
    });

    it('✅ Débloque MULTI_SESSIONS_30 à la 30e séance Multi terminée', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { totalMultiSessions: 29 } });

      const lobbyId = await createActiveLobby([alice, bob]);
      await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${alice.token}`);
      await request(app).post(`/api/lobby/${lobbyId}/finish`).set('Authorization', `Bearer ${bob.token}`);

      const aliceUser = await User.findById(alice.userId);
      expect(aliceUser.totalMultiSessions).toBe(30);
      expect(aliceUser.achievements.some((a) => a.achievementId === 'MULTI_SESSIONS_30')).toBe(true);
    });

    it("❌ 422 si le lobby n'est pas encore actif (waiting)", async () => {
      const res = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${alice.token}`);
      const lobbyId = res.body.lobby._id;

      const finishRes = await request(app)
        .post(`/api/lobby/${lobbyId}/finish`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(finishRes.statusCode).toBe(422);
    });

    it("❌ 403 si l'appelant ne fait pas partie du lobby", async () => {
      const lobbyId = await createActiveLobby([alice, bob]);

      const res = await request(app)
        .post(`/api/lobby/${lobbyId}/finish`)
        .set('Authorization', `Bearer ${carol.token}`);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/lobby/:id', () => {
    it("✅ Un membre peut consulter l'état du lobby", async () => {
      const createRes = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${alice.token}`);
      const lobbyId = createRes.body.lobby._id;

      const res = await request(app)
        .get(`/api/lobby/${lobbyId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.lobby.status).toBe('waiting');
    });

    it("❌ 403 si l'appelant ne fait pas partie du lobby", async () => {
      const createRes = await request(app).post('/api/lobby/create').set('Authorization', `Bearer ${alice.token}`);
      const lobbyId = createRes.body.lobby._id;

      const res = await request(app)
        .get(`/api/lobby/${lobbyId}`)
        .set('Authorization', `Bearer ${bob.token}`);
      expect(res.statusCode).toBe(403);
    });

    it('❌ 404 si le lobby n\'existe pas', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/lobby/${fakeId}`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(404);
    });
  });
});
