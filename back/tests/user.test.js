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
});