const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User.js');

describe('User API (Routes Protégées)', () => {
  let token;

  beforeAll(async () => {
    // Connexion à la DB de test si nécessaire
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    // Création, vérification directe en DB et récupération du token
    await request(app).post('/api/auth/register').send({ pseudo: 'Test User', email: 'user@test.fr', password: 'Password123!' });
    await User.updateOne({ email: 'user@test.fr' }, { isVerified: true });
    const res = await request(app).post('/api/auth/login').send({ email: 'user@test.fr', password: 'Password123!' });
    token = res.body.token;
  });

  afterAll(async () => {
    await User.deleteMany();
    await mongoose.connection.close();
  });

  it('devrait récupérer le profil de l\'utilisateur connecté (GET /api/users/me)', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toHaveProperty('email', 'user@test.fr');
  });

  it('devrait mettre à jour les infos du profil (PUT /api/users/me)', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ poids: 80, taille: 180 });

    expect(res.statusCode).toEqual(200);
    expect(res.body.user).toHaveProperty('poids', 80);
  });

  describe('PUT /api/users/me/frame — updateFrame', () => {
    it('✅ Synchronise le cadre équipé (forme + couleur)', async () => {
      const res = await request(app)
        .put('/api/users/me/frame')
        .set('Authorization', `Bearer ${token}`)
        .send({ shapeId: 'hexagon', colorId: 'gold' });

      expect(res.statusCode).toBe(200);
      expect(res.body.equippedFrame).toEqual({ shapeId: 'hexagon', colorId: 'gold' });

      const user = await User.findOne({ email: 'user@test.fr' });
      expect(user.equippedFrame.shapeId).toBe('hexagon');
      expect(user.equippedFrame.colorId).toBe('gold');
    });

    it('❌ 400 si shapeId ou colorId manquant', async () => {
      const res = await request(app)
        .put('/api/users/me/frame')
        .set('Authorization', `Bearer ${token}`)
        .send({ shapeId: 'hexagon' });

      expect(res.statusCode).toBe(400);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app)
        .put('/api/users/me/frame')
        .send({ shapeId: 'hexagon', colorId: 'gold' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/users/me/complete-onboarding — completeOnboarding (Tutoriel)', () => {
    beforeEach(async () => {
      await User.updateOne({ email: 'user@test.fr' }, { $set: { hasCompletedOnboarding: false } });
    });

    it('✅ hasCompletedOnboarding est false par défaut', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.user.hasCompletedOnboarding).toBe(false);
    });

    it('✅ Passe le flag à true et le persiste en base', async () => {
      const res = await request(app)
        .post('/api/users/me/complete-onboarding')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.hasCompletedOnboarding).toBe(true);

      const user = await User.findOne({ email: 'user@test.fr' });
      expect(user.hasCompletedOnboarding).toBe(true);
    });

    it('✅ Idempotent : rejouer laisse le flag à true', async () => {
      await request(app)
        .post('/api/users/me/complete-onboarding')
        .set('Authorization', `Bearer ${token}`);
      const second = await request(app)
        .post('/api/users/me/complete-onboarding')
        .set('Authorization', `Bearer ${token}`);

      expect(second.statusCode).toBe(200);
      expect(second.body.hasCompletedOnboarding).toBe(true);
    });

    it('✅ getMe reflète le flag une fois terminé', async () => {
      await request(app)
        .post('/api/users/me/complete-onboarding')
        .set('Authorization', `Bearer ${token}`);

      const me = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(me.body.user.hasCompletedOnboarding).toBe(true);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/users/me/complete-onboarding');
      expect(res.statusCode).toBe(401);
    });
  });
});