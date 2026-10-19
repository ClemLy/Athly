import { BUILTIN_CATALOG, filterCatalog, generateWorkout, trackingFor, bodyweightFactorFor, catalogEntryFor, isCalisthenics } from '../exerciseCatalog';
import { CALI_EXERCISES, CALI_FAMILIES, WARMUP_DRILLS, ROUTINES } from '../calisthenics';
import { drawFigure, GROUND } from '../../components/figure/figureEngine';
import { CALI_TEMPLATES, findTemplateForGroup } from '../workoutTemplates';
import { suggestRoutine } from '../warmups';
import { normalizeId } from '../../constants/exerciseFilters';

describe('bibliothèque de calisthénie', () => {
  it('chaque exercice a une famille connue, un niveau, une fourchette et une démo', () => {
    const families = new Set(CALI_FAMILIES.map((f) => f.id));
    for (const c of CALI_EXERCISES) {
      expect(families.has(c.family)).toBe(true);
      expect(['debutant', 'intermediaire', 'avance', 'elite']).toContain(c.level);
      expect(c.demo).toBeTruthy();
      expect(Array.isArray(c.cues) && c.cues.length).toBeGreaterThan(0);
    }
  });

  it('aucun doublon de nom', () => {
    const ids = CALI_EXERCISES.map((c) => normalizeId(c.name));
    expect(new Set(ids).size).toBe(ids.length);
    const all = BUILTIN_CATALOG.map((e) => e.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('chaque famille couvre au moins deux niveaux', () => {
    for (const f of CALI_FAMILIES) {
      const levels = new Set(CALI_EXERCISES.filter((c) => c.family === f.id).map((c) => c.level));
      expect(levels.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('les exercices existants sont enrichis (mêmes records), pas dupliqués', () => {
    const pompes = BUILTIN_CATALOG.filter((e) => normalizeId(e.name) === 'pompes');
    expect(pompes).toHaveLength(1);
    expect(pompes[0].disciplines).toEqual(['salle', 'calisthenie']);
    expect(pompes[0].family).toBe('pompes');
  });

  it('les tenues se comptent en secondes, même pour un exercice venu d’une séance type', () => {
    expect(trackingFor({ name: 'Gainage' })).toBe('time');
    expect(trackingFor({ name: 'Pompes' })).toBe('reps');
    expect(bodyweightFactorFor({ name: 'Tractions' })).toBe(1);
    expect(catalogEntryFor({ name: 'Front lever complet' }).level).toBe('elite');
  });

  it('chaque démo se dessine à tous les instants sans valeur invalide', () => {
    const specs = [...CALI_EXERCISES.map((c) => c.demo), ...Object.values(WARMUP_DRILLS).map((d) => d.demo)];
    for (const spec of specs) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const out = drawFigure(spec, t);
        expect(out).toBeTruthy();
        for (const sh of out.shapes) {
          for (const v of [sh.x1, sh.y1, sh.x2, sh.y2, sh.cx, sh.cy, sh.x, sh.y].filter((x) => x !== undefined)) {
            expect(Number.isFinite(v)).toBe(true);
          }
        }
      }
    }
  });

  it('chaque démo respecte le corps : membres de longueur fixe, rien dans le sol, pas de saut', () => {
    const specs = [...CALI_EXERCISES.map((c) => [c.name, c.demo]), ...Object.values(WARMUP_DRILLS).map((d) => [d.name, d.demo])];
    const BODY = new Set(['near', 'far', 'torso', 'torsoAccent', 'head', 'accent', 'accentFar']);
    const problems = [];
    for (const [name, spec] of specs) {
      let prev = null;
      for (let i = 0; i <= 40; i += 1) {
        const out = drawFigure(spec, i / 40);
        const loose = new Set(out.loose);
        for (const [a, b, len, label] of out.limbs) {
          const r = Math.hypot(a.x - b.x, a.y - b.y) / len;
          if (!loose.has(label) && (r > 1.05 || r < 0.9)) problems.push(`${name} : ${label} (${r.toFixed(2)})`);
        }
        const pts = [];
        for (const s of out.shapes) {
          if (s.k === 'line') pts.push(s.x1, s.y1, s.x2, s.y2);
          if (s.k === 'circle') pts.push(s.cx, s.cy);
          if (!BODY.has(s.c)) continue;
          if (s.k === 'line' && Math.max(s.y1, s.y2) + s.w / 2 > GROUND + 3) problems.push(`${name} : dans le sol`);
          if (s.k === 'circle' && s.cy + s.r > GROUND + 1.5) problems.push(`${name} : tête dans le sol`);
        }
        if (prev && prev.length === pts.length) {
          const jump = Math.max(...pts.map((v, k) => Math.abs(v - prev[k])));
          if (jump > 7) problems.push(`${name} : saut de ${jump.toFixed(1)}`);
        }
        prev = pts;
      }
    }
    expect([...new Set(problems)]).toEqual([]);
  });

  it('les routines ne citent que des mouvements existants', () => {
    for (const r of Object.values(ROUTINES)) {
      r.drills.forEach((id) => expect(WARMUP_DRILLS[id]).toBeTruthy());
    }
  });
});

describe('filtre et générateur en calisthénie', () => {
  it('le matériel disponible exclut ce qui manque', () => {
    const list = filterCatalog(BUILTIN_CATALOG, { discipline: 'calisthenie', available: [] });
    expect(list.length).toBeGreaterThan(20);
    expect(list.every((e) => isCalisthenics(e))).toBe(true);
    expect(list.some((e) => e.name === 'Tractions')).toBe(false);
    const withBar = filterCatalog(BUILTIN_CATALOG, { discipline: 'calisthenie', available: ['Barre de traction'] });
    expect(withBar.some((e) => e.name === 'Tractions')).toBe(true);
  });

  it('la salle ne propose pas les variantes de calisthénie pure', () => {
    const gym = filterCatalog(BUILTIN_CATALOG, { discipline: 'salle' });
    expect(gym.some((e) => e.name === 'Pompes au mur')).toBe(false);
    expect(gym.some((e) => e.name === 'Pompes')).toBe(true);
  });

  it('une séance générée n’a qu’une variante par famille', () => {
    for (let i = 0; i < 20; i += 1) {
      const w = generateWorkout({ discipline: 'calisthenie', available: ['Chaise', 'Table'], level: 'debutant', durationMin: 45 });
      const fams = w.exercises.map((e) => e.family).filter(Boolean);
      expect(new Set(fams).size).toBe(fams.length);
      expect(w.exercises.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('séances types et échauffements', () => {
  it('chaque séance type de calisthénie retrouve tous ses exercices au catalogue', () => {
    for (const t of CALI_TEMPLATES) {
      const built = t.buildExercises();
      expect(built).toHaveLength(t.exercises.length);
      built.forEach((e) => expect(isCalisthenics(e)).toBe(true));
    }
  });

  it("l'accueil recommande une séance de calisthénie à qui pratique la calisthénie", () => {
    expect(findTemplateForGroup('dos', 'calisthenie').discipline).toBe('calisthenie');
    expect(findTemplateForGroup('dos').discipline).toBeUndefined();
  });

  it("l'échauffement proposé suit le contenu de la séance", () => {
    const pull = CALI_TEMPLATES.find((t) => t.id === 'cali-pull').buildExercises();
    expect(suggestRoutine(pull).id).toBe('haut');
    const legs = CALI_TEMPLATES.find((t) => t.id === 'cali-legs').buildExercises();
    expect(['bas', 'complet']).toContain(suggestRoutine(legs).id);
    expect(suggestRoutine([{ name: 'Développé couché' }, { name: 'Squat' }]).id).toBe('salle');
  });
});
