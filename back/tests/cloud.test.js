const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const CloudItem = require('../models/CloudItem');
const Workout = require('../models/Workout');

// Sauvegarde du compte : historique, séances enregistrées, exercices perso et
// préférences, pour les retrouver sur un nouvel appareil.
describe('Cloud API — sauvegarde du compte', () => {
  let token;
  let otherToken;

  const register = async (pseudo, email) => {
    await request(app).post('/api/auth/register').send({ pseudo, email, password: 'Password123!' });
    await User.updateOne({ email }, { isVerified: true });
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
    return res.body.token;
  };

  const log = (id, xp = 120) => ({
    id, date: '2026-10-01T10:00:00.000Z', name: 'Séance Push', xpEarned: xp,
    exercises: [{ name: 'Développé couché', sets: [{ weight: 80, reps: 8, completed: true }] }],
    muscleDistribution: { pectoraux: 640 },
  });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGO_URI);
    token = await register('Cloud User', 'cloud@test.fr');
    otherToken = await register('Autre User', 'cloud-autre@test.fr');
  });

  beforeEach(async () => {
    await CloudItem.deleteMany();
    await Workout.deleteMany();
    await User.updateMany({}, { $set: { xp: 0, level: 0, xpFloor: null } });
  });

  afterAll(async () => {
    await CloudItem.deleteMany();
    await User.deleteMany();
    await mongoose.connection.close();
  });

  const sync = (kind, body, t = token) => request(app)
    .post(`/api/cloud/${kind}/sync`).set('Authorization', `Bearer ${t}`).send(body);
  const list = (kind, t = token) => request(app)
    .get(`/api/cloud/${kind}`).set('Authorization', `Bearer ${t}`);

  it('✅ Sauvegarde puis restitue les séances telles quelles', async () => {
    const res = await sync('logs', { puts: [log('log-a'), log('log-b', 300)] });
    expect(res.statusCode).toBe(200);

    const back = await list('logs');
    expect(back.statusCode).toBe(200);
    const byId = Object.fromEntries(back.body.items.map((i) => [i.id, i]));
    expect(byId['log-b'].data.xpEarned).toBe(300);
    expect(byId['log-a'].data.exercises[0].sets[0].weight).toBe(80);
    expect(byId['log-a'].deleted).toBe(false);
  });

  it('✅ Une modification remplace la version précédente', async () => {
    await sync('savedWorkouts', { puts: [{ id: 'sw-1', name: 'Push A' }] });
    await sync('savedWorkouts', { puts: [{ id: 'sw-1', name: 'Push B' }] });
    const back = await list('savedWorkouts');
    expect(back.body.items).toHaveLength(1);
    expect(back.body.items[0].data.name).toBe('Push B');
  });

  it('✅ Une suppression laisse une trace pour les autres appareils', async () => {
    await sync('logs', { puts: [log('log-a')] });
    await sync('logs', { dels: ['log-a'] });
    const back = await list('logs');
    expect(back.body.items).toEqual([{ id: 'log-a', data: null, deleted: true }]);

    // Restauration explicite (ex : réécrite par un autre appareil)
    await sync('logs', { puts: [log('log-a')] });
    const again = await list('logs');
    expect(again.body.items[0].deleted).toBe(false);
  });

  it("🔒 Chaque compte ne voit que sa propre sauvegarde", async () => {
    await sync('logs', { puts: [log('log-secret')] });
    const other = await list('logs', otherToken);
    expect(other.body.items).toEqual([]);

    // Même id côté autre compte : n'écrase rien chez le premier
    await sync('logs', { puts: [log('log-secret', 1)] }, otherToken);
    const mine = await list('logs');
    expect(mine.body.items[0].data.xpEarned).toBe(120);
  });

  it('❌ 404 pour un type de sauvegarde inconnu', async () => {
    const res = await list('passwords');
    expect(res.statusCode).toBe(404);
  });

  it('❌ 400 si un identifiant est invalide', async () => {
    const res = await sync('logs', { puts: [{ id: '../../etc', name: 'x' }] });
    expect(res.statusCode).toBe(400);
  });

  it('❌ 413 si un élément est trop volumineux', async () => {
    const res = await sync('prefs', { puts: [{ id: 'profileTheme', value: 'x'.repeat(9000) }] });
    expect(res.statusCode).toBe(413);
  });

  it("🔒 Les clés d'opérateur MongoDB sont retirées des données", async () => {
    await sync('logs', { puts: [{ ...log('log-x'), notes: { $gt: '' } }] });
    const back = await list('logs');
    expect(back.body.items[0].data.notes).toEqual({});
  });

  it('❌ 401 sans token', async () => {
    const res = await request(app).get('/api/cloud/logs');
    expect(res.statusCode).toBe(401);
  });

  it('🗑️ La suppression du compte efface sa sauvegarde', async () => {
    const t = await register('Ephemere', 'cloud-delete@test.fr');
    await sync('logs', { puts: [log('log-z')] }, t);
    const userId = (await User.findOne({ email: 'cloud-delete@test.fr' }))._id;
    expect(await CloudItem.countDocuments({ user: userId })).toBe(1);

    const userService = require('../services/user.service');
    await userService.deleteAccount(String(userId));
    expect(await CloudItem.countDocuments({ user: userId })).toBe(0);
  });

  describe("XP du compte calculée à partir de l'historique sauvegardé", () => {
    const me = () => User.findOne({ email: 'cloud@test.fr' });

    it("l'XP du compte suit les séances sauvegardées, suppressions comprises", async () => {
      await sync('logs', { puts: [log('log-a', 120), log('log-b', 300)] });
      expect((await me()).xp).toBe(420);
      await sync('logs', { dels: ['log-b'] });
      expect((await me()).xp).toBe(120);
    });

    it("corrige le double comptage d'avant (XP gonflée par les séances)", async () => {
      await User.updateOne({ email: 'cloud@test.fr' }, { $set: { xp: 5000 } });
      await sync('logs', { puts: [log('log-a', 2500)] });
      expect((await me()).xp).toBe(2500);
    });

    it("le total envoyé par l'app n'est plus pris tel quel une fois le compte sauvegardé", async () => {
      await sync('logs', { puts: [log('log-a', 120)] });
      const res = await request(app).post('/api/users/me/sync-xp').set('Authorization', `Bearer ${token}`).send({ xp: 14000 });
      expect(res.statusCode).toBe(200);
      expect(res.body.xp).toBe(120);
    });

    it("ignore une XP négative et applique le plafond d'ancienneté", async () => {
      await sync('logs', { puts: [log('log-a', -5000), log('log-b', 999999)] });
      const { XP_CEILING_PER_DAY } = require('../services/user.service');
      expect((await me()).xp).toBe(XP_CEILING_PER_DAY);
    });
  });

  describe('GET /api/cloud/recovery — reconstruire un historique perdu', () => {
    const finished = (userId, minutesAgo, overrides = {}) => Workout.create({
      user: userId, name: 'Séance Push', status: 'completed', durationSeconds: 1800, xpEarned: 200,
      exercises: [{ name: 'Développé couché', targetMuscle: 'Pectoraux', sets: [{ weight: 80, reps: 8, completed: true }] }],
      completedAt: new Date(Date.now() - minutesAgo * 60000),
      ...overrides,
    });

    it("renvoie les séances terminées et l'XP acquise sans le double comptage", async () => {
      const user = await User.findOne({ email: 'cloud@test.fr' });
      await User.updateOne({ _id: user._id }, { $set: { xp: 10000 } });
      await finished(user._id, 60);
      await finished(user._id, 2000, { durationSeconds: 600 });            // < 15 min : 20 XP ajoutés
      await finished(user._id, 3000, { shortSession: true });               // séance courte : 0
      await finished(user._id, 4000, { serverXpAdded: false });            // déjà corrigée : 0
      await Workout.create({ user: user._id, name: 'Brouillon', status: 'in_progress' });

      const res = await list('recovery');
      expect(res.statusCode).toBe(200);
      expect(res.body.xpFloor).toBe(10000 - 200 - 20);
      expect(res.body.workouts).toHaveLength(4);
      expect(res.body.workouts[0].exercises[0].sets[0]).toEqual({ weight: 80, reps: 8, completed: true });
    });

    it("mémorise l'XP de référence avant que le recalcul ne la remplace", async () => {
      const user = await User.findOne({ email: 'cloud@test.fr' });
      await User.updateOne({ _id: user._id }, { $set: { xp: 8000 } });
      await sync('logs', { puts: [log('log-a', 100)] });
      const res = await list('recovery');
      expect(res.body.xpFloor).toBe(8000);
      expect((await User.findById(user._id)).xp).toBe(100);
    });

    it("🔒 ne renvoie jamais les séances d'un autre compte", async () => {
      const other = await User.findOne({ email: 'cloud-autre@test.fr' });
      await finished(other._id, 30);
      const res = await list('recovery');
      expect(res.body.workouts).toEqual([]);
    });
  });
});
