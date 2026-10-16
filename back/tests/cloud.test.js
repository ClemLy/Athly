const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const CloudItem = require('../models/CloudItem');

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
});
