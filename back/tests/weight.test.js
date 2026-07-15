'use strict';

const request        = require('supertest');
const mongoose        = require('mongoose');
const app             = require('../app');
const User            = require('../models/User');
const WeightHistory   = require('../models/WeightHistory');

async function createAndLoginUser(pseudo, email) {
  await request(app).post('/api/auth/register').send({ pseudo, email, password: 'Password123!' });
  await User.updateOne({ email }, { isVerified: true });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

describe('Suivi de poids — Section VI', () => {
  let alice;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await WeightHistory.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await WeightHistory.deleteMany({});
    alice = await createAndLoginUser('AliceWeight', 'alice.weight@athly.fr');
  });

  describe('POST /api/weight — logWeight', () => {
    it('✅ Enregistre une pesée et met à jour user.poids', async () => {
      const res = await request(app)
        .post('/api/weight')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ weight: 78.5 });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.entry.weight).toBe(78.5);

      const user = await User.findById(alice.userId).select('poids');
      expect(user.poids).toBe(78.5);

      const rows = await WeightHistory.find({ user: alice.userId });
      expect(rows).toHaveLength(1);
    });

    it("✅ Une pesée rétroactive (date passée) ne met PAS à jour user.poids si une entrée plus récente existe", async () => {
      await request(app)
        .post('/api/weight')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ weight: 80 });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await request(app)
        .post('/api/weight')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ weight: 82, date: yesterday.toISOString() });

      const user = await User.findById(alice.userId).select('poids');
      expect(user.poids).toBe(80); // pas écrasé par la pesée rétroactive
    });

    it('❌ 400 si weight hors bornes (20–400)', async () => {
      const res = await request(app)
        .post('/api/weight')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ weight: 5 });

      expect(res.statusCode).toBe(400);
    });

    it('❌ 400 si weight manquant', async () => {
      const res = await request(app)
        .post('/api/weight')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/weight').send({ weight: 75 });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/weight/history — getWeightHistory', () => {
    it('✅ Retourne les pesées triées chronologiquement', async () => {
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 2);

      await WeightHistory.create({ user: alice.userId, weight: 82, date: dayAgo });
      await WeightHistory.create({ user: alice.userId, weight: 80, date: new Date() });

      const res = await request(app)
        .get('/api/weight/history')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.history).toHaveLength(2);
      expect(res.body.history[0].weight).toBe(82); // plus ancien en premier
      expect(res.body.history[1].weight).toBe(80);
    });

    it("✅ Ne renvoie que l'historique de l'utilisateur connecté", async () => {
      const bob = await createAndLoginUser('BobWeight', 'bob.weight@athly.fr');
      await WeightHistory.create({ user: bob.userId, weight: 90, date: new Date() });

      const res = await request(app)
        .get('/api/weight/history')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.history).toHaveLength(0);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).get('/api/weight/history');
      expect(res.statusCode).toBe(401);
    });
  });
});
