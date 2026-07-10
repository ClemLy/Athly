// @ts-check
// Tests de non-régression des données du tutoriel interactif (tutorialChapters.js).
// Ils tournent dans Node.js via Jest + babel-jest (transform ES → CJS) — aucune
// dépendance React Native n'est requise.
//
// Objectif : garantir l'intégrité structurelle qui fait tourner la machine à états
// du TutorialContext (navigation de chapitre en chapitre, spotlights, bouton
// "Terminer" affiché au bon moment). Une régression ici casserait silencieusement
// le tour guidé sans erreur JS.

const {
  TUTORIAL_CHAPTERS,
  CHAPTER_MAP,
  CHAPTER_IDS,
} = require('../tutorialChapters');

const VALID_POSITIONS = ['top', 'bottom', 'center'];

// ─────────────────────────────────────────────────────────────────────────────
// Structure des chapitres
// ─────────────────────────────────────────────────────────────────────────────
describe('TUTORIAL_CHAPTERS — structure des chapitres', () => {
  it('exporte un tableau non vide de chapitres', () => {
    expect(Array.isArray(TUTORIAL_CHAPTERS)).toBe(true);
    expect(TUTORIAL_CHAPTERS.length).toBeGreaterThan(0);
  });

  it('contient exactement les 8 chapitres attendus, dans l\'ordre', () => {
    expect(CHAPTER_IDS).toEqual([
      'dashboard',
      'workout',
      'profile',
      'trophies',
      'inventory',
      'social',
      'stats',
      'settings',
    ]);
  });

  const REQUIRED_CHAPTER_KEYS = ['id', 'title', 'subtitle', 'icon', 'tabName', 'steps'];

  test.each(TUTORIAL_CHAPTERS)(
    'chapitre "$id" — possède toutes les propriétés obligatoires',
    (chapter) => {
      REQUIRED_CHAPTER_KEYS.forEach((key) => {
        expect(chapter).toHaveProperty(key);
        expect(chapter[key]).not.toBeUndefined();
        expect(chapter[key]).not.toBeNull();
      });
    },
  );

  it('tous les IDs de chapitre sont uniques', () => {
    const ids = TUTORIAL_CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque chapitre a au moins une étape', () => {
    TUTORIAL_CHAPTERS.forEach((chapter) => {
      expect(Array.isArray(chapter.steps)).toBe(true);
      expect(chapter.steps.length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Structure des étapes
// ─────────────────────────────────────────────────────────────────────────────
describe('TUTORIAL_CHAPTERS — structure des étapes', () => {
  const allSteps = TUTORIAL_CHAPTERS.flatMap((c) =>
    c.steps.map((s) => ({ chapterId: c.id, step: s })),
  );

  test.each(allSteps)(
    '$chapterId/$step.key — champs texte et position valides',
    ({ step }) => {
      expect(typeof step.key).toBe('string');
      expect(step.key.length).toBeGreaterThan(0);
      expect(typeof step.title).toBe('string');
      expect(step.title.length).toBeGreaterThan(0);
      expect(typeof step.body).toBe('string');
      expect(step.body.length).toBeGreaterThan(0);
      expect(VALID_POSITIONS).toContain(step.position);
      // targetKey est soit null (carte centrée), soit une chaîne non vide.
      if (step.targetKey !== null) {
        expect(typeof step.targetKey).toBe('string');
        expect(step.targetKey.length).toBeGreaterThan(0);
      }
    },
  );

  it('les clés d\'étape sont uniques au sein de chaque chapitre', () => {
    TUTORIAL_CHAPTERS.forEach((chapter) => {
      const keys = chapter.steps.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  it('toute étape avec un spotlight (targetKey) l\'associe à une position ancrée', () => {
    // Un spotlight n'a de sens qu'ancré en haut/bas de la cible (pas 'center').
    allSteps
      .filter(({ step }) => step.targetKey !== null)
      .forEach(({ chapterId, step }) => {
        expect(['top', 'bottom']).toContain(step.position);
        // message d'aide au debug si ça casse
        if (!['top', 'bottom'].includes(step.position)) {
          throw new Error(`${chapterId}/${step.key} a un targetKey mais position=${step.position}`);
        }
      });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cohérence du flag isLast (pilote l'affichage du bouton "Terminer")
// ─────────────────────────────────────────────────────────────────────────────
describe('TUTORIAL_CHAPTERS — flag isLast', () => {
  it('exactement une étape porte isLast: true dans tout le tutoriel', () => {
    const flagged = TUTORIAL_CHAPTERS.flatMap((c) =>
      c.steps.filter((s) => s.isLast === true),
    );
    expect(flagged).toHaveLength(1);
  });

  it('isLast est porté par la toute dernière étape du dernier chapitre', () => {
    const lastChapter = TUTORIAL_CHAPTERS[TUTORIAL_CHAPTERS.length - 1];
    const lastStep = lastChapter.steps[lastChapter.steps.length - 1];
    expect(lastStep.isLast).toBe(true);
  });

  it('aucune autre étape que la dernière ne porte isLast', () => {
    TUTORIAL_CHAPTERS.forEach((chapter, ci) => {
      chapter.steps.forEach((step, si) => {
        const isVeryLast =
          ci === TUTORIAL_CHAPTERS.length - 1 && si === chapter.steps.length - 1;
        if (!isVeryLast) {
          expect(step.isLast).not.toBe(true);
        }
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Maps dérivées (utilisées par TutorialContext pour la navigation d'état)
// ─────────────────────────────────────────────────────────────────────────────
describe('CHAPTER_MAP & CHAPTER_IDS — cohérence dérivée', () => {
  it('CHAPTER_IDS correspond à l\'ordre des chapitres', () => {
    expect(CHAPTER_IDS).toEqual(TUTORIAL_CHAPTERS.map((c) => c.id));
  });

  it('CHAPTER_MAP indexe chaque chapitre par son id', () => {
    TUTORIAL_CHAPTERS.forEach((chapter) => {
      expect(CHAPTER_MAP[chapter.id]).toBe(chapter);
    });
    expect(Object.keys(CHAPTER_MAP)).toHaveLength(TUTORIAL_CHAPTERS.length);
  });

  it('chaque chapitre avec stackScreen déclare aussi son tabName', () => {
    // La transition inter-chapitres navigue via navigation.navigate(tabName,
    // { screen: stackScreen }) — stackScreen sans tabName casserait la navigation.
    TUTORIAL_CHAPTERS.filter((c) => c.stackScreen).forEach((c) => {
      expect(typeof c.tabName).toBe('string');
      expect(c.tabName.length).toBeGreaterThan(0);
    });
  });
});
