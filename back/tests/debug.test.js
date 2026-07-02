'use strict';

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const User     = require('../models/User');
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
