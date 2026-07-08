'use strict';

const request        = require('supertest');
const mongoose        = require('mongoose');
const app             = require('../app');
const User            = require('../models/User');
const Workout         = require('../models/Workout');
const ExerciseRecord  = require('../models/ExerciseRecord');
const Friendship      = require('../models/Friendship');

async function createAndLoginUser(pseudo, email) {
  await request(app).post('/api/auth/register').send({ pseudo, email, password: 'Password123!' });
  await User.updateOne({ email }, { isVerified: true });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

async function addRecord(userId, exerciceNom, poids, repetitions = 5) {
  const workout = await Workout.create({ user: userId, status: 'finished', date: new Date() });
  return ExerciseRecord.create({ user: userId, workout: workout._id, exerciceNom, series: [{ poids, repetitions }] });
}

describe('Records mis en avant sur le profil — Section III', () => {
  let alice, bob;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Workout.deleteMany({});
    await ExerciseRecord.deleteMany({});
    await Friendship.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Workout.deleteMany({});
    await ExerciseRecord.deleteMany({});
    await Friendship.deleteMany({});
    alice = await createAndLoginUser('AliceRecords', 'alice.records@athly.fr');
    bob   = await createAndLoginUser('BobRecords', 'bob.records@athly.fr');
  });

  describe('GET /api/exercises/my-records', () => {
    it('✅ Renvoie un record par exercice pratiqué, trié par poids max décroissant', async () => {
      await addRecord(alice.userId, 'Squat', 100);
      await addRecord(alice.userId, 'Développé couché', 80);
      await addRecord(alice.userId, 'Squat', 110); // meilleure série sur le même exercice

      const res = await request(app)
        .get('/api/exercises/my-records')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.records[0]).toEqual({ exercice: 'Squat', maxPoids: 110, maxReps: 5 });
    });

    it("✅ Tableau vide si aucun record", async () => {
      const res = await request(app)
        .get('/api/exercises/my-records')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.body.records).toEqual([]);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).get('/api/exercises/my-records');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/users/me/records-showcase', () => {
    it('✅ Accepte un exercice pratiqué et le renvoie dans showcasedRecords', async () => {
      await addRecord(alice.userId, 'Squat', 100);

      const res = await request(app)
        .put('/api/users/me/records-showcase')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ exerciseNames: ['Squat'] });

      expect(res.statusCode).toBe(200);
      expect(res.body.showcasedRecords).toEqual(['Squat']);
    });

    it("❌ Rejette silencieusement un exercice jamais pratiqué", async () => {
      await addRecord(alice.userId, 'Squat', 100);

      const res = await request(app)
        .put('/api/users/me/records-showcase')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ exerciseNames: ['Squat', 'Jamais Fait'] });

      expect(res.statusCode).toBe(200);
      expect(res.body.showcasedRecords).toEqual(['Squat']);
    });

    it('✅ Conserve l\'ordre de sélection', async () => {
      await addRecord(alice.userId, 'Squat', 100);
      await addRecord(alice.userId, 'Développé couché', 80);
      await addRecord(alice.userId, 'Tractions', 20);

      const res = await request(app)
        .put('/api/users/me/records-showcase')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ exerciseNames: ['Tractions', 'Squat', 'Développé couché'] });

      expect(res.body.showcasedRecords).toEqual(['Tractions', 'Squat', 'Développé couché']);
    });

    it('❌ 400 si plus de 6 exercices', async () => {
      const res = await request(app)
        .put('/api/users/me/records-showcase')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ exerciseNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] });
      expect(res.statusCode).toBe(400);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).put('/api/users/me/records-showcase').send({ exerciseNames: [] });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/friends/profile/:friendId — records mis en avant', () => {
    beforeEach(async () => {
      await Friendship.create({ requester: alice.userId, recipient: bob.userId, status: 'accepted' });
    });

    it("✅ Utilise showcasedRecords de l'ami (ordre préservé) quand configuré", async () => {
      await addRecord(bob.userId, 'Squat', 150);
      await addRecord(bob.userId, 'Développé couché', 100);
      await addRecord(bob.userId, 'Tractions', 25);

      await request(app)
        .put('/api/users/me/records-showcase')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ exerciseNames: ['Tractions', 'Développé couché'] }); // pas triés par poids

      const res = await request(app)
        .get(`/api/friends/profile/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.profile.records.map((r) => r.exercice)).toEqual(['Tractions', 'Développé couché']);
      // Squat existe mais n'est pas dans la vitrine -> absent
      expect(res.body.profile.records.find((r) => r.exercice === 'Squat')).toBeUndefined();
    });

    it("✅ Repli sur le top 5 auto par poids si aucune vitrine configurée", async () => {
      await addRecord(bob.userId, 'Squat', 150);
      await addRecord(bob.userId, 'Développé couché', 100);

      const res = await request(app)
        .get(`/api/friends/profile/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.profile.records.map((r) => r.exercice)).toEqual(['Squat', 'Développé couché']);
    });

    it("✅ Aucun record si l'ami n'a jamais rien enregistré", async () => {
      const res = await request(app)
        .get(`/api/friends/profile/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.body.profile.records).toEqual([]);
    });
  });
});
