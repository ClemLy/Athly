const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User.js');

describe('Workout API', () => {
  let token;
  let workoutId;

  // Connexion à la DB de test et création d'un user pour les tests
  beforeAll(async () => {
    // 1. On s'assure d'être connecté avant de faire quoi que ce soit
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // 2. Nettoyage préventif pour éviter les doublons d'email
    await User.deleteMany();

    const userData = { pseudo: 'Workout User', email: 'workout@test.fr', password: 'Password123!' };

    // 3. Création du user et vérification directe en DB (bypass email OTP pour les tests)
    await request(app).post('/api/auth/register').send(userData);
    await User.updateOne({ email: userData.email }, { isVerified: true });

    const res = await request(app).post('/api/auth/login').send({ email: userData.email, password: userData.password });
    token = res.body.token;
  });

  // Nettoyage de la collection Workouts et Users après les tests
  afterAll(async () => {
    await User.deleteMany();
    await mongoose.connection.close();
  });

  it('devrait créer une nouvelle séance (POST /api/workouts)', async () => {
    const res = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ titre: "Séance Pecs", categorie: "Push" });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    workoutId = res.body.workout._id; // On garde l'ID pour le test suivant
  });

  it('devrait récupérer toutes mes séances (GET /api/workouts)', async () => {
    const res = await request(app)
      .get('/api/workouts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.workouts).toBeInstanceOf(Array);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it('devrait supprimer une séance (DELETE /api/workouts/:id)', async () => {
    const res = await request(app)
      .delete(`/api/workouts/${workoutId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toBe("Séance supprimée");
  });
});