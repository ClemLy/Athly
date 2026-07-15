'use strict';

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const User     = require('../models/User');
const { containsProfanity } = require('../utils/profanityFilter');

describe('Filtre anti-injures — Section VIII', () => {
  describe('containsProfanity (unitaire)', () => {
    it('✅ Détecte un mot banni exact', () => {
      expect(containsProfanity('connard')).toBe(true);
    });

    it('✅ Détecte un mot banni intégré dans un pseudo', () => {
      expect(containsProfanity('SuperConnard69')).toBe(true);
    });

    it('✅ Insensible à la casse et aux accents', () => {
      expect(containsProfanity('ENCULÉ')).toBe(true);
      expect(containsProfanity('encule')).toBe(true);
    });

    it('✅ Détecte un contournement leet-speak simple', () => {
      expect(containsProfanity('put4in')).toBe(true);
    });

    it("❌ N'a pas de faux-positif sur un pseudo légitime", () => {
      expect(containsProfanity('AliceFit')).toBe(false);
      expect(containsProfanity('Classe2024')).toBe(false); // contient "ass" mais pas un mot banni isolé... voir note
    });
  });

  describe("POST /api/auth/register — rejet d'un pseudo vulgaire", () => {
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

    it('❌ 422 si le pseudo est vulgaire', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ pseudo: 'ConnardDu92', email: 'test1@athly.fr', password: 'Password123!' });

      expect(res.statusCode).toBe(422);
      const user = await User.findOne({ email: 'test1@athly.fr' });
      expect(user).toBeNull();
    });

    it('✅ 201 si le pseudo est propre', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ pseudo: 'AliceFit', email: 'test2@athly.fr', password: 'Password123!' });

      expect(res.statusCode).toBe(201);
    });
  });
});
