const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User.js');

describe('Exercise API (Performances)', () => {
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
    
    const userData = { pseudo: 'Exo User', email: 'exo@test.fr', password: 'Password123!' };

    // 3. Création du user et vérification directe en DB (bypass email OTP pour les tests)
    await request(app).post('/api/auth/register').send(userData);
    await User.updateOne({ email: userData.email }, { isVerified: true });

    const res = await request(app).post('/api/auth/login').send({ email: userData.email, password: userData.password });
    token = res.body.token;

    // 4. Création d'un workout
    const workoutRes = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ titre: "Séance Test", categorie: "Push" });
    
    if (workoutRes.body.workout) {
        workoutId = workoutRes.body.workout._id;
    }
  });

  // Nettoyage de la collection Users après les tests
  afterAll(async () => {
    await User.deleteMany();
    await mongoose.connection.close();
  });

  it('devrait enregistrer une performance pour un exercice (POST /api/exercises/)', async () => {
    const res = await request(app)
      .post('/api/exercises/')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workout: workoutId,
        exerciceNom: "Développé Couché",
        series: [
          { repetitions: 10, poids: 60 },
          { repetitions: 8, poids: 65 }
        ],
        note: "Top forme aujourd'hui"
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Performance enregistrée !");
  });

  it('devrait récupérer l\'historique d\'un exercice spécifique (GET /api/exercises/history/:name)', async () => {
    const res = await request(app)
      .get('/api/exercises/history/Développé Couché')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.history).toBeInstanceOf(Array);
  });
});