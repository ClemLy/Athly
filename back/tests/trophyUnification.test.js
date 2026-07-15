'use strict';

const request     = require('supertest');
const mongoose     = require('mongoose');
const app          = require('../app');
const User         = require('../models/User');
const Friendship   = require('../models/Friendship');
const { LOCAL_TROPHY_IDS } = require('../data/localTrophyCatalog');
const { ACHIEVEMENT_CATALOG } = require('../controllers/reward.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

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

async function makeFriends(a, b) {
  return Friendship.create({ requester: a, recipient: b, status: 'accepted' });
}

const FULL_SIZE = Object.keys(ACHIEVEMENT_CATALOG).length + LOCAL_TROPHY_IDS.size;

// ─────────────────────────────────────────────────────────────────────────────
// Suite principale
// ─────────────────────────────────────────────────────────────────────────────

describe('Unification des catalogues de trophées — sync local, vitrine, profil ami', () => {
  let alice, bob;

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
    alice = await createAndLoginUser('Alice', 'alice@athly.fr');
    bob   = await createAndLoginUser('Bob',   'bob@athly.fr');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. PUT /api/rewards/achievements/sync
  // ───────────────────────────────────────────────────────────────────────────
  describe('PUT /api/rewards/achievements/sync — syncLocalAchievements', () => {

    it('✅ Ajoute les ids valides du catalogue local', async () => {
      const res = await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ ids: ['ignition', 'titan', 'night_owl'] });

      expect(res.statusCode).toBe(200);
      expect(res.body.added).toBe(3);
      expect(res.body.synced).toEqual(expect.arrayContaining(['ignition', 'titan', 'night_owl']));

      const user = await User.findById(alice.userId);
      const ids  = user.achievements.map((a) => a.achievementId);
      expect(ids).toEqual(expect.arrayContaining(['ignition', 'titan', 'night_owl']));
    });

    it("🔒 Ignore les ids hors catalogue local (y compris les ids du catalogue backend)", async () => {
      const res = await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ ids: ['ignition', 'FRIENDSHIP_LEVEL_5', 'id_bidon'] });

      expect(res.statusCode).toBe(200);
      expect(res.body.added).toBe(1);
      expect(res.body.ignored).toBe(2);

      const user = await User.findById(alice.userId);
      const ids  = user.achievements.map((a) => a.achievementId);
      expect(ids).toContain('ignition');
      expect(ids).not.toContain('FRIENDSHIP_LEVEL_5');
      expect(ids).not.toContain('id_bidon');
    });

    it('✅ Idempotent : rejouer avec les mêmes ids ne duplique rien', async () => {
      await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ ids: ['ignition'] });

      const res = await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ ids: ['ignition'] });

      expect(res.body.added).toBe(0);

      const user = await User.findById(alice.userId);
      const count = user.achievements.filter((a) => a.achievementId === 'ignition').length;
      expect(count).toBe(1);
    });

    it('✅ Additif uniquement : ne retire jamais un trophée déjà synchronisé', async () => {
      await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ ids: ['ignition', 'titan'] });

      await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ ids: ['promise'] });

      const user = await User.findById(alice.userId);
      const ids  = user.achievements.map((a) => a.achievementId);
      expect(ids).toEqual(expect.arrayContaining(['ignition', 'titan', 'promise']));
    });

    it('❌ 400 si ids n\'est pas un tableau', async () => {
      const res = await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ ids: 'ignition' });
      expect(res.statusCode).toBe(400);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).put('/api/rewards/achievements/sync').send({ ids: [] });
      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Profil ami — catalogue combiné (backend + local)
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/friends/profile/:friendId — catalogue combiné', () => {

    it(`✅ Expose les ${FULL_SIZE} trophées (backend + local) avec les bons statuts`, async () => {
      await makeFriends(alice.userId, bob.userId);
      await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ ids: ['titan', 'night_owl'] });

      const res = await request(app)
        .get(`/api/friends/profile/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.profile.achievements).toHaveLength(FULL_SIZE);
      expect(res.body.profile.achievementsStats.total).toBe(FULL_SIZE);

      const ids = res.body.profile.achievements.map((a) => a.id);
      expect(ids).toContain('FRIENDSHIP_LEVEL_5'); // backend
      expect(ids).toContain('titan');              // local

      const titan = res.body.profile.achievements.find((a) => a.id === 'titan');
      expect(titan.unlocked).toBe(true);
      expect(titan.label).toBe('Le Titan');

      // Trophée secret local débloqué → révélé ; secret verrouillé → masqué
      const nightOwl = res.body.profile.achievements.find((a) => a.id === 'night_owl');
      expect(nightOwl.unlocked).toBe(true);
      expect(nightOwl.label).toBe('Oiseau de Nuit');
      const ultraStreak = res.body.profile.achievements.find((a) => a.id === 'ultra_streak');
      expect(ultraStreak.unlocked).toBe(false);
      expect(ultraStreak.name).toBe('???');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. PUT /api/users/me/showcase
  // ───────────────────────────────────────────────────────────────────────────
  describe('PUT /api/users/me/showcase — updateShowcase', () => {

    it('✅ Enregistre la vitrine (max 3), filtre les ids inconnus', async () => {
      const res = await request(app)
        .put('/api/users/me/showcase')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ achievementIds: ['ignition', 'titan', 'id_bidon'] });

      expect(res.statusCode).toBe(200);
      expect(res.body.showcasedAchievements).toEqual(['ignition', 'titan']);
    });

    it("✅ Accepte aussi un id du catalogue backend (ex: FRIENDSHIP_LEVEL_5)", async () => {
      const res = await request(app)
        .put('/api/users/me/showcase')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ achievementIds: ['FRIENDSHIP_LEVEL_5'] });

      expect(res.statusCode).toBe(200);
      expect(res.body.showcasedAchievements).toEqual(['FRIENDSHIP_LEVEL_5']);
    });

    it('❌ 400 si plus de 3 ids (Joi)', async () => {
      const res = await request(app)
        .put('/api/users/me/showcase')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ achievementIds: ['ignition', 'titan', 'promise', 'apprenti'] });
      expect(res.statusCode).toBe(400);
    });

    it("✅ La vitrine de l'ami est exposée, restreinte aux trophées effectivement débloqués", async () => {
      await makeFriends(alice.userId, bob.userId);

      // Bob débloque uniquement 'ignition', mais met en vitrine ignition + titan
      await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ ids: ['ignition'] });
      await request(app)
        .put('/api/users/me/showcase')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ achievementIds: ['ignition', 'titan'] });

      const res = await request(app)
        .get(`/api/friends/profile/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      // titan non débloqué → exclu de la vitrine visible malgré la préférence enregistrée
      expect(res.body.profile.showcasedAchievements).toEqual(['ignition']);
    });
  });
});
