'use strict';

const request    = require('supertest');
const mongoose   = require('mongoose');
const app        = require('../app');
const User       = require('../models/User');
const Friendship = require('../models/Friendship');
const Workout    = require('../models/Workout');
const ExerciseRecord = require('../models/ExerciseRecord');
const { LOCAL_TROPHY_CATALOG } = require('../data/localTrophyCatalog');
const { CATALOG_SIZE } = require('../controllers/reward.controller');

const FULL_SIZE = CATALOG_SIZE + Object.keys(LOCAL_TROPHY_CATALOG).length;

async function createAndLoginUser(pseudo, email, extra = {}) {
  await request(app)
    .post('/api/auth/register')
    .send({ pseudo, email, password: 'Password123!', ...extra });

  await User.updateOne({ email }, { isVerified: true });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Password123!' });

  const user = await User.findOne({ email }).select('_id referralCode');
  return { token: loginRes.body.token, userId: user._id.toString(), referralCode: user.referralCode };
}

async function makeFriends(a, b) {
  return Friendship.create({ requester: a, recipient: b, status: 'accepted' });
}

describe('Intégration profonde — trophées sync, vitrine, leaderboard exos, parrainage', () => {
  let alice, bob, carol;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({}), Friendship.deleteMany({}),
      Workout.deleteMany({}), ExerciseRecord.deleteMany({}),
    ]);
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}), Friendship.deleteMany({}),
      Workout.deleteMany({}), ExerciseRecord.deleteMany({}),
    ]);
    alice = await createAndLoginUser('AliceFit',  'alice@athly.fr');
    bob   = await createAndLoginUser('BobMuscle', 'bob@athly.fr');
    carol = await createAndLoginUser('CarolGains','carol@athly.fr');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Synchronisation des trophées locaux
  // ───────────────────────────────────────────────────────────────────────────
  describe('PUT /api/rewards/achievements/sync — syncLocalAchievements', () => {

    it('✅ Ajoute les trophées locaux valides, ignore les IDs inconnus ET les IDs backend', async () => {
      const res = await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ ids: ['ignition', 'titan', 'id_bidon', 'BIRTHDAY_SET'] });

      expect(res.statusCode).toBe(200);
      expect(res.body.synced).toEqual(expect.arrayContaining(['ignition', 'titan']));
      expect(res.body.added).toBe(2);
      expect(res.body.ignored).toBe(2);  // id_bidon + BIRTHDAY_SET (backend, non synchronisable)

      const user = await User.findById(alice.userId);
      const ids = user.achievements.map((a) => a.achievementId);
      expect(ids).toContain('ignition');
      expect(ids).toContain('titan');
      expect(ids).not.toContain('BIRTHDAY_SET');
      expect(ids).not.toContain('id_bidon');
    });

    it('🔁 Idempotent : re-synchroniser les mêmes IDs ne crée aucun doublon', async () => {
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
      expect(user.achievements.filter((a) => a.achievementId === 'ignition')).toHaveLength(1);
    });

    it('❌ 400 si ids n\'est pas un tableau', async () => {
      const res = await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ ids: 'ignition' });
      expect(res.statusCode).toBe(400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Catalogue unifié + vitrine sur le profil ami
  // ───────────────────────────────────────────────────────────────────────────
  describe('Profil ami — catalogue complet et vitrine', () => {

    it(`✅ Le profil ami expose le catalogue UNIFIÉ (${FULL_SIZE} trophées)`, async () => {
      await makeFriends(alice.userId, bob.userId);

      const res = await request(app)
        .get(`/api/friends/profile/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.profile.achievements).toHaveLength(FULL_SIZE);
      expect(res.body.profile.achievementsStats.total).toBe(FULL_SIZE);

      // Contient à la fois des trophées backend et locaux
      const ids = res.body.profile.achievements.map((a) => a.id);
      expect(ids).toContain('BIRTHDAY_CELEBRATED');
      expect(ids).toContain('ignition');
      expect(ids).toContain('souverain_absolu');
    });

    it('✅ Un trophée local synchronisé apparaît débloqué chez l\'ami', async () => {
      await makeFriends(alice.userId, bob.userId);
      await request(app)
        .put('/api/rewards/achievements/sync')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ ids: ['titan', 'night_owl'] });

      const res = await request(app)
        .get(`/api/friends/profile/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      const titan = res.body.profile.achievements.find((a) => a.id === 'titan');
      expect(titan.unlocked).toBe(true);
      expect(titan.label).toBe('Le Titan');

      // Trophée secret débloqué → révélé ; secret verrouillé → masqué
      const nightOwl = res.body.profile.achievements.find((a) => a.id === 'night_owl');
      expect(nightOwl.unlocked).toBe(true);
      expect(nightOwl.label).toBe('Oiseau de Nuit');
      const ultraStreak = res.body.profile.achievements.find((a) => a.id === 'ultra_streak');
      expect(ultraStreak.name).toBe('???');
    });

    it('✅ PUT /users/me/showcase enregistre la vitrine (max 3, allowlist)', async () => {
      const res = await request(app)
        .put('/api/users/me/showcase')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ achievementIds: ['ignition', 'titan', 'id_bidon'] });

      expect(res.statusCode).toBe(200);
      expect(res.body.showcasedAchievements).toEqual(['ignition', 'titan']); // id_bidon filtré

      const tooMany = await request(app)
        .put('/api/users/me/showcase')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ achievementIds: ['ignition', 'titan', 'promise', 'apprenti'] });
      expect(tooMany.statusCode).toBe(400); // Joi max 3
    });

    it('✅ La vitrine de l\'ami est exposée, restreinte aux trophées débloqués', async () => {
      await makeFriends(alice.userId, bob.userId);

      // Bob débloque ignition seulement, mais vitrine ignition + titan
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

      // titan non débloqué → exclu de la vitrine visible
      expect(res.body.profile.showcasedAchievements).toEqual(['ignition']);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Classement par exercice
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/exercises/leaderboard — classement par exercice', () => {

    async function seedRecord(userId, exercice, poids, repetitions) {
      const workout = await Workout.create({
        user: userId, name: 'Séance', status: 'finished', date: new Date(),
      });
      return ExerciseRecord.create({
        user: userId, workout: workout._id, exerciceNom: exercice,
        series: [{ poids, repetitions }],
      });
    }

    it('✅ Trie par poids décroissant, restreint au réseau d\'amis, marque isMe', async () => {
      await makeFriends(alice.userId, bob.userId);
      await seedRecord(alice.userId, 'Développé couché', 60, 8);
      await seedRecord(bob.userId,   'Développé couché', 100, 5);
      await seedRecord(carol.userId, 'Développé couché', 150, 3); // pas amie → exclue

      const res = await request(app)
        .get('/api/exercises/leaderboard?exercise=' + encodeURIComponent('Développé couché'))
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.leaderboard[0].user.pseudo).toBe('BobMuscle');
      expect(res.body.leaderboard[0].maxPoids).toBe(100);
      expect(res.body.leaderboard[0].position).toBe(1);
      expect(res.body.leaderboard[1].isMe).toBe(true);
      expect(res.body.leaderboard[1].maxPoids).toBe(60);
    });

    it('✅ Matching insensible à la casse et aux accents', async () => {
      await seedRecord(alice.userId, 'Développé couché', 80, 5);

      const res = await request(app)
        .get('/api/exercises/leaderboard?exercise=' + encodeURIComponent('developpe couche'))
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.leaderboard[0].maxPoids).toBe(80);
    });

    it('❌ 400 sans paramètre exercise', async () => {
      const res = await request(app)
        .get('/api/exercises/leaderboard')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(400);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).get('/api/exercises/leaderboard?exercise=Squat');
      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Parrainage à l'inscription
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/auth/register — parrainage intégré', () => {

    it('✅ Un referralCode est généré automatiquement à l\'inscription', async () => {
      expect(alice.referralCode).toMatch(/^ATH-/);
      // Unicité entre comptes
      expect(alice.referralCode).not.toBe(bob.referralCode);
    });

    it('✅ Inscription avec code valide : récompenses des deux côtés + amitié acceptée', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ pseudo: 'Filleul', email: 'filleul@athly.fr', password: 'Password123!', referralCode: alice.referralCode });

      expect(res.statusCode).toBe(201);
      expect(res.body.referred).toBe(true);

      const filleul = await User.findOne({ email: 'filleul@athly.fr' });
      expect(filleul.referredBy.toString()).toBe(alice.userId);
      expect(filleul.inventory.find((i) => i.itemType === 'STREAK_FREEZE')).toBeDefined();
      expect(filleul.inventory.find((i) => i.itemType === 'LEVEL_COUPON')).toBeDefined();

      const referrer = await User.findById(alice.userId);
      expect(referrer.inventory.find((i) => i.itemType === 'STREAK_FREEZE')).toBeDefined();
      expect(referrer.inventory.find((i) => i.itemType === 'LEVEL_COUPON')).toBeDefined();
      expect(referrer.achievements.find((a) => a.achievementId === 'FIRST_REFERRAL')).toBeDefined();

      // Amitié auto, statut accepted
      const friendship = await Friendship.findOne({
        requester: alice.userId, recipient: filleul._id,
      });
      expect(friendship).not.toBeNull();
      expect(friendship.status).toBe('accepted');
    });

    it('✅ Le code est insensible à la casse', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ pseudo: 'Filleul2', email: 'filleul2@athly.fr', password: 'Password123!', referralCode: alice.referralCode.toLowerCase() });
      expect(res.statusCode).toBe(201);
      expect(res.body.referred).toBe(true);
    });

    it('❌ 400 si le code est invalide — le compte n\'est PAS créé', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ pseudo: 'Fraudeur', email: 'fraudeur@athly.fr', password: 'Password123!', referralCode: 'ATH-BIDON' });

      expect(res.statusCode).toBe(400);
      const ghost = await User.findOne({ email: 'fraudeur@athly.fr' });
      expect(ghost).toBeNull();
    });

    it('✅ Champ vide toléré (pas de parrainage)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ pseudo: 'Solo', email: 'solo@athly.fr', password: 'Password123!', referralCode: '' });
      expect(res.statusCode).toBe(201);
      expect(res.body.referred).toBe(false);
    });

    it('✅ getMe génère un code aux comptes existants qui n\'en ont pas (lazy)', async () => {
      await User.updateOne({ _id: alice.userId }, { $unset: { referralCode: 1 } });

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.referralCode).toMatch(/^ATH-/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. mockSocial dopé
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/debug/godmode/mock-social — profils complets', () => {

    it('✅ Les faux amis ont cadres, trophées, vitrines, séances et records', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/mock-social')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(201);

      const mock1 = await User.findOne({ pseudo: 'FauxAmi_1' });
      expect(mock1.equippedFrame.shapeId).toBe('hexagon');
      expect(mock1.showcasedAchievements).toEqual(['promise', 'iron_will', 'marathonien']);
      expect(mock1.achievements.length).toBeGreaterThanOrEqual(5);
      expect(mock1.inventory.length).toBeGreaterThanOrEqual(2);

      const workouts = await Workout.find({ user: mock1._id });
      expect(workouts.length).toBe(6);
      const records = await ExerciseRecord.find({ user: mock1._id });
      expect(records.length).toBe(3);

      // Le profil public reflète tout ça
      const profileRes = await request(app)
        .get(`/api/friends/profile/${mock1._id}`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(profileRes.body.profile.showcasedAchievements).toEqual(['promise', 'iron_will', 'marathonien']);
      expect(profileRes.body.profile.stats.totalSessions).toBe(6);
      expect(profileRes.body.profile.records.length).toBeGreaterThan(0);
    });

    it('✅ Le classement par exercice fonctionne avec les mocks (Développé couché)', async () => {
      await request(app)
        .post('/api/debug/godmode/mock-social')
        .set('Authorization', `Bearer ${alice.token}`);

      const res = await request(app)
        .get('/api/exercises/leaderboard?exercise=' + encodeURIComponent('Développé couché'))
        .set('Authorization', `Bearer ${alice.token}`);

      // FauxAmi_1 (85kg), FauxAmi_2 (105kg) et FauxAmi_4 (90kg) sont amis acceptés ; FauxAmi_3 (pending) exclu
      expect(res.body.count).toBe(3);
      expect(res.body.leaderboard[0].user.pseudo).toBe('FauxAmi_2');
      expect(res.body.leaderboard[0].maxPoids).toBe(105);
    });

    it('🔁 Rejouer l\'outil nettoie TOUT (workouts et records inclus)', async () => {
      await request(app)
        .post('/api/debug/godmode/mock-social')
        .set('Authorization', `Bearer ${alice.token}`);
      await request(app)
        .post('/api/debug/godmode/mock-social')
        .set('Authorization', `Bearer ${alice.token}`);

      const mocks = await User.find({ pseudo: /^FauxAmi_/ });
      expect(mocks).toHaveLength(4);

      const mockIds = mocks.map((m) => m._id);
      const workouts = await Workout.find({ user: { $in: mockIds } });
      expect(workouts).toHaveLength(6 + 9 + 2 + 11); // une seule génération, pas d'accumulation
      const records = await ExerciseRecord.find({ user: { $in: mockIds } });
      expect(records).toHaveLength(3 + 3 + 1 + 3);
    });
  });
});
