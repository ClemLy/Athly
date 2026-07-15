'use strict';

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const User     = require('../models/User');
const { uniqueDiscriminator } = require('../services/auth.service');

async function createAndLoginUser(pseudo, email) {
  await request(app).post('/api/auth/register').send({ pseudo, email, password: 'Password123!' });
  await User.updateOne({ email }, { isVerified: true });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

describe('Tag numérique façon Discord — Section III', () => {
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
  });

  describe('Génération à l\'inscription', () => {
    it('✅ Un nouveau compte reçoit un discriminator à 4 chiffres', async () => {
      const alice = await createAndLoginUser('AliceTag', 'alice.tag@athly.fr');
      const user = await User.findById(alice.userId).select('discriminator');
      expect(user.discriminator).toMatch(/^\d{4}$/);
    });

    it('✅ Deux comptes avec le même pseudo reçoivent des discriminators différents', async () => {
      const a = await createAndLoginUser('SameName', 'same1@athly.fr');
      const b = await createAndLoginUser('SameName', 'same2@athly.fr');

      const userA = await User.findById(a.userId).select('discriminator');
      const userB = await User.findById(b.userId).select('discriminator');

      expect(userA.discriminator).not.toBe(userB.discriminator);
    });

    it('✅ login renvoie le discriminator (utilisable immédiatement pour afficher le tag)', async () => {
      const fresh = await createAndLoginUser('FreshUser', 'fresh@athly.fr');
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'fresh@athly.fr', password: 'Password123!' });

      expect(loginRes.body.user.discriminator).toMatch(/^\d{4}$/);
      expect(fresh.userId).toBeTruthy();
    });
  });

  describe('uniqueDiscriminator — collision handling', () => {
    it('✅ Ne réattribue jamais un discriminator déjà pris pour le même pseudo', async () => {
      await User.create({
        pseudo: 'CollisionTest',
        email: 'collision@athly.fr',
        password: 'hashed',
        isVerified: true,
        discriminator: '1234',
      });

      // Génère 30 discriminators pour ce même pseudo : jamais "1234"
      for (let i = 0; i < 30; i++) {
        const d = await uniqueDiscriminator('CollisionTest');
        expect(d).not.toBe('1234');
      }
    });

    it('✅ Le même discriminator EST réutilisable pour un pseudo différent', async () => {
      await User.create({
        pseudo: 'PseudoA',
        email: 'pseudoa@athly.fr',
        password: 'hashed',
        isVerified: true,
        discriminator: '5555',
      });

      const created = await User.create({
        pseudo: 'PseudoB',
        email: 'pseudob@athly.fr',
        password: 'hashed',
        isVerified: true,
        discriminator: '5555',
      });

      expect(created.discriminator).toBe('5555');
    });
  });

  describe('Backfill lazy — GET /users/me', () => {
    it('✅ Un compte sans discriminator (pré-migration) en reçoit un au premier GET /users/me', async () => {
      const alice = await createAndLoginUser('LegacyUser', 'legacy@athly.fr');
      // Simule un compte créé avant la fonctionnalité
      await User.updateOne({ _id: alice.userId }, { $unset: { discriminator: '' } });

      const before = await User.findById(alice.userId).select('discriminator');
      expect(before.discriminator).toBeUndefined();

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.user.discriminator).toMatch(/^\d{4}$/);

      const after = await User.findById(alice.userId).select('discriminator');
      expect(after.discriminator).toMatch(/^\d{4}$/);
    });
  });

  describe('Contrainte d\'unicité { pseudo, discriminator }', () => {
    it('❌ Rejette la création directe d\'un doublon exact (même pseudo + discriminator)', async () => {
      await User.create({
        pseudo: 'DupTest',
        email: 'dup1@athly.fr',
        password: 'hashed',
        isVerified: true,
        discriminator: '4242',
      });

      await expect(User.create({
        pseudo: 'DupTest',
        email: 'dup2@athly.fr',
        password: 'hashed',
        isVerified: true,
        discriminator: '4242',
      })).rejects.toThrow();
    });
  });
});
