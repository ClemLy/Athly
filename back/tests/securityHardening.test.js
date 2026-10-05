'use strict';

// Tests de non-régression de l'audit de sécurité (préparation à la mise en
// production) : chaque test correspond à une faille corrigée.

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const User           = require('../models/User');
const Workout        = require('../models/Workout');
const Friendship     = require('../models/Friendship');
const StreakGroup    = require('../models/StreakGroup');
const WeightHistory  = require('../models/WeightHistory');
const ExerciseRecord = require('../models/ExerciseRecord');
const emailService   = require('../services/email.service');

const PASSWORD = 'Password123!';

async function createAndLoginUser(pseudo, email) {
  await request(app).post('/api/auth/register').send({ pseudo, email, password: PASSWORD });
  await User.updateOne({ email }, { isVerified: true });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

function lastCodeSentTo(mockFn, email) {
  const calls = mockFn.mock.calls.filter(([to]) => to === email);
  return calls.length ? calls[calls.length - 1][1] : null;
}

describe('Audit de sécurité : non-régression', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}), Workout.deleteMany({}), Friendship.deleteMany({}),
      StreakGroup.deleteMany({}), WeightHistory.deleteMany({}), ExerciseRecord.deleteMany({}),
    ]);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({}), Workout.deleteMany({}), Friendship.deleteMany({}),
      StreakGroup.deleteMany({}), WeightHistory.deleteMany({}), ExerciseRecord.deleteMany({}),
    ]);
    await mongoose.connection.close();
  });

  // ── Authentification ──────────────────────────────────────────────────────
  describe('Codes OTP', () => {
    it('stocke le code de vérification haché (jamais en clair)', async () => {
      await request(app).post('/api/auth/register')
        .send({ pseudo: 'Hache', email: 'hache@athly.fr', password: PASSWORD });

      const code = lastCodeSentTo(emailService.sendVerificationEmail, 'hache@athly.fr');
      const user = await User.findOne({ email: 'hache@athly.fr' });

      expect(code).toMatch(/^\d{6}$/);
      expect(user.verificationCode).toBeDefined();
      expect(user.verificationCode).not.toBe(code);
    });

    it('valide le compte avec le code reçu par email', async () => {
      await request(app).post('/api/auth/register')
        .send({ pseudo: 'Valide', email: 'valide@athly.fr', password: PASSWORD });
      const code = lastCodeSentTo(emailService.sendVerificationEmail, 'valide@athly.fr');

      const res = await request(app).post('/api/auth/verify-email')
        .send({ email: 'valide@athly.fr', code });

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    it("n'envoie pas de nouveau code moins d'une minute après le précédent (anti-spam silencieux)", async () => {
      await request(app).post('/api/auth/register')
        .send({ pseudo: 'Spam', email: 'spam@athly.fr', password: PASSWORD });

      const res = await request(app).post('/api/auth/resend-verification')
        .send({ email: 'spam@athly.fr' });

      expect(res.statusCode).toBe(200);
      const sent = emailService.sendVerificationEmail.mock.calls.filter(([to]) => to === 'spam@athly.fr');
      expect(sent.length).toBe(1);
    });

    it("mot de passe oublié : même réponse que l'adresse existe ou non", async () => {
      await createAndLoginUser('Existe', 'existe@athly.fr');
      await User.updateOne({ email: 'existe@athly.fr' }, { lastCodeSentAt: null });

      const known   = await request(app).post('/api/auth/forgot-password').send({ email: 'existe@athly.fr' });
      const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'personne@athly.fr' });

      expect(known.statusCode).toBe(200);
      expect(unknown.statusCode).toBe(200);
      expect(unknown.body.message).toBe(known.body.message);
    });

    it('verify-email sur une adresse inconnue ne révèle pas son absence', async () => {
      const res = await request(app).post('/api/auth/verify-email')
        .send({ email: 'fantome@athly.fr', code: '123456' });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_CODE');
    });
  });

  describe('Sessions', () => {
    it('une réinitialisation du mot de passe invalide les tokens déjà émis', async () => {
      const alice = await createAndLoginUser('AliceReset', 'alice.reset@athly.fr');
      // Le changement de mot de passe doit être postérieur à l'émission du token
      await User.updateOne({ _id: alice.userId }, { lastCodeSentAt: null });
      await new Promise((r) => setTimeout(r, 2100));

      await request(app).post('/api/auth/forgot-password').send({ email: 'alice.reset@athly.fr' });
      const code = lastCodeSentTo(emailService.sendResetPasswordEmail, 'alice.reset@athly.fr');

      const reset = await request(app).post('/api/auth/reset-password')
        .send({ email: 'alice.reset@athly.fr', code, newPassword: 'NouveauMdp42' });
      expect(reset.statusCode).toBe(200);

      const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${alice.token}`);
      expect(me.statusCode).toBe(401);
      expect(me.body.code).toBe('SESSION_EXPIRED');

      const login = await request(app).post('/api/auth/login')
        .send({ email: 'alice.reset@athly.fr', password: 'NouveauMdp42' });
      expect(login.statusCode).toBe(200);
      const meAgain = await request(app).get('/api/users/me').set('Authorization', `Bearer ${login.body.token}`);
      expect(meAgain.statusCode).toBe(200);
    });

    it("un token d'un compte supprimé est refusé", async () => {
      const bob = await createAndLoginUser('BobDelete', 'bob.delete@athly.fr');
      await request(app).delete('/api/users/delete-account').set('Authorization', `Bearer ${bob.token}`);

      const res = await request(app).post('/api/workouts/draft')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ name: 'Fantôme' });
      expect(res.statusCode).toBe(401);
      expect(await Workout.countDocuments({ user: bob.userId })).toBe(0);
    });

    it('GET /users/me ne renvoie aucun secret d\'authentification', async () => {
      const carol = await createAndLoginUser('CarolSecret', 'carol.secret@athly.fr');
      const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${carol.token}`);

      expect(res.statusCode).toBe(200);
      for (const field of ['password', 'verificationCode', 'resetPasswordCode', 'verifyAttempts', 'codeExpires', 'googleId']) {
        expect(res.body.user).not.toHaveProperty(field);
      }
    });

    it('refuse un mot de passe trop faible à l\'inscription', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ pseudo: 'Faible', email: 'faible@athly.fr', password: 'abcdef' });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/8 caractères/);
    });
  });

  // ── Séances ───────────────────────────────────────────────────────────────
  describe('Séances', () => {
    it("un brouillon ne peut pas être créé au nom d'un autre utilisateur ni déjà terminé", async () => {
      const attacker = await createAndLoginUser('Pirate', 'pirate@athly.fr');
      const victim   = await createAndLoginUser('Cible', 'cible@athly.fr');

      const res = await request(app).post('/api/workouts/draft')
        .set('Authorization', `Bearer ${attacker.token}`)
        .send({ name: 'Séance', user: victim.userId, status: 'finished', xpEarned: 99999 });

      // Champs interdits refusés par la validation
      expect(res.statusCode).toBe(400);
      expect(await Workout.countDocuments({ user: victim.userId })).toBe(0);
    });

    it('le brouillon appartient toujours à son créateur et démarre en draft', async () => {
      const alice = await createAndLoginUser('AliceDraft', 'alice.draft@athly.fr');
      const res = await request(app).post('/api/workouts/draft')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ name: 'Push', exercises: [{ name: 'Développé couché', sets: [{ weight: '', reps: 8 }] }], status: 'draft' });

      expect(res.statusCode).toBe(201);
      expect(res.body.workout.user).toBe(alice.userId);
      expect(res.body.workout.status).toBe('draft');
    });

    it("finaliser deux fois la même séance n'attribue l'XP qu'une seule fois", async () => {
      const alice = await createAndLoginUser('AliceFinal', 'alice.final@athly.fr');
      const draft = await Workout.create({ user: alice.userId, name: 'Séance', status: 'in_progress' });

      const [a, b] = await Promise.all([
        request(app).post(`/api/workouts/${draft._id}/finalize`).set('Authorization', `Bearer ${alice.token}`).send({ durationSeconds: 1800 }),
        request(app).post(`/api/workouts/${draft._id}/finalize`).set('Authorization', `Bearer ${alice.token}`).send({ durationSeconds: 1800 }),
      ]);

      const statuses = [a.statusCode, b.statusCode].sort();
      expect(statuses).toEqual([200, 409]);

      const user = await User.findById(alice.userId).select('xp');
      expect(user.xp).toBe(100); // 100 XP de base, une seule fois
    });

    it('/complete après /finalize ne redonne pas d\'XP', async () => {
      const alice = await createAndLoginUser('AliceComplete', 'alice.complete@athly.fr');
      const draft = await Workout.create({ user: alice.userId, name: 'Séance', status: 'in_progress' });

      await request(app).post(`/api/workouts/${draft._id}/finalize`).set('Authorization', `Bearer ${alice.token}`).send({ durationSeconds: 1800 });
      const complete = await request(app).post(`/api/workouts/${draft._id}/complete`).set('Authorization', `Bearer ${alice.token}`);

      expect(complete.statusCode).toBe(200);
      expect(complete.body.stats.xp).toBe(0);
      const user = await User.findById(alice.userId).select('xp');
      expect(user.xp).toBe(100);
    });

    it('une durée déclarée absurde est plafonnée (pas de coffres en rafale)', async () => {
      const alice = await createAndLoginUser('AliceDuree', 'alice.duree@athly.fr');
      await User.updateOne({ _id: alice.userId }, { level: 20, totalWorkoutMinutes: 0 });
      const draft = await Workout.create({ user: alice.userId, name: 'Séance', status: 'in_progress' });

      const res = await request(app).post(`/api/workouts/${draft._id}/finalize`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ durationSeconds: 20 * 3600 });

      expect(res.statusCode).toBe(200);
      const user = await User.findById(alice.userId).select('totalWorkoutMinutes');
      expect(user.totalWorkoutMinutes).toBeLessThanOrEqual(6 * 60);
    });

    it('une séance introuvable renvoie 404 (et non 500)', async () => {
      const alice = await createAndLoginUser('Alice404', 'alice.404@athly.fr');
      const res = await request(app).get(`/api/workouts/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(404);
    });
  });

  // ── RGPD ──────────────────────────────────────────────────────────────────
  describe('Suppression de compte (RGPD)', () => {
    it('efface toutes les données liées au compte', async () => {
      const alice = await createAndLoginUser('AliceRgpd', 'alice.rgpd@athly.fr');
      const bob   = await createAndLoginUser('BobRgpd', 'bob.rgpd@athly.fr');

      await Friendship.create({ requester: alice.userId, recipient: bob.userId, status: 'accepted' });
      await StreakGroup.create({ members: [alice.userId, bob.userId] });
      await WeightHistory.create({ user: alice.userId, weight: 70 });
      await Workout.create({ user: alice.userId, name: 'Séance' });

      const res = await request(app).delete('/api/users/delete-account').set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(200);

      expect(await User.exists({ _id: alice.userId })).toBeNull();
      expect(await Friendship.countDocuments({ $or: [{ requester: alice.userId }, { recipient: alice.userId }] })).toBe(0);
      expect(await WeightHistory.countDocuments({ user: alice.userId })).toBe(0);
      expect(await Workout.countDocuments({ user: alice.userId })).toBe(0);
      const group = await StreakGroup.findOne({ members: bob.userId });
      expect(group.members.map(String)).toEqual([bob.userId]);
    });
  });

  // ── Erreurs ───────────────────────────────────────────────────────────────
  describe('Erreurs', () => {
    it('un JSON malformé renvoie un 400 lisible', async () => {
      const res = await request(app).post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": ');
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('BAD_JSON');
    });

    it("une route inconnue ne renvoie pas l'URL demandée", async () => {
      const res = await request(app).get('/api/route-qui-nexiste-pas?<script>');
      expect(res.statusCode).toBe(404);
      expect(JSON.stringify(res.body)).not.toMatch(/script/);
    });
  });
});
