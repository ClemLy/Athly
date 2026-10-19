const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Workout = require('../models/Workout');
const ExerciseRecord = require('../models/ExerciseRecord');

// Les records personnels (profil, classement des records) sont enregistrés à
// la fin de chaque séance, à partir des séries réellement faites.
describe('Records enregistrés en fin de séance', () => {
  let token;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGO_URI);
    await request(app).post('/api/auth/register').send({ pseudo: 'Record User', email: 'records@test.fr', password: 'Password123!' });
    await User.updateOne({ email: 'records@test.fr' }, { isVerified: true });
    token = (await request(app).post('/api/auth/login').send({ email: 'records@test.fr', password: 'Password123!' })).body.token;
  });

  afterAll(async () => {
    await ExerciseRecord.deleteMany();
    await Workout.deleteMany();
    await User.deleteMany();
    await mongoose.connection.close();
  });

  const finish = async (exercises, durationSeconds = 1800) => {
    const draft = await request(app).post('/api/workouts/draft').set('Authorization', `Bearer ${token}`).send({ name: 'Séance', exercises });
    const id = draft.body.workout?._id || draft.body.data?._id || draft.body._id;
    return request(app).post(`/api/workouts/${id}/finalize`).set('Authorization', `Bearer ${token}`).send({ exercises, durationSeconds });
  };

  it('enregistre chaque exercice fait, sans les séries d’échauffement ni les tenues', async () => {
    const res = await finish([
      { name: 'Développé couché', sets: [
        { weight: 40, reps: 10, completed: true, warmup: true },
        { weight: 80, reps: 8, completed: true },
        { weight: 85, reps: 5, completed: false },
      ] },
      { name: 'Tractions', sets: [{ weight: 0, reps: 9, completed: true }] },
      { name: 'Gainage', sets: [{ weight: 0, reps: 0, seconds: 60, completed: true }] },
    ]);
    expect(res.statusCode).toBe(200);

    const records = await ExerciseRecord.find().lean();
    const byName = Object.fromEntries(records.map((r) => [r.exerciceNom, r]));
    expect(byName['Développé couché'].series).toEqual([expect.objectContaining({ poids: 80, repetitions: 8 })]);
    expect(byName.Tractions.series[0].repetitions).toBe(9);
    expect(byName.Gainage).toBeUndefined();

    const mine = await request(app).get('/api/exercises/my-records').set('Authorization', `Bearer ${token}`);
    expect(mine.statusCode).toBe(200);
    expect(JSON.stringify(mine.body)).toContain('Tractions');
  });

  it('garde la durée et les séries d’échauffement sur la séance enregistrée', async () => {
    await finish([{ name: 'Gainage', sets: [{ weight: 0, reps: 0, seconds: 45, completed: true }, { weight: 0, reps: 0, seconds: 20, warmup: true, completed: true }] }]);
    const w = await Workout.findOne({ 'exercises.name': 'Gainage', status: { $in: ['finished', 'completed'] } }).sort({ updatedAt: -1 }).lean();
    expect(w.exercises[0].sets[0].seconds).toBe(45);
    expect(w.exercises[0].sets[1].warmup).toBe(true);
  });

  it("une séance trop courte n'enregistre aucun record", async () => {
    const before = await ExerciseRecord.countDocuments();
    await finish([{ name: 'Squat', sets: [{ weight: 100, reps: 5, completed: true }] }], 120);
    expect(await ExerciseRecord.countDocuments()).toBe(before);
  });
});
