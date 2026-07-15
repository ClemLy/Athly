'use strict';

const request       = require('supertest');
const mongoose       = require('mongoose');
const app            = require('../app');
const User           = require('../models/User');
const Friendship     = require('../models/Friendship');
const StreakGroup    = require('../models/StreakGroup');
const Workout        = require('../models/Workout');
const ActivityEvent  = require('../models/ActivityEvent');

async function createAndLoginUser(pseudo, email) {
  await request(app).post('/api/auth/register').send({ pseudo, email, password: 'Password123!' });
  await User.updateOne({ email }, { isVerified: true });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

describe("Flux d'activité « Taquineries & High-Fives » — Section IV", () => {
  let alice, bob;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await StreakGroup.deleteMany({});
    await Workout.deleteMany({});
    await ActivityEvent.deleteMany({});

    alice = await createAndLoginUser('AliceActivity', 'alice.activity@athly.fr');
    bob   = await createAndLoginUser('BobActivity',   'bob.activity@athly.fr');

    await Friendship.create({ requester: alice.userId, recipient: bob.userId, status: 'accepted' });
    await StreakGroup.create({ members: [alice.userId, bob.userId] });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await StreakGroup.deleteMany({});
    await Workout.deleteMany({});
    await ActivityEvent.deleteMany({});
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await ActivityEvent.deleteMany({});
    await Workout.deleteMany({});
  });

  describe('Détection de PR sur POST /api/exercises/', () => {
    it("✅ Publie un événement pr_broken quand un nouveau poids max est atteint", async () => {
      const workoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titre: 'Séance PR', categorie: 'Push' });
      const workoutId = workoutRes.body.workout._id;

      await request(app)
        .post('/api/exercises/')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ workout: workoutId, exerciceNom: 'Squat', series: [{ repetitions: 5, poids: 100 }] });

      const events = await ActivityEvent.find({ type: 'pr_broken' });
      expect(events.length).toBe(1);
      expect(events[0].message).toContain('Squat');
      expect(events[0].payload.weight).toBe(100);
    });

    it("❌ Ne publie rien si le poids n'excède pas le max déjà enregistré", async () => {
      const workoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titre: 'Séance 1', categorie: 'Push' });
      const w1 = workoutRes.body.workout._id;

      await request(app)
        .post('/api/exercises/')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ workout: w1, exerciceNom: 'Développé Couché', series: [{ repetitions: 5, poids: 80 }] });

      const workout2Res = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titre: 'Séance 2', categorie: 'Push' });
      const w2 = workout2Res.body.workout._id;

      await request(app)
        .post('/api/exercises/')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ workout: w2, exerciceNom: 'Développé Couché', series: [{ repetitions: 5, poids: 70 }] });

      const events = await ActivityEvent.find({ type: 'pr_broken', 'payload.exercise': 'Développé Couché' });
      expect(events.length).toBe(1); // uniquement la première séance (80kg)
    });
  });

  describe('GET /api/activity/feed & POST /api/activity/:eventId/react', () => {
    it("✅ Bob voit le PR d'Alice dans son feed, mais pas Alice elle-même", async () => {
      const workoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titre: 'Séance', categorie: 'Push' });
      const workoutId = workoutRes.body.workout._id;

      await request(app)
        .post('/api/exercises/')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ workout: workoutId, exerciceNom: 'Soulevé de Terre', series: [{ repetitions: 3, poids: 150 }] });

      const bobFeed = await request(app)
        .get('/api/activity/feed')
        .set('Authorization', `Bearer ${bob.token}`);
      expect(bobFeed.statusCode).toBe(200);
      expect(bobFeed.body.events.length).toBe(1);
      expect(bobFeed.body.events[0].actor.pseudo).toBe('AliceActivity');

      const aliceFeed = await request(app)
        .get('/api/activity/feed')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(aliceFeed.body.events.length).toBe(0);
    });

    it("✅ Le feed ne renvoie pas deux fois le même événement (curseur lastActivityFeedCheckAt)", async () => {
      const workoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titre: 'Séance', categorie: 'Push' });
      const workoutId = workoutRes.body.workout._id;

      await request(app)
        .post('/api/exercises/')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ workout: workoutId, exerciceNom: 'Overhead Press', series: [{ repetitions: 5, poids: 40 }] });

      const firstFeed = await request(app).get('/api/activity/feed').set('Authorization', `Bearer ${bob.token}`);
      expect(firstFeed.body.events.length).toBe(1);

      const secondFeed = await request(app).get('/api/activity/feed').set('Authorization', `Bearer ${bob.token}`);
      expect(secondFeed.body.events.length).toBe(0);
    });

    it("✅ Bob réagit à l'événement d'Alice avec 'respect'", async () => {
      const workoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titre: 'Séance', categorie: 'Push' });
      const workoutId = workoutRes.body.workout._id;

      await request(app)
        .post('/api/exercises/')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ workout: workoutId, exerciceNom: 'Traction', series: [{ repetitions: 8, poids: 20 }] });

      const event = await ActivityEvent.findOne({ type: 'pr_broken', 'payload.exercise': 'Traction' });

      const reactRes = await request(app)
        .post(`/api/activity/${event._id}/react`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ emoji: 'respect' });

      expect(reactRes.statusCode).toBe(200);
      expect(reactRes.body.reactions.length).toBe(1);
      expect(reactRes.body.reactions[0].emoji).toBe('respect');
    });

    it("❌ 400 si l'émoji de réaction n'est pas dans la liste autorisée", async () => {
      const workoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titre: 'Séance', categorie: 'Push' });
      const workoutId = workoutRes.body.workout._id;

      await request(app)
        .post('/api/exercises/')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ workout: workoutId, exerciceNom: 'Fentes', series: [{ repetitions: 8, poids: 25 }] });

      const event = await ActivityEvent.findOne({ type: 'pr_broken', 'payload.exercise': 'Fentes' });

      const reactRes = await request(app)
        .post(`/api/activity/${event._id}/react`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ emoji: 'not_a_real_emoji' });

      expect(reactRes.statusCode).toBe(400);
    });

    it("❌ Refusé avec 401 sans token", async () => {
      const res = await request(app).get('/api/activity/feed');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Coffre Légendaire — annonce au groupe', () => {
    it("✅ Publie un événement chest_legendary quand un coffre légendaire est tiré", async () => {
      // La rareté légendaire n'a que 3% de chance par tirage (chest.service.js) :
      // on ouvre suffisamment de coffres pour en obtenir au moins un avec une
      // probabilité d'échec négligeable (~1 - 0.97^300 ≈ 99.999%), plutôt que
      // de mocker le tirage — inventory.controller.js déstructure
      // `drawChestItem` à l'import, un spy sur le module ne l'atteindrait pas.
      await User.updateOne(
        { _id: alice.userId },
        { $set: { level: 11, inventory: [{ itemType: 'CHEST_KEY', rarity: 'common', quantity: 300 }] } },
      );

      let legendaryEventFound = false;
      for (let i = 0; i < 300 && !legendaryEventFound; i++) {
        await request(app)
          .post('/api/inventory/chest/open')
          .set('Authorization', `Bearer ${alice.token}`);

        legendaryEventFound = Boolean(await ActivityEvent.findOne({ type: 'chest_legendary' }));
      }

      expect(legendaryEventFound).toBe(true);
      const event = await ActivityEvent.findOne({ type: 'chest_legendary' });
      expect(event.message).toContain('Légendaire');
    }, 30000);
  });
});
