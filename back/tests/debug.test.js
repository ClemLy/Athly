'use strict';

const request    = require('supertest');
const mongoose   = require('mongoose');
const app        = require('../app');
const User       = require('../models/User');
const Friendship = require('../models/Friendship');
const { xpForLevel } = require('../utils/levelHelpers');

async function createAndLoginUser(pseudo, email) {
  await request(app)
    .post('/api/auth/register')
    .send({ pseudo, email, password: 'Password123!' });

  await User.updateOne({ email }, { isVerified: true });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Password123!' });

  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

describe('POST /api/debug/sync-level — outil dev (God Mode → backend)', () => {
  let alice;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    alice = await createAndLoginUser('AliceFit', 'alice@athly.fr');
  });

  it('✅ Aligne xp/level/rank backend sur le niveau cible', async () => {
    const res = await request(app)
      .post('/api/debug/sync-level')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ level: 12 });

    expect(res.statusCode).toBe(200);
    expect(res.body.level).toBe(12);
    expect(res.body.rank).toBe('Initié');
    expect(res.body.xp).toBe(xpForLevel(12));

    const user = await User.findById(alice.userId);
    expect(user.level).toBe(12);
    expect(user.rank).toBe('Initié');
  });

  it('✅ Débloque immédiatement les coffres (gate niveau 11) après sync', async () => {
    await request(app)
      .post('/api/debug/sync-level')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ level: 12 });

    await User.updateOne(
      { _id: alice.userId },
      { inventory: [{ itemType: 'CHEST_KEY', rarity: 'common', quantity: 1 }] },
    );

    const res = await request(app)
      .post('/api/inventory/chest/open')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.statusCode).toBe(200);
  });

  it('❌ 400 si level est hors bornes (0-200) ou invalide', async () => {
    const tooHigh = await request(app)
      .post('/api/debug/sync-level')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ level: 500 });
    expect(tooHigh.statusCode).toBe(400);

    const invalid = await request(app)
      .post('/api/debug/sync-level')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ level: 'abc' });
    expect(invalid.statusCode).toBe(400);
  });

  it('❌ 401 sans token', async () => {
    const res = await request(app).post('/api/debug/sync-level').send({ level: 10 });
    expect(res.statusCode).toBe(401);
  });

  it('🔒 404 en production — la route est invisible (defense in depth)', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const config = require('../config/env');
    const originalNodeEnv = config.nodeEnv;
    config.nodeEnv = 'production';

    try {
      const res = await request(app)
        .post('/api/debug/sync-level')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ level: 10 });
      expect(res.statusCode).toBe(404);
    } finally {
      config.nodeEnv = originalNodeEnv;
      process.env.NODE_ENV = original;
    }
  });
});

describe('POST /api/debug/godmode/give-chests — outil dev (crédite des CHEST_KEY)', () => {
  let alice;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    alice = await createAndLoginUser('AliceFit', 'alice@athly.fr');
  });

  it('✅ +1 coffre par défaut, atomique', async () => {
    const res = await request(app)
      .post('/api/debug/godmode/give-chests')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});

    expect(res.statusCode).toBe(200);
    expect(res.body.chestCount).toBe(1);

    const user = await User.findById(alice.userId);
    const chest = user.inventory.find((i) => i.itemType === 'CHEST_KEY');
    expect(chest.quantity).toBe(1);
  });

  it('✅ amount personnalisé s\'ajoute à un stock existant', async () => {
    await User.updateOne(
      { _id: alice.userId },
      { inventory: [{ itemType: 'CHEST_KEY', rarity: 'common', quantity: 2 }] },
    );

    const res = await request(app)
      .post('/api/debug/godmode/give-chests')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ amount: 5 });

    expect(res.statusCode).toBe(200);
    expect(res.body.chestCount).toBe(7);
  });

  it('❌ 400 si amount est hors bornes (1-50)', async () => {
    const res = await request(app)
      .post('/api/debug/godmode/give-chests')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ amount: 999 });
    expect(res.statusCode).toBe(400);
  });

  it('❌ 401 sans token', async () => {
    const res = await request(app).post('/api/debug/godmode/give-chests').send({});
    expect(res.statusCode).toBe(401);
  });

  it('🔒 404 en production', async () => {
    const config = require('../config/env');
    const originalNodeEnv = config.nodeEnv;
    config.nodeEnv = 'production';
    try {
      const res = await request(app)
        .post('/api/debug/godmode/give-chests')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({});
      expect(res.statusCode).toBe(404);
    } finally {
      config.nodeEnv = originalNodeEnv;
    }
  });
});

describe('POST /api/debug/godmode/mock-social — outil dev (génère un faux réseau social)', () => {
  let alice;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    alice = await createAndLoginUser('AliceFit', 'alice@athly.fr');
  });

  it('✅ Génère 3 amis acceptés + 1 demande en attente reçue', async () => {
    const res = await request(app)
      .post('/api/debug/godmode/mock-social')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.statusCode).toBe(201);
    expect(res.body.created).toHaveLength(4);

    const friendsRes = await request(app)
      .get('/api/friends/list')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(friendsRes.body.friends).toHaveLength(3);
    expect(friendsRes.body.friends.every((f) => f.user.pseudo.startsWith('FauxAmi_'))).toBe(true);

    const pendingRes = await request(app)
      .get('/api/friends/pending')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(pendingRes.body.requests).toHaveLength(1);
    expect(pendingRes.body.requests[0].requester.pseudo).toMatch(/^FauxAmi_/);
  });

  it('✅ Le classement inclut les amis acceptés (podium testable)', async () => {
    await request(app)
      .post('/api/debug/godmode/mock-social')
      .set('Authorization', `Bearer ${alice.token}`);

    const res = await request(app)
      .get('/api/friends/leaderboard')
      .set('Authorization', `Bearer ${alice.token}`);

    // Alice + 3 amis acceptés (le 4e est encore "pending", pas dans le classement)
    expect(res.body.count).toBe(4);
  });

  it('🔁 Idempotent : rejouer l\'outil ne crée pas de doublons', async () => {
    await request(app)
      .post('/api/debug/godmode/mock-social')
      .set('Authorization', `Bearer ${alice.token}`);
    await request(app)
      .post('/api/debug/godmode/mock-social')
      .set('Authorization', `Bearer ${alice.token}`);

    const allMocks = await User.find({ pseudo: /^FauxAmi_/ });
    expect(allMocks).toHaveLength(4);

    const friendsRes = await request(app)
      .get('/api/friends/list')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(friendsRes.body.friends).toHaveLength(3);
  });

  it('❌ 401 sans token', async () => {
    const res = await request(app).post('/api/debug/godmode/mock-social');
    expect(res.statusCode).toBe(401);
  });

  it('🔒 404 en production', async () => {
    const config = require('../config/env');
    const originalNodeEnv = config.nodeEnv;
    config.nodeEnv = 'production';
    try {
      const res = await request(app)
        .post('/api/debug/godmode/mock-social')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(404);
    } finally {
      config.nodeEnv = originalNodeEnv;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// God Mode — Vague 1 (groupe, météo, activité, Hall of Shame, secouer)
// ─────────────────────────────────────────────────────────────────────────────

describe('God Mode — outils de test Vague 1', () => {
  const StreakGroup   = require('../models/StreakGroup');
  const ActivityEvent = require('../models/ActivityEvent');
  const Workout       = require('../models/Workout');
  let alice;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await StreakGroup.deleteMany({});
    await ActivityEvent.deleteMany({});
    await Workout.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await StreakGroup.deleteMany({});
    await ActivityEvent.deleteMany({});
    await Workout.deleteMany({});
    alice = await createAndLoginUser('AliceFit', 'alice@athly.fr');
  });

  describe('POST /api/debug/godmode/simulate-group', () => {
    it('✅ Crée un groupe avec 3 coéquipiers (ready/active/done) et une streak', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-group')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(201);
      expect(res.body.groupId).toBeTruthy();

      const groupRes = await request(app)
        .get('/api/groups/my-group')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(groupRes.body.group.members).toHaveLength(4); // moi + 3 coéquipiers
      expect(groupRes.body.group.currentStreak).toBe(5);

      const statuses = groupRes.body.group.members
        .filter((m) => m.pseudo !== 'AliceFit')
        .map((m) => m.weatherStatus)
        .sort();
      expect(statuses).toEqual(['active', 'done', 'ready']);
    });

    it('🔁 Idempotent : rejouer ne crée pas de doublons de coéquipiers', async () => {
      await request(app).post('/api/debug/godmode/simulate-group').set('Authorization', `Bearer ${alice.token}`);
      await request(app).post('/api/debug/godmode/simulate-group').set('Authorization', `Bearer ${alice.token}`);

      const groups = await StreakGroup.find({ members: alice.userId });
      expect(groups).toHaveLength(1);
      expect(groups[0].members).toHaveLength(4);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/debug/godmode/simulate-group');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/debug/godmode/simulate-activity-event', () => {
    it("❌ 400 si l'utilisateur n'a pas de groupe", async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-activity-event')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(400);
    });

    it('✅ Publie un événement au nom d\'un coéquipier, visible dans le feed', async () => {
      await request(app).post('/api/debug/godmode/simulate-group').set('Authorization', `Bearer ${alice.token}`);

      const res = await request(app)
        .post('/api/debug/godmode/simulate-activity-event')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ type: 'chest_legendary' });

      expect(res.statusCode).toBe(201);
      expect(res.body.eventId).toBeTruthy();

      const feedRes = await request(app)
        .get('/api/activity/feed')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(feedRes.body.events).toHaveLength(1);
      expect(feedRes.body.events[0].actor.pseudo).not.toBe('AliceFit');
    });
  });

  describe('POST /api/debug/godmode/simulate-streak-break', () => {
    it("❌ 400 si l'utilisateur n'a pas de groupe", async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-streak-break')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(400);
    });

    it('✅ Déclenche le Hall of Shame au prochain getMyGroup', async () => {
      await request(app).post('/api/debug/godmode/simulate-group').set('Authorization', `Bearer ${alice.token}`);

      const res = await request(app)
        .post('/api/debug/godmode/simulate-streak-break')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(200);

      const groupRes = await request(app)
        .get('/api/groups/my-group')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(groupRes.body.group.currentStreak).toBe(0);
      expect(groupRes.body.group.shameBreakers.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/debug/godmode/simulate-shake-self', () => {
    it('❌ 400 si aucun token push enregistré', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-shake-self')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(400);
    });

    it('✅ 200 avec pushed=false si le token est enregistré mais invalide', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { pushToken: 'not-a-real-expo-token' } });

      const res = await request(app)
        .post('/api/debug/godmode/simulate-shake-self')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.pushed).toBe(false);
    });
  });

  describe('POST /api/debug/godmode/simulate-searchable-friend', () => {
    it('✅ Crée un compte de test cherchable (relationStatus none)', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-searchable-friend')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(201);
      expect(res.body.tag).toMatch(/^TestAmi#\d{4}$/);

      const searchRes = await request(app)
        .get(`/api/friends/search?q=${encodeURIComponent(res.body.tag)}`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(searchRes.body.count).toBe(1);
      expect(searchRes.body.results[0].relationStatus).toBe('none');
    });

    it('🔁 Idempotent : rejouer renvoie le même tag tant qu\'aucune relation n\'existe', async () => {
      const first = await request(app)
        .post('/api/debug/godmode/simulate-searchable-friend')
        .set('Authorization', `Bearer ${alice.token}`);
      const second = await request(app)
        .post('/api/debug/godmode/simulate-searchable-friend')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(second.body.tag).toBe(first.body.tag);

      const count = await User.countDocuments({ pseudo: 'TestAmi' });
      expect(count).toBe(1);
    });

    it('✅ Recrée un compte frais si le précédent est devenu ami', async () => {
      const first = await request(app)
        .post('/api/debug/godmode/simulate-searchable-friend')
        .set('Authorization', `Bearer ${alice.token}`);

      const searchRes = await request(app)
        .get(`/api/friends/search?q=${encodeURIComponent(first.body.tag)}`)
        .set('Authorization', `Bearer ${alice.token}`);
      const testAmiId = searchRes.body.results[0].user._id;

      await Friendship.create({ requester: alice.userId, recipient: testAmiId, status: 'accepted' });

      const second = await request(app)
        .post('/api/debug/godmode/simulate-searchable-friend')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(second.statusCode).toBe(201); // nouveau compte créé
      expect(second.body.tag).not.toBe(first.body.tag);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/debug/godmode/simulate-searchable-friend');
      expect(res.statusCode).toBe(401);
    });
  });
});
