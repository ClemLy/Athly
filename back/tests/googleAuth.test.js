'use strict';

const request  = require('supertest');
const mongoose = require('mongoose');
const config   = require('../config/env');

// google-auth-library fait un vrai appel réseau pour vérifier le token — on
// le mocke pour tester notre logique métier (find-or-create) sans dépendre
// des serveurs Google ni de vraies credentials dans les tests.
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

const app  = require('../app');
const User = require('../models/User');

describe('POST /api/auth/google — connexion Google OAuth (Section VIII)', () => {
  let originalClientId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    originalClientId = config.googleClientIds;
    config.googleClientIds = ['test-client-id.apps.googleusercontent.com'];
  });

  afterAll(async () => {
    config.googleClientIds = originalClientId;
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    mockVerifyIdToken.mockReset();
  });

  it('✅ Crée un nouveau compte au premier login Google', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub-1', email: 'nouveau@gmail.com', name: 'Nouvel Athlète' }),
    });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'fake-valid-token' });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('nouveau@gmail.com');

    const user = await User.findOne({ email: 'nouveau@gmail.com' });
    expect(user.googleId).toBe('google-sub-1');
    expect(user.isVerified).toBe(true);
    expect(user.discriminator).toMatch(/^\d{4}$/);
  });

  it('✅ Reconnecte directement un compte déjà lié (même googleId)', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub-2', email: 'existant@gmail.com', name: 'Existant' }),
    });
    const first = await request(app).post('/api/auth/google').send({ idToken: 't1' });
    const firstUserId = first.body.user.id;

    const second = await request(app).post('/api/auth/google').send({ idToken: 't2' });

    expect(second.statusCode).toBe(200);
    expect(second.body.user.id).toBe(firstUserId);
    expect(await User.countDocuments({ email: 'existant@gmail.com' })).toBe(1);
  });

  it('✅ Lie googleId à un compte email/mot de passe existant (même email)', async () => {
    await request(app).post('/api/auth/register').send({
      pseudo: 'DejaLa', email: 'deja.la@gmail.com', password: 'Password123!',
    });

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub-3', email: 'deja.la@gmail.com', name: 'Déjà Là' }),
    });

    const res = await request(app).post('/api/auth/google').send({ idToken: 't3' });

    expect(res.statusCode).toBe(200);
    const user = await User.findOne({ email: 'deja.la@gmail.com' });
    expect(user.googleId).toBe('google-sub-3');
    expect(user.isVerified).toBe(true); // vérifié automatiquement même si le compte email ne l'était pas
  });

  it('❌ 401 si le token Google est invalide', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token signature'));

    const res = await request(app).post('/api/auth/google').send({ idToken: 'invalid' });
    expect(res.statusCode).toBe(401);
  });

  it('❌ 400 si idToken manquant', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.statusCode).toBe(400);
  });

  it("❌ 501 si Google OAuth n'est pas configuré (pas de GOOGLE_CLIENT_IDS)", async () => {
    config.googleClientIds = [];
    const res = await request(app).post('/api/auth/google').send({ idToken: 'whatever' });
    expect(res.statusCode).toBe(501);
    config.googleClientIds = ['test-client-id.apps.googleusercontent.com'];
  });
});
