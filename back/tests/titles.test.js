'use strict';

const request        = require('supertest');
const mongoose        = require('mongoose');
const app             = require('../app');
const User             = require('../models/User');
const StreakGroup      = require('../models/StreakGroup');
const Workout          = require('../models/Workout');
const WorkoutLobby     = require('../models/WorkoutLobby');
const ExerciseRecord   = require('../models/ExerciseRecord');
const { checkAndUnlockTitles } = require('../controllers/title.controller');

async function createAndLoginUser(pseudo, email) {
  await request(app).post('/api/auth/register').send({ pseudo, email, password: 'Password123!' });
  await User.updateOne({ email }, { isVerified: true });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

describe('Titres déblocables — Section X', () => {
  let alice, bob;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await StreakGroup.deleteMany({});
    await Workout.deleteMany({});
    await WorkoutLobby.deleteMany({});
    await ExerciseRecord.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await StreakGroup.deleteMany({});
    await Workout.deleteMany({});
    await WorkoutLobby.deleteMany({});
    await ExerciseRecord.deleteMany({});
    alice = await createAndLoginUser('AliceTitle', 'alice.title@athly.fr');
    bob   = await createAndLoginUser('BobTitle', 'bob.title@athly.fr');
  });

  describe('GET /api/profile/titles', () => {
    it('✅ Renvoie les 17 titres du catalogue, tous verrouillés par défaut', async () => {
      const res = await request(app)
        .get('/api/profile/titles')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.titles.length).toBe(17);
      expect(res.body.titles.every((t) => t.unlocked === false)).toBe(true);
      expect(res.body.equippedTitle).toBeNull();
    });

    it('✅ Reflète unlockedTitles et fournit une progression pour les titres à seuil', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { unlockedTitles: ['PERFORM_LEVEL_10'], level: 12 } });

      const res = await request(app)
        .get('/api/profile/titles')
        .set('Authorization', `Bearer ${alice.token}`);

      const lvl10 = res.body.titles.find((t) => t.id === 'PERFORM_LEVEL_10');
      expect(lvl10.unlocked).toBe(true);
      expect(lvl10.progress).toEqual({ current: 10, target: 10 });
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).get('/api/profile/titles');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/profile/equip-title', () => {
    it('✅ Équipe un titre débloqué', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { unlockedTitles: ['PERFORM_LEVEL_10'] } });

      const res = await request(app)
        .post('/api/profile/equip-title')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titleId: 'PERFORM_LEVEL_10' });

      expect(res.statusCode).toBe(200);
      expect(res.body.equippedTitle).toBe('PERFORM_LEVEL_10');

      const user = await User.findById(alice.userId);
      expect(user.equippedTitle).toBe('PERFORM_LEVEL_10');
    });

    it("❌ 403 si le titre n'est pas débloqué", async () => {
      const res = await request(app)
        .post('/api/profile/equip-title')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titleId: 'PERFORM_LEVEL_50' });

      expect(res.statusCode).toBe(403);
    });

    it('❌ 400 si titleId inconnu', async () => {
      const res = await request(app)
        .post('/api/profile/equip-title')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titleId: 'NOT_A_REAL_TITLE' });

      expect(res.statusCode).toBe(400);
    });

    it('✅ Déséquipe si titleId est null', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { $set: { unlockedTitles: ['PERFORM_LEVEL_10'], equippedTitle: 'PERFORM_LEVEL_10' } },
      );

      const res = await request(app)
        .post('/api/profile/equip-title')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ titleId: null });

      expect(res.statusCode).toBe(200);
      expect(res.body.equippedTitle).toBeNull();
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/profile/equip-title').send({ titleId: 'PERFORM_LEVEL_10' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('checkAndUnlockTitles — conditions', () => {
    it('✅ PERFORM_LEVEL_10 / PERFORM_LEVEL_50 selon le niveau', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { level: 10 } });
      let unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('PERFORM_LEVEL_10');
      expect(unlocked).not.toContain('PERFORM_LEVEL_50');

      await User.updateOne({ _id: alice.userId }, { $set: { level: 50 } });
      unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('PERFORM_LEVEL_50');
    });

    it('✅ REFERRAL_EARLY si referredBy est renseigné', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { referredBy: bob.userId } });
      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('REFERRAL_EARLY');
    });

    it('✅ LOOT_LEGENDARY si un item Légendaire est en inventaire', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { $set: { inventory: [{ itemType: 'LEVEL_COUPON', rarity: 'legendary', quantity: 1 }] } },
      );
      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('LOOT_LEGENDARY');
    });

    it('✅ LOOT_BLOOD_UNIQUE via un item Unique en inventaire OU un cosmétique déjà réclamé', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { $set: { inventory: [{ itemType: 'FRAME_COLOR_BLOOD_SANG', rarity: 'unique', quantity: 1 }] } },
      );
      let unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('LOOT_BLOOD_UNIQUE');

      // Bob : item Unique déjà consommé (claimUniqueItem) — plus en inventaire,
      // mais présent dans unlockedCosmetics.
      await User.updateOne({ _id: bob.userId }, { $set: { unlockedCosmetics: ['FRAME_COLOR_BLOODSANG'] } });
      unlocked = await checkAndUnlockTitles(bob.userId);
      expect(unlocked).toContain('LOOT_BLOOD_UNIQUE');
    });

    it('✅ INVENTORY_HOARDER dès 10 objets cumulés', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { $set: { inventory: [{ itemType: 'ENERGY_DRINK', rarity: 'common', quantity: 10 }] } },
      );
      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('INVENTORY_HOARDER');
    });

    it('✅ MULTI_SESSIONS_30_TITLE à 30 séances Multi cumulées', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { totalMultiSessions: 30 } });
      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('MULTI_SESSIONS_30_TITLE');
    });

    it('✅ SHAME_BURNING dès 15 secousses envoyées', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { totalShakesSent: 15 } });
      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('SHAME_BURNING');
    });

    it('✅ WORKOUT_IRON_BREAKER à 100 séries cumulées', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { totalSetsCompleted: 100 } });
      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('WORKOUT_IRON_BREAKER');
    });

    it('✅ STREAK_INSUBMERSIBLE à 3 sauvetages de streak consécutifs', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { consecutiveStreakGelSaves: 3 } });
      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('STREAK_INSUBMERSIBLE');
    });

    it('✅ PR_HEAVY_100 sur un record > 100kg pour un exercice majeur', async () => {
      const workout = await Workout.create({ user: alice.userId, status: 'completed' });
      await ExerciseRecord.create({
        user: alice.userId,
        workout: workout._id,
        exerciceNom: 'Squat',
        series: [{ poids: 120, repetitions: 3 }],
      });
      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('PR_HEAVY_100');
    });

    it("❌ PR_HEAVY_100 non débloqué si l'exercice n'est pas majeur", async () => {
      const workout = await Workout.create({ user: alice.userId, status: 'completed' });
      await ExerciseRecord.create({
        user: alice.userId,
        workout: workout._id,
        exerciceNom: 'Extension mollets debout',
        series: [{ poids: 150, repetitions: 3 }],
      });
      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).not.toContain('PR_HEAVY_100');
    });

    it('✅ WORKOUT_NIGHT_OWL pour une séance lancée entre minuit et 5h', async () => {
      // mongoose (timestamps: true) ignore tout `createdAt` fourni via
      // updateOne — il doit être fourni dès la création du document.
      const nightDate = new Date();
      nightDate.setUTCHours(2, 0, 0, 0);
      await Workout.create({ user: alice.userId, status: 'in_progress', createdAt: nightDate });

      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('WORKOUT_NIGHT_OWL');
    });

    it('✅ LOBBY_INSTIGATOR à 20 lobbies créés et terminés', async () => {
      const lobbies = Array.from({ length: 20 }, () => ({
        creatorId: alice.userId,
        members: [{ user: alice.userId, status: 'finished' }],
        memberCount: 1,
        status: 'completed',
      }));
      await WorkoutLobby.insertMany(lobbies);

      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('LOBBY_INSTIGATOR');
    });

    it("❌ LOBBY_INSTIGATOR non débloqué si l'utilisateur n'est pas créateur", async () => {
      const lobbies = Array.from({ length: 20 }, () => ({
        creatorId: bob.userId,
        members: [{ user: bob.userId, status: 'finished' }, { user: alice.userId, status: 'finished' }],
        memberCount: 2,
        status: 'completed',
      }));
      await WorkoutLobby.insertMany(lobbies);

      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).not.toContain('LOBBY_INSTIGATOR');
    });

    it('✅ GROUP_GUILD_MASTER : créateur, groupe à 5 membres depuis plus de 7 jours', async () => {
      const others = [];
      for (let i = 0; i < 4; i++) {
        others.push(await createAndLoginUser(`Guild${i}`, `guild${i}@athly.fr`));
      }
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await StreakGroup.create({
        members: [alice.userId, ...others.map((o) => o.userId)],
        createdAt: eightDaysAgo,
      });

      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('GROUP_GUILD_MASTER');
    });

    it("❌ GROUP_GUILD_MASTER non débloqué si l'utilisateur n'est pas le créateur (members[0])", async () => {
      const others = [];
      for (let i = 0; i < 4; i++) {
        others.push(await createAndLoginUser(`Guild2_${i}`, `guild2_${i}@athly.fr`));
      }
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await StreakGroup.create({
        members: [others[0].userId, alice.userId, ...others.slice(1).map((o) => o.userId)],
        createdAt: eightDaysAgo,
      });

      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).not.toContain('GROUP_GUILD_MASTER');
    });

    it('✅ SOCIAL_POKE_STRIKER : 3 cibles différentes secouées le même jour', async () => {
      const others = [];
      for (let i = 0; i < 3; i++) {
        others.push(await createAndLoginUser(`Poke${i}`, `poke${i}@athly.fr`));
      }
      await StreakGroup.create({
        members: [alice.userId, ...others.map((o) => o.userId)],
        shakes: others.map((o) => ({ from: alice.userId, to: o.userId, date: new Date() })),
      });

      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('SOCIAL_POKE_STRIKER');
    });

    it('✅ SHAME_REPENTANCE : séance validée dans les 2h suivant le Hall of Shame', async () => {
      const shamedAt = new Date(Date.now() - 60 * 60 * 1000); // il y a 1h
      await StreakGroup.create({
        members: [alice.userId, bob.userId],
        shameBreakers: [alice.userId],
        shameBreakersShamedAt: shamedAt,
      });
      await Workout.create({
        user: alice.userId,
        status: 'finished',
        completedAt: new Date(shamedAt.getTime() + 30 * 60 * 1000), // 30 min après
      });

      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).toContain('SHAME_REPENTANCE');
    });

    it('❌ SHAME_REPENTANCE non débloqué si la séance arrive après la fenêtre de 2h', async () => {
      const shamedAt = new Date(Date.now() - 5 * 60 * 60 * 1000); // il y a 5h
      await StreakGroup.create({
        members: [alice.userId, bob.userId],
        shameBreakers: [alice.userId],
        shameBreakersShamedAt: shamedAt,
      });
      await Workout.create({
        user: alice.userId,
        status: 'finished',
        completedAt: new Date(), // maintenant, largement après les 2h
      });

      const unlocked = await checkAndUnlockTitles(alice.userId);
      expect(unlocked).not.toContain('SHAME_REPENTANCE');
    });

    it("✅ SOLO_SHADOW_WORK : séance solo terminée pendant qu'un coéquipier a une séance active", async () => {
      await StreakGroup.create({ members: [alice.userId, bob.userId] });

      await Workout.create({ user: bob.userId, status: 'in_progress' });

      const aliceWorkout = await Workout.create({
        user: alice.userId,
        status: 'finished',
        completedAt: new Date(),
      });

      const unlocked = await checkAndUnlockTitles(alice.userId, { finishedWorkout: aliceWorkout });
      expect(unlocked).toContain('SOLO_SHADOW_WORK');
    });

    it('✅ Idempotent : un titre déjà débloqué ne redescend jamais et ne se re-notifie pas', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { level: 10 } });
      const first = await checkAndUnlockTitles(alice.userId);
      expect(first).toContain('PERFORM_LEVEL_10');

      const second = await checkAndUnlockTitles(alice.userId);
      expect(second).not.toContain('PERFORM_LEVEL_10');

      const user = await User.findById(alice.userId);
      expect(user.unlockedTitles.filter((t) => t === 'PERFORM_LEVEL_10').length).toBe(1);
    });

    it('✅ Débloque le trophée TITLE_FIRST au tout premier titre obtenu', async () => {
      await User.updateOne({ _id: alice.userId }, { $set: { level: 10 } });
      await checkAndUnlockTitles(alice.userId);

      const user = await User.findById(alice.userId);
      expect(user.achievements.some((a) => a.achievementId === 'TITLE_FIRST')).toBe(true);
      expect(user.achievements.some((a) => a.achievementId === 'TITLE_COLLECTOR_5')).toBe(false);
    });

    it('✅ Débloque le trophée TITLE_COLLECTOR_5 au 5e titre obtenu', async () => {
      await User.updateOne({ _id: alice.userId }, {
        $set: {
          unlockedTitles: ['REFERRAL_EARLY', 'LOOT_LEGENDARY', 'LOOT_BLOOD_UNIQUE', 'INVENTORY_HOARDER'],
          level: 10,
        },
      });
      await checkAndUnlockTitles(alice.userId);

      const user = await User.findById(alice.userId);
      expect(user.unlockedTitles.length).toBe(5);
      expect(user.achievements.some((a) => a.achievementId === 'TITLE_COLLECTOR_5')).toBe(true);
    });
  });
});
