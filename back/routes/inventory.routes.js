'use strict';

const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth.middleware');
const inventory = require('../controllers/inventory.controller');

// Toutes les routes d'inventaire exigent un JWT valide
router.use(auth);

// ── Coffres ───────────────────────────────────────────────────────────────────
router.post('/chest/open', inventory.openChest);

// ── Consommables ──────────────────────────────────────────────────────────────
router.post('/item/use', inventory.useItem);

module.exports = router;
