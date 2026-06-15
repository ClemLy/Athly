// @ts-check
// Ces tests vérifient la non-régression des données définies dans ritualTypes.js.
// Ils tournent dans Node.js via Jest + babel-jest (transform ES → CJS).
// Aucune dépendance React Native n'est requise.

const { RITUAL_TYPES, getRitualById } = require('../ritualTypes');

// ─────────────────────────────────────────────────────────────────────────────
// Structure générale
// ─────────────────────────────────────────────────────────────────────────────
describe('RITUAL_TYPES — structure générale', () => {
  it('exporte un tableau de 5 rituels', () => {
    expect(Array.isArray(RITUAL_TYPES)).toBe(true);
    expect(RITUAL_TYPES).toHaveLength(5);
  });

  const REQUIRED_KEYS = ['id', 'name', 'subtitle', 'description', 'icon', 'color', 'durationSeconds', 'timerLabel', 'xpEarned'];

  test.each(RITUAL_TYPES)(
    '$name — possède toutes les propriétés obligatoires',
    (ritual) => {
      REQUIRED_KEYS.forEach((key) => {
        expect(ritual).toHaveProperty(key);
        expect(ritual[key]).not.toBeUndefined();
        expect(ritual[key]).not.toBeNull();
      });
    },
  );

  it('tous les IDs sont uniques', () => {
    const ids = RITUAL_TYPES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('toutes les durées sont des nombres positifs', () => {
    RITUAL_TYPES.forEach((r) => {
      expect(typeof r.durationSeconds).toBe('number');
      expect(r.durationSeconds).toBeGreaterThan(0);
    });
  });

  it('tous les xpEarned sont des nombres positifs', () => {
    RITUAL_TYPES.forEach((r) => {
      expect(typeof r.xpEarned).toBe('number');
      expect(r.xpEarned).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// XP par rituel — valeurs exactes (non-régression critique)
// ─────────────────────────────────────────────────────────────────────────────
describe('XP par rituel — valeurs exactes', () => {
  const XP_TABLE = [
    ['mobility',    20],
    ['breathing',   20],
    ['foam_rolling', 20],
    ['focus',       20],
    ['walking',    100], // exception : +100 XP (non-régression critique)
  ];

  test.each(XP_TABLE)(
    'rituel "%s" → xpEarned = %i',
    (id, expectedXP) => {
      const ritual = RITUAL_TYPES.find((r) => r.id === id);
      expect(ritual).toBeDefined();
      expect(ritual.xpEarned).toBe(expectedXP);
    },
  );

  it('la Marche Quotidienne est le seul rituel à 100 XP', () => {
    const xp100 = RITUAL_TYPES.filter((r) => r.xpEarned === 100);
    expect(xp100).toHaveLength(1);
    expect(xp100[0].id).toBe('walking');
  });

  it('les 4 autres rituels sont exactement à 20 XP', () => {
    const xp20 = RITUAL_TYPES.filter((r) => r.xpEarned === 20);
    expect(xp20).toHaveLength(4);
    const ids = xp20.map((r) => r.id).sort();
    expect(ids).toEqual(['breathing', 'foam_rolling', 'focus', 'mobility']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Durées — valeurs exactes
// ─────────────────────────────────────────────────────────────────────────────
describe('Durées — valeurs exactes', () => {
  it('Marche Quotidienne → 900 s (15 min)', () => {
    const walking = RITUAL_TYPES.find((r) => r.id === 'walking');
    expect(walking.durationSeconds).toBe(900);
  });

  const FIVE_MIN_RITUALS = ['mobility', 'breathing', 'foam_rolling', 'focus'];

  test.each(FIVE_MIN_RITUALS)(
    'rituel "%s" → 300 s (5 min)',
    (id) => {
      const ritual = RITUAL_TYPES.find((r) => r.id === id);
      expect(ritual.durationSeconds).toBe(300);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Présence des 5 IDs attendus
// ─────────────────────────────────────────────────────────────────────────────
describe('Présence des 5 rituels attendus', () => {
  const EXPECTED_IDS = ['mobility', 'walking', 'breathing', 'foam_rolling', 'focus'];

  test.each(EXPECTED_IDS)('le rituel "%s" est présent', (id) => {
    expect(RITUAL_TYPES.some((r) => r.id === id)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRitualById — helper
// ─────────────────────────────────────────────────────────────────────────────
describe('getRitualById()', () => {
  it('retourne le bon rituel pour un ID valide', () => {
    const ritual = getRitualById('walking');
    expect(ritual).not.toBeNull();
    expect(ritual.id).toBe('walking');
    expect(ritual.xpEarned).toBe(100);
  });

  it('retourne null pour un ID inconnu', () => {
    expect(getRitualById('nonexistent')).toBeNull();
    expect(getRitualById('')).toBeNull();
    expect(getRitualById(undefined)).toBeNull();
  });

  it('retourne bien des références à l\'intérieur de RITUAL_TYPES', () => {
    RITUAL_TYPES.forEach((r) => {
      expect(getRitualById(r.id)).toBe(r);
    });
  });
});
