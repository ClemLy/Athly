'use strict';

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth.middleware');
const title   = require('../controllers/title.controller');

router.use(auth);

// ── Titres déblocables (Section X) ────────────────────────────────────────────
router.get('/titles',        title.getMyTitles);
router.post('/equip-title',  title.equipTitle);

module.exports = router;
