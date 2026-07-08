'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Script de migration : attribue un discriminator ("#1234") à tous les
// comptes créés avant le système de tag Discord (Section III).
//
// Non-destructif et idempotent : ne touche qu'aux documents sans
// discriminator (les nouveaux comptes en reçoivent déjà un à l'inscription,
// et le profil en génère un lazily au premier GET /users/me — voir
// user.service.js). Ce script est un complément pour un backfill immédiat
// en masse plutôt que d'attendre que chaque utilisateur se reconnecte.
//
// Usage : node scripts/backfillDiscriminators.js
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { uniqueDiscriminator } = require('../services/auth.service');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find({ discriminator: { $exists: false } }).select('_id pseudo');
  console.log(`[backfillDiscriminators] ${users.length} compte(s) à migrer.`);

  let migrated = 0;
  for (const user of users) {
    user.discriminator = await uniqueDiscriminator(user.pseudo);
    await user.save();
    migrated += 1;
  }

  console.log(`[backfillDiscriminators] ${migrated} compte(s) migré(s) avec succès.`);
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error('[backfillDiscriminators] Échec :', err);
  process.exit(1);
});
