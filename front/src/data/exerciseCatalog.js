// Catalogue plat d'exercices "built-in" + utilitaires (filtrage hiérarchique, génération adaptive).
// Schéma exo :
//   id, name,
//   targetMuscleGroup ('pectoraux'|'dos'|'epaules'|'bras'|'jambes'|'abdos'),
//   targetMuscle (sous-muscle précis : 'Pectoraux haut', 'Grand dorsal'…),
//   secondaryMuscles (string[] de sous-muscles),
//   equipment (string[]),
//   level ('debutant'|'intermediaire'|'avance'),
//   isMachine (bool — guidé/poulie/machine),
//   isFreeWeight (bool — libre : barre / haltères / poids du corps),
//   videoUrl,
//   isCustom: false

import {
  normalizeId,
  MUSCLE_GROUPS,
  SUBMUSCLE_TO_GROUP,
} from '../constants/exerciseFilters';

const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

function defaultSets(n = 4) {
  const arr = [];
  for (let i = 0; i < n; i += 1) arr.push({});
  return arr;
}

// Groupes considérés comme "polyarticulaires par nature" : un exo qui sollicite
// au moins 2 muscles secondaires dans ces groupes est considéré compound.
// Override possible via opts.isCompound.
const COMPOUND_GROUPS = ['pectoraux', 'dos', 'jambes', 'epaules'];

// Helper compact pour déclarer un exo. Détecte automatiquement :
//   - isMachine / isFreeWeight (via équipement)
//   - isCompound (via groupe + nb de muscles secondaires)
// Tous overrideables via opts.
function exo(name, group, primarySub, secondarySubs, equipment, level, opts) {
  const eq = Array.isArray(equipment) ? equipment : [equipment].filter(Boolean);
  const eqIds = eq.map(normalizeId);
  const secondary = Array.isArray(secondarySubs) ? secondarySubs : [];
  const o = opts || {};
  const isMachine = o.isMachine !== undefined
    ? !!o.isMachine
    : eqIds.some((e) => e === 'machine' || e === 'cable');
  const isFreeWeight = o.isFreeWeight !== undefined
    ? !!o.isFreeWeight
    : eqIds.some((e) => e === 'barre' || e === 'halteres' || e === 'poids-du-corps');
  const isCompound = o.isCompound !== undefined
    ? !!o.isCompound
    : (secondary.length >= 2 && COMPOUND_GROUPS.includes(group));
  return {
    id: `bx-${normalizeId(name)}`,
    name,
    targetMuscleGroup: group,
    targetMuscle: primarySub,
    secondaryMuscles: secondary,
    equipment: eq,
    level: level || 'intermediaire',
    isMachine,
    isFreeWeight,
    isCompound,
    videoUrl: yt(o.videoQuery || name),
    isCustom: false,
  };
}

// ---------------------------------------------------------------------------
// CATALOGUE BUILT-IN — 146 exercices
// ---------------------------------------------------------------------------

export const BUILTIN_CATALOG = [
  // ─── PECTORAUX ───────────────────────────────────────────────────────── (20)
  exo('Développé couché', 'pectoraux', 'Pectoraux milieu', ['Triceps', 'Deltoïde antérieur'], ['Haltères'], 'intermediaire'),
  exo('Développé couché barre', 'pectoraux', 'Pectoraux milieu', ['Triceps', 'Deltoïde antérieur'], ['Barre'], 'intermediaire'),
  exo('Développé couché machine', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Machine'], 'debutant'),
  exo('Développé couché Smith', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Machine'], 'debutant', { videoQuery: 'développé couché Smith machine' }),
  exo('Développé incliné', 'pectoraux', 'Pectoraux haut', ['Triceps', 'Deltoïde antérieur'], ['Haltères'], 'intermediaire'),
  exo('Développé incliné barre', 'pectoraux', 'Pectoraux haut', ['Triceps'], ['Barre'], 'intermediaire'),
  exo('Développé incliné machine', 'pectoraux', 'Pectoraux haut', ['Triceps'], ['Machine'], 'debutant'),
  exo('Développé décliné', 'pectoraux', 'Pectoraux bas', ['Triceps'], ['Haltères'], 'intermediaire'),
  exo('Développé décliné barre', 'pectoraux', 'Pectoraux bas', ['Triceps'], ['Barre'], 'intermediaire'),
  exo('Écarté haltères', 'pectoraux', 'Pectoraux milieu', ['Deltoïde antérieur'], ['Haltères'], 'debutant'),
  exo('Écarté incliné', 'pectoraux', 'Pectoraux haut', ['Deltoïde antérieur'], ['Haltères'], 'debutant'),
  exo('Écarté décliné', 'pectoraux', 'Pectoraux bas', ['Deltoïde antérieur'], ['Haltères'], 'intermediaire'),
  exo('Écarté à la poulie', 'pectoraux', 'Pectoraux milieu', ['Deltoïde antérieur'], ['Câble'], 'debutant'),
  exo('Cable crossover haut', 'pectoraux', 'Pectoraux bas', ['Deltoïde antérieur'], ['Câble'], 'intermediaire', { videoQuery: 'cable crossover poulie haute' }),
  exo('Cable crossover bas', 'pectoraux', 'Pectoraux haut', ['Deltoïde antérieur'], ['Câble'], 'intermediaire', { videoQuery: 'cable crossover poulie basse' }),
  exo('Pec deck', 'pectoraux', 'Pectoraux milieu', ['Deltoïde antérieur'], ['Machine'], 'debutant'),
  exo('Pompes', 'pectoraux', 'Pectoraux milieu', ['Triceps', 'Deltoïde antérieur'], ['Poids du corps'], 'debutant'),
  exo('Pompes lestées', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Poids du corps'], 'avance'),
  exo('Pompes inclinées', 'pectoraux', 'Pectoraux bas', ['Triceps'], ['Poids du corps'], 'debutant'),
  exo('Pompes déclinées', 'pectoraux', 'Pectoraux haut', ['Triceps'], ['Poids du corps'], 'intermediaire'),

  // ─── DOS ─────────────────────────────────────────────────────────────── (26)
  exo('Tractions', 'dos', 'Grand dorsal', ['Biceps'], ['Poids du corps'], 'intermediaire'),
  exo('Tractions prise large', 'dos', 'Grand dorsal', ['Biceps', 'Trapèzes'], ['Poids du corps'], 'avance'),
  exo('Tractions prise serrée', 'dos', 'Grand dorsal', ['Biceps'], ['Poids du corps'], 'intermediaire'),
  exo('Tractions lestées', 'dos', 'Grand dorsal', ['Biceps'], ['Poids du corps'], 'avance'),
  exo('Tractions australiennes', 'dos', 'Rhomboïdes', ['Biceps', 'Trapèzes'], ['Poids du corps'], 'debutant'),
  exo('Rowing barre', 'dos', 'Grand dorsal', ['Biceps', 'Rhomboïdes', 'Trapèzes'], ['Barre'], 'intermediaire'),
  exo('Rowing barre prise inversée', 'dos', 'Grand dorsal', ['Biceps'], ['Barre'], 'intermediaire'),
  exo('Rowing T-bar', 'dos', 'Grand dorsal', ['Biceps', 'Trapèzes'], ['Barre'], 'intermediaire'),
  exo('Rowing haltère', 'dos', 'Grand dorsal', ['Biceps', 'Trapèzes'], ['Haltères'], 'intermediaire'),
  exo('Rowing haltères assis', 'dos', 'Rhomboïdes', ['Biceps'], ['Haltères'], 'debutant'),
  exo('Rowing machine', 'dos', 'Grand dorsal', ['Biceps'], ['Machine'], 'debutant'),
  exo('Tirage poitrine', 'dos', 'Grand dorsal', ['Biceps'], ['Câble'], 'debutant'),
  exo('Tirage poitrine prise large', 'dos', 'Grand dorsal', ['Biceps'], ['Câble'], 'debutant'),
  exo('Tirage poitrine prise inversée', 'dos', 'Grand dorsal', ['Biceps'], ['Câble'], 'debutant'),
  exo('Tirage horizontal', 'dos', 'Rhomboïdes', ['Biceps', 'Trapèzes'], ['Câble'], 'debutant'),
  exo('Tirage haut machine', 'dos', 'Grand dorsal', ['Biceps'], ['Machine'], 'debutant'),
  exo('Pull-over à la poulie', 'dos', 'Grand dorsal', ['Triceps'], ['Câble'], 'intermediaire'),
  exo('Pull-over haltère', 'dos', 'Grand dorsal', ['Pectoraux milieu'], ['Haltères'], 'intermediaire'),
  exo('Soulevé de terre', 'dos', 'Lombaires', ['Grand dorsal', 'Trapèzes', 'Fessiers', 'Ischios'], ['Barre'], 'avance'),
  exo('Soulevé de terre sumo', 'dos', 'Lombaires', ['Fessiers', 'Ischios', 'Adducteurs'], ['Barre'], 'avance'),
  exo('Hyperextensions', 'dos', 'Lombaires', ['Fessiers'], ['Poids du corps'], 'debutant'),
  exo('Good morning', 'dos', 'Lombaires', ['Ischios', 'Fessiers'], ['Barre'], 'intermediaire'),
  exo('Shrug barre', 'dos', 'Trapèzes', ['Avant-bras'], ['Barre'], 'debutant'),
  exo('Shrug haltères', 'dos', 'Trapèzes', ['Avant-bras'], ['Haltères'], 'debutant'),
  exo('Upright row', 'dos', 'Trapèzes', ['Deltoïde latéral'], ['Barre'], 'intermediaire', { videoQuery: 'rowing menton barre' }),
  exo('Y-raise', 'dos', 'Trapèzes', ['Deltoïde postérieur'], ['Haltères'], 'debutant', { videoQuery: 'y raise haltères' }),

  // ─── ÉPAULES ─────────────────────────────────────────────────────────── (18)
  exo('Développé militaire', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Barre'], 'intermediaire'),
  exo('Développé militaire haltères', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Haltères'], 'debutant'),
  exo('Développé Arnold', 'epaules', 'Deltoïde antérieur', ['Deltoïde latéral', 'Triceps'], ['Haltères'], 'intermediaire'),
  exo('Développé épaules machine', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Machine'], 'debutant'),
  exo('Élévations frontales', 'epaules', 'Deltoïde antérieur', [], ['Haltères'], 'debutant'),
  exo('Élévations frontales barre', 'epaules', 'Deltoïde antérieur', [], ['Barre'], 'debutant'),
  exo('Élévations frontales poulie', 'epaules', 'Deltoïde antérieur', [], ['Câble'], 'debutant'),
  exo('Élévations latérales', 'epaules', 'Deltoïde latéral', ['Trapèzes'], ['Haltères'], 'debutant'),
  exo('Élévations latérales poulie', 'epaules', 'Deltoïde latéral', ['Trapèzes'], ['Câble'], 'debutant'),
  exo('Élévations latérales machine', 'epaules', 'Deltoïde latéral', [], ['Machine'], 'debutant'),
  exo('Élévations latérales unilatérales poulie', 'epaules', 'Deltoïde latéral', [], ['Câble'], 'intermediaire'),
  exo('Oiseau haltères', 'epaules', 'Deltoïde postérieur', ['Trapèzes', 'Rhomboïdes'], ['Haltères'], 'intermediaire', { videoQuery: 'oiseau haltères deltoïde postérieur' }),
  exo('Oiseau buste penché', 'epaules', 'Deltoïde postérieur', ['Trapèzes'], ['Haltères'], 'intermediaire'),
  exo('Oiseau machine', 'epaules', 'Deltoïde postérieur', ['Trapèzes'], ['Machine'], 'debutant'),
  exo('Reverse pec deck', 'epaules', 'Deltoïde postérieur', ['Trapèzes'], ['Machine'], 'debutant'),
  exo('Face pull', 'epaules', 'Deltoïde postérieur', ['Trapèzes', 'Rhomboïdes'], ['Câble'], 'debutant'),
  exo('Rowing menton', 'epaules', 'Deltoïde latéral', ['Trapèzes'], ['Barre'], 'intermediaire'),
  exo('Cuban press', 'epaules', 'Deltoïde latéral', ['Trapèzes', 'Triceps'], ['Haltères'], 'avance'),

  // ─── BRAS ────────────────────────────────────────────────────────────── (30)
  // Biceps
  exo('Curl haltères', 'bras', 'Biceps', ['Avant-bras'], ['Haltères'], 'debutant'),
  exo('Curl marteau', 'bras', 'Biceps', ['Avant-bras'], ['Haltères'], 'debutant'),
  exo('Curl barre', 'bras', 'Biceps', ['Avant-bras'], ['Barre'], 'intermediaire'),
  exo('Curl barre EZ', 'bras', 'Biceps', ['Avant-bras'], ['Barre'], 'intermediaire'),
  exo('Curl à la poulie', 'bras', 'Biceps', [], ['Câble'], 'debutant'),
  exo('Curl à la poulie corde', 'bras', 'Biceps', ['Avant-bras'], ['Câble'], 'debutant'),
  exo('Curl Larry Scott', 'bras', 'Biceps', [], ['Haltères'], 'intermediaire'),
  exo('Curl pupitre', 'bras', 'Biceps', [], ['Barre'], 'intermediaire'),
  exo('Curl 21s', 'bras', 'Biceps', [], ['Haltères'], 'avance'),
  exo('Curl concentration', 'bras', 'Biceps', [], ['Haltères'], 'debutant'),
  exo('Curl incliné haltères', 'bras', 'Biceps', [], ['Haltères'], 'intermediaire'),
  exo('Spider curl', 'bras', 'Biceps', [], ['Haltères'], 'intermediaire'),
  exo('Curl Zottman', 'bras', 'Biceps', ['Avant-bras'], ['Haltères'], 'intermediaire'),
  // Triceps
  exo('Extension triceps haltère', 'bras', 'Triceps', [], ['Haltères'], 'debutant'),
  exo('Skull crusher', 'bras', 'Triceps', [], ['Barre'], 'intermediaire'),
  exo('Skull crusher EZ', 'bras', 'Triceps', [], ['Barre'], 'intermediaire'),
  exo('Triceps poulie haute', 'bras', 'Triceps', [], ['Câble'], 'debutant'),
  exo('Triceps poulie corde', 'bras', 'Triceps', [], ['Câble'], 'debutant'),
  exo('Triceps poulie inversé', 'bras', 'Triceps', [], ['Câble'], 'debutant'),
  exo('Dips', 'bras', 'Triceps', ['Pectoraux bas', 'Deltoïde antérieur'], ['Poids du corps'], 'intermediaire'),
  exo('Dips bench', 'bras', 'Triceps', ['Deltoïde antérieur'], ['Poids du corps'], 'debutant'),
  exo('Pompes diamant', 'bras', 'Triceps', ['Pectoraux milieu'], ['Poids du corps'], 'intermediaire'),
  exo('Kickback haltère', 'bras', 'Triceps', [], ['Haltères'], 'debutant'),
  exo('Extension overhead haltère', 'bras', 'Triceps', [], ['Haltères'], 'intermediaire'),
  exo('Extension overhead poulie', 'bras', 'Triceps', [], ['Câble'], 'debutant'),
  exo('JM press', 'bras', 'Triceps', ['Pectoraux milieu'], ['Barre'], 'avance'),
  // Avant-bras
  exo('Curl poignets', 'bras', 'Avant-bras', [], ['Barre'], 'debutant'),
  exo('Reverse curl barre', 'bras', 'Avant-bras', ['Biceps'], ['Barre'], 'intermediaire'),
  exo('Extension poignets', 'bras', 'Avant-bras', [], ['Barre'], 'debutant'),
  exo("Farmer's walk", 'bras', 'Avant-bras', ['Trapèzes'], ['Haltères'], 'intermediaire'),

  // ─── JAMBES ──────────────────────────────────────────────────────────── (35)
  // Quadriceps
  exo('Squat', 'jambes', 'Quadriceps', ['Fessiers', 'Ischios'], ['Barre'], 'intermediaire'),
  exo('Squat haltères', 'jambes', 'Quadriceps', ['Fessiers'], ['Haltères'], 'debutant'),
  exo('Front squat', 'jambes', 'Quadriceps', ['Fessiers'], ['Barre'], 'avance'),
  exo('Hack squat', 'jambes', 'Quadriceps', ['Fessiers'], ['Machine'], 'intermediaire'),
  exo('Squat bulgare', 'jambes', 'Quadriceps', ['Fessiers', 'Ischios'], ['Haltères'], 'intermediaire'),
  exo('Squat goblet', 'jambes', 'Quadriceps', ['Fessiers'], ['Haltères'], 'debutant'),
  exo('Sissy squat', 'jambes', 'Quadriceps', [], ['Poids du corps'], 'avance'),
  exo('Step-up', 'jambes', 'Quadriceps', ['Fessiers'], ['Haltères'], 'debutant'),
  exo('Wall sit', 'jambes', 'Quadriceps', [], ['Poids du corps'], 'debutant'),
  exo('Leg extension', 'jambes', 'Quadriceps', [], ['Machine'], 'debutant'),
  exo('Presse à cuisses', 'jambes', 'Quadriceps', ['Fessiers'], ['Machine'], 'debutant'),
  exo('Presse à cuisses inclinée', 'jambes', 'Quadriceps', ['Fessiers'], ['Machine'], 'debutant'),
  exo('Fentes marchées', 'jambes', 'Quadriceps', ['Fessiers', 'Ischios'], ['Haltères'], 'intermediaire'),
  exo('Fentes inversées', 'jambes', 'Quadriceps', ['Fessiers'], ['Haltères'], 'debutant'),
  exo('Fentes statiques', 'jambes', 'Quadriceps', ['Fessiers'], ['Haltères'], 'debutant'),
  // Ischios
  exo('Soulevé de terre roumain', 'jambes', 'Ischios', ['Fessiers', 'Lombaires'], ['Barre'], 'intermediaire'),
  exo('Soulevé de terre roumain haltères', 'jambes', 'Ischios', ['Fessiers'], ['Haltères'], 'intermediaire'),
  exo('Soulevé de terre jambes tendues', 'jambes', 'Ischios', ['Lombaires', 'Fessiers'], ['Barre'], 'avance'),
  exo('Leg curl couché', 'jambes', 'Ischios', [], ['Machine'], 'debutant'),
  exo('Leg curl assis', 'jambes', 'Ischios', [], ['Machine'], 'debutant'),
  exo('Leg curl debout', 'jambes', 'Ischios', [], ['Machine'], 'debutant'),
  exo('Nordic curl', 'jambes', 'Ischios', [], ['Poids du corps'], 'avance'),
  // Fessiers
  exo('Hip thrust', 'jambes', 'Fessiers', ['Ischios'], ['Barre'], 'intermediaire'),
  exo('Glute bridge', 'jambes', 'Fessiers', ['Ischios'], ['Poids du corps'], 'debutant'),
  exo('Cable kickback', 'jambes', 'Fessiers', [], ['Câble'], 'debutant'),
  exo('Hip abduction machine', 'jambes', 'Fessiers', [], ['Machine'], 'debutant'),
  exo('Hip abduction câble', 'jambes', 'Fessiers', [], ['Câble'], 'debutant'),
  // Adducteurs
  exo('Adduction machine', 'jambes', 'Adducteurs', [], ['Machine'], 'debutant'),
  exo('Adduction câble', 'jambes', 'Adducteurs', [], ['Câble'], 'debutant'),
  exo('Squat sumo haltère', 'jambes', 'Adducteurs', ['Quadriceps', 'Fessiers'], ['Haltères'], 'debutant'),
  // Mollets
  exo('Mollets debout machine', 'jambes', 'Mollets', [], ['Machine'], 'debutant'),
  exo('Mollets assis machine', 'jambes', 'Mollets', [], ['Machine'], 'debutant'),
  exo('Mollets unilatéral haltère', 'jambes', 'Mollets', [], ['Haltères'], 'debutant'),
  exo('Donkey calf raise', 'jambes', 'Mollets', [], ['Machine'], 'intermediaire'),
  exo('Mollets debout barre', 'jambes', 'Mollets', [], ['Barre'], 'debutant'),

  // ─── ABDOS ───────────────────────────────────────────────────────────── (18)
  exo('Crunch', 'abdos', 'Grand droit', [], ['Poids du corps'], 'debutant'),
  exo('Crunch poulie', 'abdos', 'Grand droit', [], ['Câble'], 'intermediaire'),
  exo('Crunch machine', 'abdos', 'Grand droit', [], ['Machine'], 'debutant'),
  exo('Sit-up', 'abdos', 'Grand droit', [], ['Poids du corps'], 'debutant'),
  exo('Relevé de jambes', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'intermediaire'),
  exo('Relevé de jambes suspendu', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'avance'),
  exo('Toes to bar', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'avance'),
  exo('V-up', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'intermediaire'),
  exo('Hollow hold', 'abdos', 'Transverse', ['Grand droit'], ['Poids du corps'], 'intermediaire'),
  exo('Roue abdominale', 'abdos', 'Transverse', ['Grand droit'], ['Poids du corps'], 'avance'),
  exo('Vacuum', 'abdos', 'Transverse', [], ['Poids du corps'], 'debutant'),
  exo('Russian twist', 'abdos', 'Obliques', ['Grand droit'], ['Poids du corps'], 'intermediaire'),
  exo('Wood chopper poulie', 'abdos', 'Obliques', ['Grand droit'], ['Câble'], 'intermediaire'),
  exo('Side crunch', 'abdos', 'Obliques', [], ['Poids du corps'], 'debutant'),
  exo('Side plank', 'abdos', 'Obliques', ['Transverse'], ['Poids du corps'], 'debutant'),
  exo('Pallof press', 'abdos', 'Obliques', ['Transverse'], ['Câble'], 'intermediaire'),
  exo('Gainage', 'abdos', 'Transverse', ['Grand droit'], ['Poids du corps'], 'debutant'),
  exo('Plank up-down', 'abdos', 'Transverse', ['Grand droit'], ['Poids du corps'], 'intermediaire'),

  // ═════════════════════════════════════════════════════════════════════════
  // EXTENSION : +100 variantes (prises, angles, équipement)
  // ═════════════════════════════════════════════════════════════════════════

  // ─── PECTORAUX EXTRA ─────────────────────────────────────────────────── (15)
  exo('Développé incliné prise serrée barre', 'pectoraux', 'Pectoraux haut', ['Triceps'], ['Barre'], 'intermediaire'),
  exo('Développé décliné machine', 'pectoraux', 'Pectoraux bas', ['Triceps'], ['Machine'], 'debutant'),
  exo('Développé serré barre', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Barre'], 'intermediaire', { videoQuery: 'développé couché prise serrée' }),
  exo('Développé bottoms-up haltères', 'pectoraux', 'Pectoraux milieu', ['Deltoïde antérieur'], ['Haltères'], 'avance'),
  exo('Pompes prise large', 'pectoraux', 'Pectoraux milieu', ['Deltoïde antérieur'], ['Poids du corps'], 'debutant'),
  exo('Pompes archer', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Poids du corps'], 'avance'),
  exo('Pompes pseudo planche', 'pectoraux', 'Pectoraux haut', ['Deltoïde antérieur', 'Triceps'], ['Poids du corps'], 'avance'),
  exo('Écarté Larry Scott', 'pectoraux', 'Pectoraux haut', ['Deltoïde antérieur'], ['Haltères'], 'intermediaire'),
  exo('Écarté machine', 'pectoraux', 'Pectoraux milieu', [], ['Machine'], 'debutant'),
  exo('Pec deck unilatéral', 'pectoraux', 'Pectoraux milieu', [], ['Machine'], 'intermediaire'),
  exo('Cable crossover unilatéral', 'pectoraux', 'Pectoraux milieu', ['Deltoïde antérieur'], ['Câble'], 'intermediaire'),
  exo('Pull-over machine', 'pectoraux', 'Pectoraux milieu', ['Grand dorsal'], ['Machine'], 'debutant'),
  exo('Squeeze press haltères', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Haltères'], 'intermediaire'),
  exo('Floor press haltères', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Haltères'], 'intermediaire'),
  exo('Spoto press', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Barre'], 'avance'),

  // ─── DOS EXTRA ────────────────────────────────────────────────────────── (15)
  exo('Tractions prise neutre', 'dos', 'Grand dorsal', ['Biceps'], ['Poids du corps'], 'intermediaire'),
  exo('Tractions L-sit', 'dos', 'Grand dorsal', ['Grand droit', 'Biceps'], ['Poids du corps'], 'avance'),
  exo('Tractions à la serviette', 'dos', 'Grand dorsal', ['Biceps', 'Avant-bras'], ['Poids du corps'], 'avance'),
  exo('Chin-ups', 'dos', 'Grand dorsal', ['Biceps'], ['Poids du corps'], 'intermediaire'),
  exo('Rowing Pendlay', 'dos', 'Grand dorsal', ['Trapèzes', 'Rhomboïdes'], ['Barre'], 'avance'),
  exo('Rowing Yates', 'dos', 'Grand dorsal', ['Biceps'], ['Barre'], 'intermediaire'),
  exo('Rowing Meadows', 'dos', 'Grand dorsal', ['Biceps'], ['Barre'], 'intermediaire'),
  exo('Rowing Kroc', 'dos', 'Grand dorsal', ['Biceps', 'Avant-bras'], ['Haltères'], 'avance'),
  exo('Rowing seal', 'dos', 'Rhomboïdes', ['Trapèzes'], ['Barre'], 'intermediaire'),
  exo('Renegade row', 'dos', 'Grand dorsal', ['Transverse'], ['Haltères'], 'intermediaire'),
  exo('Inverted row barres', 'dos', 'Rhomboïdes', ['Biceps'], ['Poids du corps'], 'debutant'),
  exo('Tirage poulie unilatéral', 'dos', 'Grand dorsal', ['Biceps'], ['Câble'], 'intermediaire'),
  exo('Tirage corde haute', 'dos', 'Grand dorsal', ['Trapèzes'], ['Câble'], 'intermediaire'),
  exo('Reverse hyper', 'dos', 'Lombaires', ['Fessiers'], ['Machine'], 'intermediaire'),
  exo('Jefferson curl', 'dos', 'Lombaires', [], ['Barre'], 'avance'),

  // ─── ÉPAULES EXTRA ────────────────────────────────────────────────────── (18)
  exo('Z-press', 'epaules', 'Deltoïde antérieur', ['Triceps', 'Transverse'], ['Haltères'], 'avance'),
  exo('Landmine press', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Barre'], 'intermediaire'),
  exo('Bottoms-up press', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Haltères'], 'avance'),
  exo('Développé pince serrée haltères', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Haltères'], 'intermediaire'),
  exo('Élévations latérales lying', 'epaules', 'Deltoïde latéral', [], ['Haltères'], 'intermediaire'),
  exo('Élévations latérales pause', 'epaules', 'Deltoïde latéral', [], ['Haltères'], 'avance'),
  exo('Cable lateral en T', 'epaules', 'Deltoïde latéral', [], ['Câble'], 'intermediaire'),
  exo('Élévations latérales poulie basse', 'epaules', 'Deltoïde latéral', [], ['Câble'], 'intermediaire'),
  exo('Bradford press', 'epaules', 'Deltoïde antérieur', ['Triceps', 'Trapèzes'], ['Barre'], 'avance'),
  exo('Behind the neck press', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Barre'], 'avance'),
  exo('High pull haltères', 'epaules', 'Deltoïde latéral', ['Trapèzes'], ['Haltères'], 'intermediaire'),
  exo('Egyptian lateral raise', 'epaules', 'Deltoïde latéral', [], ['Câble'], 'intermediaire'),
  exo('Élévations latérales unilatérales machine', 'epaules', 'Deltoïde latéral', [], ['Machine'], 'debutant'),
  exo('Reverse fly câble', 'epaules', 'Deltoïde postérieur', ['Trapèzes'], ['Câble'], 'debutant'),
  exo('Reverse fly machine assise', 'epaules', 'Deltoïde postérieur', [], ['Machine'], 'debutant'),
  exo('Cuban rotation', 'epaules', 'Deltoïde postérieur', ['Trapèzes'], ['Haltères'], 'intermediaire'),
  exo('Rotation externe câble', 'epaules', 'Deltoïde postérieur', [], ['Câble'], 'debutant'),
  exo('Rotation externe haltère', 'epaules', 'Deltoïde postérieur', [], ['Haltères'], 'debutant'),

  // ─── BRAS EXTRA ───────────────────────────────────────────────────────── (15)
  exo('Curl prise large barre', 'bras', 'Biceps', [], ['Barre'], 'intermediaire'),
  exo('Curl prise serrée barre', 'bras', 'Biceps', ['Avant-bras'], ['Barre'], 'intermediaire'),
  exo('Curl barre poulie basse', 'bras', 'Biceps', [], ['Câble'], 'debutant'),
  exo('Hammer curl poulie corde', 'bras', 'Biceps', ['Avant-bras'], ['Câble'], 'debutant'),
  exo('Drag curl', 'bras', 'Biceps', [], ['Barre'], 'intermediaire'),
  exo('Curl haltères assis', 'bras', 'Biceps', [], ['Haltères'], 'debutant'),
  exo('Curl debout strict', 'bras', 'Biceps', [], ['Barre'], 'avance'),
  exo('Tate press', 'bras', 'Triceps', [], ['Haltères'], 'intermediaire'),
  exo('California press', 'bras', 'Triceps', ['Pectoraux milieu'], ['Barre'], 'avance'),
  exo('Triceps poulie unilatéral', 'bras', 'Triceps', [], ['Câble'], 'intermediaire'),
  exo('Triceps prise large', 'bras', 'Triceps', [], ['Câble'], 'debutant'),
  exo('Skull crusher haltères', 'bras', 'Triceps', [], ['Haltères'], 'intermediaire'),
  exo('Wrist curl haltères', 'bras', 'Avant-bras', [], ['Haltères'], 'debutant'),
  exo('Plate pinch', 'bras', 'Avant-bras', [], ['Poids du corps'], 'intermediaire'),
  exo('Captains of crush', 'bras', 'Avant-bras', [], ['Poids du corps'], 'debutant'),

  // ─── JAMBES EXTRA ─────────────────────────────────────────────────────── (20)
  exo('Squat box', 'jambes', 'Quadriceps', ['Fessiers'], ['Barre'], 'intermediaire'),
  exo('Squat pause', 'jambes', 'Quadriceps', ['Fessiers'], ['Barre'], 'avance'),
  exo('Squat zercher', 'jambes', 'Quadriceps', ['Fessiers', 'Lombaires'], ['Barre'], 'avance'),
  exo('Squat front rack haltères', 'jambes', 'Quadriceps', ['Fessiers'], ['Haltères'], 'intermediaire'),
  exo('Pistol squat', 'jambes', 'Quadriceps', ['Fessiers', 'Ischios'], ['Poids du corps'], 'avance'),
  exo('Cossack squat', 'jambes', 'Adducteurs', ['Quadriceps', 'Fessiers'], ['Poids du corps'], 'intermediaire'),
  exo('Belt squat', 'jambes', 'Quadriceps', ['Fessiers'], ['Machine'], 'debutant'),
  exo('Glute ham raise', 'jambes', 'Ischios', ['Fessiers'], ['Machine'], 'avance'),
  exo('Cable pull through', 'jambes', 'Fessiers', ['Ischios'], ['Câble'], 'debutant'),
  exo('Stiff leg sumo deadlift', 'jambes', 'Ischios', ['Fessiers', 'Adducteurs'], ['Barre'], 'avance'),
  exo('Lunge déficit haltères', 'jambes', 'Quadriceps', ['Fessiers'], ['Haltères'], 'avance'),
  exo('Bulgarian split squat barre', 'jambes', 'Quadriceps', ['Fessiers'], ['Barre'], 'intermediaire'),
  exo('Single leg press', 'jambes', 'Quadriceps', ['Fessiers'], ['Machine'], 'debutant'),
  exo('Single leg extension', 'jambes', 'Quadriceps', [], ['Machine'], 'debutant'),
  exo('Hack squat reverse', 'jambes', 'Fessiers', ['Ischios'], ['Machine'], 'intermediaire'),
  exo('Single leg calf raise', 'jambes', 'Mollets', [], ['Poids du corps'], 'debutant'),
  exo('Calf raise déficit', 'jambes', 'Mollets', [], ['Haltères'], 'intermediaire'),
  exo('Lateral lunge', 'jambes', 'Adducteurs', ['Quadriceps', 'Fessiers'], ['Haltères'], 'debutant'),
  exo('Frog pump', 'jambes', 'Fessiers', ['Adducteurs'], ['Poids du corps'], 'debutant'),
  exo('Single leg hip thrust', 'jambes', 'Fessiers', ['Ischios'], ['Poids du corps'], 'intermediaire'),

  // ─── ABDOS EXTRA ──────────────────────────────────────────────────────── (12)
  exo('Cable crunch genoux', 'abdos', 'Grand droit', [], ['Câble'], 'intermediaire'),
  exo('Reverse crunch', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'debutant'),
  exo('Bicycle crunch', 'abdos', 'Obliques', ['Grand droit'], ['Poids du corps'], 'debutant'),
  exo('Mountain climbers', 'abdos', 'Transverse', ['Grand droit'], ['Poids du corps'], 'debutant'),
  exo('Dead bug', 'abdos', 'Transverse', ['Grand droit'], ['Poids du corps'], 'debutant'),
  exo('Bird dog', 'abdos', 'Transverse', ['Lombaires'], ['Poids du corps'], 'debutant'),
  exo('Flutter kicks', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'debutant'),
  exo('Hanging leg raises strict', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'avance'),
  exo('Dragon flag', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'avance'),
  exo('Tuck-up', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'intermediaire'),
  exo('Standing oblique crunch poulie', 'abdos', 'Obliques', [], ['Câble'], 'debutant'),
  exo('Around the world plank', 'abdos', 'Transverse', ['Obliques'], ['Poids du corps'], 'intermediaire'),

  // ─── Variantes complémentaires ────────────────────────────────────────── (+12)
  exo('Pec deck inversé', 'epaules', 'Deltoïde postérieur', ['Trapèzes'], ['Machine'], 'debutant'),
  exo('Développé poitrine machine convergente', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Machine'], 'debutant'),
  exo('Pull-down poignée corde', 'dos', 'Grand dorsal', ['Biceps'], ['Câble'], 'debutant'),
  exo('Tractions assistées machine', 'dos', 'Grand dorsal', ['Biceps'], ['Machine'], 'debutant'),
  exo('Curl haltères incliné concentration', 'bras', 'Biceps', [], ['Haltères'], 'intermediaire'),
  exo('Triceps poulie poignée V', 'bras', 'Triceps', [], ['Câble'], 'debutant'),
  exo('Squat haltères entre les jambes', 'jambes', 'Quadriceps', ['Fessiers'], ['Haltères'], 'debutant'),
  exo('Hip thrust machine', 'jambes', 'Fessiers', ['Ischios'], ['Machine'], 'debutant'),
  exo('Mollets presse à cuisses', 'jambes', 'Mollets', [], ['Machine'], 'debutant'),
  exo('Crunch banc incliné', 'abdos', 'Grand droit', [], ['Poids du corps'], 'intermediaire'),
  exo('Élévations latérales banc incliné', 'epaules', 'Deltoïde latéral', [], ['Haltères'], 'avance'),
  exo('Poussée verticale Smith', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Machine'], 'debutant'),

  // ═════════════════════════════════════════════════════════════════════════
  // PACK 2 : +100 variantes additionnelles (Smith, plyo, unilatéraux, tempos)
  // ═════════════════════════════════════════════════════════════════════════

  // ─── PECTORAUX (+15) ──────────────────────────────────────────────────
  exo('Développé incliné Smith', 'pectoraux', 'Pectoraux haut', ['Triceps'], ['Machine'], 'debutant'),
  exo('Développé décliné Smith', 'pectoraux', 'Pectoraux bas', ['Triceps'], ['Machine'], 'debutant'),
  exo('Cable fly couché incliné', 'pectoraux', 'Pectoraux haut', ['Deltoïde antérieur'], ['Câble'], 'intermediaire'),
  exo('Cable fly couché décliné', 'pectoraux', 'Pectoraux bas', ['Deltoïde antérieur'], ['Câble'], 'intermediaire'),
  exo('Cable fly debout poitrine', 'pectoraux', 'Pectoraux milieu', ['Deltoïde antérieur'], ['Câble'], 'intermediaire'),
  exo('Pompes T', 'pectoraux', 'Pectoraux milieu', ['Triceps', 'Obliques'], ['Poids du corps'], 'intermediaire'),
  exo('Pompes Spiderman', 'pectoraux', 'Pectoraux milieu', ['Triceps', 'Obliques'], ['Poids du corps'], 'intermediaire'),
  exo('Pompes Hindu', 'pectoraux', 'Pectoraux haut', ['Triceps', 'Deltoïde antérieur'], ['Poids du corps'], 'avance'),
  exo('Pompes plyo', 'pectoraux', 'Pectoraux milieu', ['Triceps', 'Deltoïde antérieur'], ['Poids du corps'], 'avance'),
  exo('Pompes clap', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Poids du corps'], 'avance'),
  exo('Pompes archer une main', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Poids du corps'], 'avance'),
  exo('Floor press barre', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Barre'], 'intermediaire'),
  exo('Squeeze press', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Haltères'], 'intermediaire'),
  exo('Pec deck convergent', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Machine'], 'debutant'),
  exo('Larsen press', 'pectoraux', 'Pectoraux milieu', ['Triceps'], ['Barre'], 'avance'),

  // ─── DOS (+15) ─────────────────────────────────────────────────────────
  exo('Tractions commando', 'dos', 'Grand dorsal', ['Biceps'], ['Poids du corps'], 'avance'),
  exo('Tractions mixed grip', 'dos', 'Grand dorsal', ['Biceps'], ['Poids du corps'], 'intermediaire'),
  exo('Rowing landmine', 'dos', 'Grand dorsal', ['Biceps', 'Trapèzes'], ['Barre'], 'intermediaire'),
  exo('Rowing chest supported', 'dos', 'Rhomboïdes', ['Trapèzes'], ['Haltères'], 'debutant'),
  exo('Rowing serré câble', 'dos', 'Rhomboïdes', ['Biceps'], ['Câble'], 'debutant'),
  exo('Rowing prise large câble', 'dos', 'Grand dorsal', ['Biceps', 'Trapèzes'], ['Câble'], 'debutant'),
  exo('Tirage poitrine prise neutre', 'dos', 'Grand dorsal', ['Biceps'], ['Câble'], 'debutant'),
  exo('Tirage one arm câble', 'dos', 'Grand dorsal', ['Biceps'], ['Câble'], 'intermediaire'),
  exo('Hyperextension lestée', 'dos', 'Lombaires', ['Fessiers'], ['Poids du corps'], 'intermediaire'),
  exo('Snatch grip deadlift', 'dos', 'Lombaires', ['Trapèzes', 'Grand dorsal'], ['Barre'], 'avance'),
  exo('Deficit deadlift', 'dos', 'Lombaires', ['Ischios', 'Fessiers'], ['Barre'], 'avance'),
  exo('Block deadlift', 'dos', 'Lombaires', ['Trapèzes'], ['Barre'], 'avance'),
  exo('Rack pull', 'dos', 'Trapèzes', ['Lombaires'], ['Barre'], 'intermediaire'),
  exo('Cable lat pullover', 'dos', 'Grand dorsal', ['Triceps'], ['Câble'], 'intermediaire'),
  exo('Single arm rowing câble', 'dos', 'Grand dorsal', ['Biceps'], ['Câble'], 'intermediaire'),

  // ─── ÉPAULES (+15) ─────────────────────────────────────────────────────
  exo('Bus driver press', 'epaules', 'Deltoïde antérieur', ['Trapèzes'], ['Barre'], 'intermediaire'),
  exo('Plate front raise', 'epaules', 'Deltoïde antérieur', [], ['Poids du corps'], 'debutant'),
  exo('Cable Y raise', 'epaules', 'Deltoïde postérieur', ['Trapèzes'], ['Câble'], 'intermediaire'),
  exo('Cable W raise', 'epaules', 'Deltoïde postérieur', ['Trapèzes'], ['Câble'], 'intermediaire'),
  exo('Egyptian press', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Haltères'], 'intermediaire'),
  exo('Push press barre', 'epaules', 'Deltoïde antérieur', ['Triceps', 'Quadriceps'], ['Barre'], 'avance'),
  exo('Push jerk barre', 'epaules', 'Deltoïde antérieur', ['Triceps', 'Quadriceps'], ['Barre'], 'avance'),
  exo('Pike push-up', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Poids du corps'], 'intermediaire'),
  exo('Wall walk', 'epaules', 'Deltoïde antérieur', ['Triceps', 'Transverse'], ['Poids du corps'], 'avance'),
  exo('Élévations latérales tempo', 'epaules', 'Deltoïde latéral', [], ['Haltères'], 'intermediaire'),
  exo('Single arm overhead press haltère', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Haltères'], 'intermediaire'),
  exo('Single arm cable lateral', 'epaules', 'Deltoïde latéral', [], ['Câble'], 'intermediaire'),
  exo('Behind the back lateral raise câble', 'epaules', 'Deltoïde latéral', [], ['Câble'], 'intermediaire'),
  exo('Snatch grip high pull', 'epaules', 'Deltoïde latéral', ['Trapèzes'], ['Barre'], 'avance'),
  exo('Bradford press haltères', 'epaules', 'Deltoïde antérieur', ['Triceps'], ['Haltères'], 'avance'),

  // ─── BRAS (+15) ────────────────────────────────────────────────────────
  exo('Curl Bayesian câble', 'bras', 'Biceps', [], ['Câble'], 'intermediaire'),
  exo('Hammer curl pupitre', 'bras', 'Biceps', ['Avant-bras'], ['Haltères'], 'intermediaire'),
  exo('Reverse curl haltères', 'bras', 'Avant-bras', ['Biceps'], ['Haltères'], 'intermediaire'),
  exo('Reverse wrist curl', 'bras', 'Avant-bras', [], ['Barre'], 'debutant'),
  exo('Curl marteau croisé', 'bras', 'Biceps', [], ['Haltères'], 'debutant'),
  exo('Triceps overhead corde unilatéral', 'bras', 'Triceps', [], ['Câble'], 'intermediaire'),
  exo('Triceps PJR pullover', 'bras', 'Triceps', ['Grand dorsal'], ['Barre'], 'avance'),
  exo('Single arm cable triceps', 'bras', 'Triceps', [], ['Câble'], 'debutant'),
  exo('Skull crusher haltère unilatéral', 'bras', 'Triceps', [], ['Haltères'], 'intermediaire'),
  exo('Cable concentration curl', 'bras', 'Biceps', [], ['Câble'], 'intermediaire'),
  exo('Curl haltère prise étroite', 'bras', 'Biceps', [], ['Haltères'], 'debutant'),
  exo('Curl prise neutre câble', 'bras', 'Biceps', ['Avant-bras'], ['Câble'], 'debutant'),
  exo('Curl alterné haltères', 'bras', 'Biceps', [], ['Haltères'], 'debutant'),
  exo('Triceps poulie haute prise large', 'bras', 'Triceps', [], ['Câble'], 'debutant'),
  exo('Hammer rope curl', 'bras', 'Biceps', ['Avant-bras'], ['Câble'], 'debutant'),

  // ─── JAMBES (+25) ──────────────────────────────────────────────────────
  exo('Squat overhead barre', 'jambes', 'Quadriceps', ['Fessiers', 'Deltoïde antérieur'], ['Barre'], 'avance'),
  exo('Squat one and a half', 'jambes', 'Quadriceps', ['Fessiers'], ['Barre'], 'intermediaire'),
  exo('Squat tempo', 'jambes', 'Quadriceps', ['Fessiers'], ['Barre'], 'intermediaire', { videoQuery: 'tempo squat 3-1-1' }),
  exo('Squat sumo barre', 'jambes', 'Adducteurs', ['Quadriceps', 'Fessiers'], ['Barre'], 'intermediaire'),
  exo('Front squat haltères croisés', 'jambes', 'Quadriceps', ['Fessiers'], ['Haltères'], 'intermediaire'),
  exo('Bulgarian split squat barre arrière', 'jambes', 'Quadriceps', ['Fessiers'], ['Barre'], 'avance'),
  exo('Reverse lunge barre', 'jambes', 'Quadriceps', ['Fessiers'], ['Barre'], 'intermediaire'),
  exo('Curtsy lunge', 'jambes', 'Fessiers', ['Adducteurs', 'Quadriceps'], ['Haltères'], 'intermediaire'),
  exo('Walking lunge poids du corps', 'jambes', 'Quadriceps', ['Fessiers', 'Ischios'], ['Poids du corps'], 'debutant'),
  exo('Step-up latéral', 'jambes', 'Fessiers', ['Quadriceps'], ['Haltères'], 'debutant'),
  exo('Romanian deadlift unilatéral haltère', 'jambes', 'Ischios', ['Fessiers'], ['Haltères'], 'avance'),
  exo('Single leg leg press', 'jambes', 'Quadriceps', ['Fessiers'], ['Machine'], 'debutant'),
  exo('Single leg curl debout', 'jambes', 'Ischios', [], ['Machine'], 'debutant'),
  exo('Goblet squat plate', 'jambes', 'Quadriceps', ['Fessiers'], ['Poids du corps'], 'debutant'),
  exo('Cable squat', 'jambes', 'Quadriceps', ['Fessiers'], ['Câble'], 'debutant'),
  exo('Hip thrust unilatéral barre', 'jambes', 'Fessiers', ['Ischios'], ['Barre'], 'avance'),
  exo('Single leg hip thrust lesté', 'jambes', 'Fessiers', ['Ischios'], ['Haltères'], 'avance'),
  exo('Cable hip abduction unilatéral', 'jambes', 'Fessiers', [], ['Câble'], 'debutant'),
  exo('Standing calf machine sumo', 'jambes', 'Mollets', [], ['Machine'], 'intermediaire'),
  exo('Seated calf with plate', 'jambes', 'Mollets', [], ['Poids du corps'], 'debutant'),
  exo('Tibialis raise', 'jambes', 'Mollets', [], ['Poids du corps'], 'debutant'),
  exo('Donkey calf raise haltère', 'jambes', 'Mollets', [], ['Haltères'], 'intermediaire'),
  exo('Reverse Nordic curl', 'jambes', 'Quadriceps', [], ['Poids du corps'], 'avance'),
  exo('Cossack squat haltère', 'jambes', 'Adducteurs', ['Quadriceps', 'Fessiers'], ['Haltères'], 'intermediaire'),
  exo('ATG split squat', 'jambes', 'Quadriceps', ['Fessiers'], ['Poids du corps'], 'avance'),

  // ─── ABDOS (+15) ──────────────────────────────────────────────────────
  exo('Cable wood chop bas-haut', 'abdos', 'Obliques', ['Grand droit'], ['Câble'], 'intermediaire'),
  exo('Cable side bend', 'abdos', 'Obliques', [], ['Câble'], 'debutant'),
  exo('Cable Pallof press half kneeling', 'abdos', 'Transverse', ['Obliques'], ['Câble'], 'intermediaire'),
  exo('Hanging knee raises', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'intermediaire'),
  exo('Hanging windshield wipers', 'abdos', 'Obliques', ['Grand droit'], ['Poids du corps'], 'avance'),
  exo('L-sit', 'abdos', 'Grand droit', ['Transverse', 'Triceps'], ['Poids du corps'], 'avance'),
  exo('Plank lesté', 'abdos', 'Transverse', ['Grand droit'], ['Poids du corps'], 'intermediaire'),
  exo('Plank reach', 'abdos', 'Transverse', ['Grand droit', 'Deltoïde antérieur'], ['Poids du corps'], 'intermediaire'),
  exo('Side plank lifts', 'abdos', 'Obliques', ['Transverse'], ['Poids du corps'], 'intermediaire'),
  exo('Renegade plank haltères', 'abdos', 'Transverse', ['Grand droit', 'Triceps'], ['Haltères'], 'avance'),
  exo('Mountain climber lent', 'abdos', 'Transverse', ['Grand droit'], ['Poids du corps'], 'debutant'),
  exo('Reverse crunch lesté', 'abdos', 'Grand droit', ['Transverse'], ['Poids du corps'], 'intermediaire'),
  exo('Decline sit-up', 'abdos', 'Grand droit', [], ['Poids du corps'], 'intermediaire'),
  exo('Cable crunch debout', 'abdos', 'Grand droit', [], ['Câble'], 'debutant'),
  exo('Hollow rock', 'abdos', 'Transverse', ['Grand droit'], ['Poids du corps'], 'intermediaire'),
];

// ---------------------------------------------------------------------------
// Catalogue combiné (built-in + custom)
// ---------------------------------------------------------------------------

export function getCombinedCatalog(customExercises) {
  const custom = Array.isArray(customExercises) ? customExercises : [];
  return [...custom, ...BUILTIN_CATALOG];
}

// ---------------------------------------------------------------------------
// Filtrage hiérarchique
// ---------------------------------------------------------------------------
// filters :
//   { groups: ['dos','jambes'],
//     subMuscles: ['Grand dorsal','Quadriceps'],   // labels lisibles
//     equipment: ['Haltères'],
//     level: 'intermediaire' }
// Logique :
//   - Si subMuscles non vide, on filtre sur ces sous-muscles précis.
//   - Sinon, si groups non vide, on filtre sur ces groupes.
//   - equipment : intersection requise.
//   - level : permissif (un exo "debutant" passe pour tous les niveaux,
//            "intermediaire" passe pour intermediaire+avance, etc.).
//
export function filterCatalog(catalog, filters) {
  const f = filters || {};
  const groups = Array.isArray(f.groups) ? f.groups : [];
  const subs = Array.isArray(f.subMuscles) ? f.subMuscles : [];
  const eqs = Array.isArray(f.equipment) ? f.equipment.map(normalizeId) : [];
  const lv = normalizeId(f.level || '');

  const subIds = subs.map(normalizeId);
  const order = { debutant: 0, intermediaire: 1, avance: 2 };

  return (Array.isArray(catalog) ? catalog : []).filter((ex) => {
    if (!ex) return false;
    // Sous-muscles
    if (subIds.length > 0) {
      const candidates = [ex.targetMuscle, ...(Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [])]
        .filter(Boolean)
        .map(normalizeId);
      if (!candidates.some((id) => subIds.includes(id))) return false;
    } else if (groups.length > 0) {
      // Match sur le groupe (targetMuscleGroup) ou via mapping sous-muscle → groupe
      const targetGid = ex.targetMuscleGroup || SUBMUSCLE_TO_GROUP[normalizeId(ex.targetMuscle || '')] || '';
      const secondaryGids = (Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [])
        .map((m) => SUBMUSCLE_TO_GROUP[normalizeId(m)] || '');
      const allGids = [targetGid, ...secondaryGids].filter(Boolean);
      if (!allGids.some((g) => groups.includes(g))) return false;
    }
    // Équipement
    if (eqs.length > 0) {
      const list = Array.isArray(ex.equipment) ? ex.equipment.map(normalizeId) : [];
      if (!list.some((id) => eqs.includes(id))) return false;
    }
    // Niveau
    if (lv) {
      const exLvl = normalizeId(ex.level || '');
      if ((order[exLvl] ?? 99) > (order[lv] ?? -1)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Algorithme de génération adaptive
// ---------------------------------------------------------------------------
// Score pondéré pour favoriser les exos adaptés au niveau :
//   - debutant   : +bonus si isMachine (guidé, plus sûr), -malus si avance
//   - avance     : +bonus si isFreeWeight (poly-articulaire, libre), -malus si debutant
//   - intermediaire : équilibré, léger bonus pour libre

function pickScore(ex, level) {
  let s = 0;
  const lv = normalizeId(ex.level || '');
  if (level === 'debutant') {
    if (ex.isMachine) s += 3;
    if (ex.isFreeWeight && !ex.isMachine) s += 0;
    if (lv === 'debutant') s += 2;
    if (lv === 'avance') s -= 4;
  } else if (level === 'avance') {
    if (ex.isFreeWeight) s += 3;
    if (ex.isMachine && !ex.isFreeWeight) s -= 1;
    if (lv === 'avance') s += 2;
    if (lv === 'debutant') s -= 1;
  } else if (level === 'intermediaire') {
    if (ex.isFreeWeight) s += 1;
    if (lv === 'intermediaire') s += 2;
  }
  return s;
}

// Convertit un score en poids (toujours > 0). Une baseline de 5 garantit que les exos
// "moins adaptés" gardent une chance d'apparaître → variété.
function weightFromScore(score) {
  return Math.max(0.8, 5 + score);
}

// Shuffle pondéré (Efraimidis-Spirakis) : pour chaque item, on calcule
// key = -ln(random) / weight. Trier par key croissante donne un échantillon
// pondéré, sans replacement, en O(n log n). Plus le poids est élevé, plus
// l'item a de chances de remonter.
function weightedShuffle(items, weightFn) {
  const arr = items.map((item) => {
    const w = Math.max(0.0001, weightFn(item));
    const r = Math.random();
    // -log(0) → +inf, on borne r pour éviter les NaN si Math.random() = 0
    const safeR = r < 1e-9 ? 1e-9 : r;
    return { item, key: -Math.log(safeR) / w };
  });
  arr.sort((a, b) => a.key - b.key);
  return arr.map((x) => x.item);
}

// Génère une séance instanciée à partir des critères.
// `selection` :
//   { groups[], subMuscles[], equipment[], level, durationMin, customExercises[] }
//
// Stratégie :
//   1. filterCatalog pour obtenir le pool éligible
//   2. Si plusieurs cibles (groups OU subMuscles), distribution round-robin entre elles
//   3. Tri intra-bucket par score décroissant (adaptation au niveau)
//   4. Slice à targetCount (basé sur durée)
//
export function generateWorkout(selection) {
  const sel = selection || {};
  const groups = Array.isArray(sel.groups) ? sel.groups : [];
  const subMuscles = Array.isArray(sel.subMuscles) ? sel.subMuscles : [];
  const equipment = Array.isArray(sel.equipment) ? sel.equipment : [];
  const level = sel.level || '';
  const durationMin = Number(sel.durationMin) || 60;
  const customExercises = Array.isArray(sel.customExercises) ? sel.customExercises : [];

  const catalog = getCombinedCatalog(customExercises);
  const filtered = filterCatalog(catalog, { groups, subMuscles, equipment, level });

  const targetCount = Math.max(3, Math.min(10, Math.round(durationMin / 9)));

  // Cibles utilisées pour le round-robin :
  // - subMuscles si fournis (priorité fine)
  // - sinon groups
  // - sinon une seule pseudo-cible (= tout)
  const targets = subMuscles.length > 0
    ? subMuscles.map((s) => ({ kind: 'sub', value: s }))
    : groups.length > 0
      ? groups.map((g) => ({ kind: 'group', value: g }))
      : [{ kind: 'all' }];

  // Distribue par cible
  const buckets = targets.map((t) => {
    let pool = filtered;
    if (t.kind === 'sub') {
      const target = normalizeId(t.value);
      pool = filtered.filter((ex) => {
        const all = [ex.targetMuscle, ...(Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [])]
          .filter(Boolean)
          .map(normalizeId);
        return all.includes(target);
      });
    } else if (t.kind === 'group') {
      pool = filtered.filter((ex) => {
        const targetGid = ex.targetMuscleGroup || SUBMUSCLE_TO_GROUP[normalizeId(ex.targetMuscle || '')] || '';
        return targetGid === t.value;
      });
    }
    // Shuffle pondéré (variété + respect du score d'adaptation au niveau)
    pool = weightedShuffle(pool, (ex) => weightFromScore(pickScore(ex, level)));
    return { target: t, pool };
  });

  const seen = new Set();
  const picked = [];
  let idx = 0;
  let safety = targetCount * Math.max(1, buckets.length) * 4;
  while (picked.length < targetCount && safety > 0) {
    const b = buckets[idx % buckets.length];
    if (b && b.pool.length > 0) {
      // Trouve le 1er non-déjà-pris
      let chosen = null;
      while (b.pool.length > 0) {
        const cand = b.pool.shift();
        if (!seen.has(cand.id)) {
          chosen = cand;
          break;
        }
      }
      if (chosen) {
        seen.add(chosen.id);
        picked.push(chosen);
      }
    }
    idx += 1;
    safety -= 1;
  }

  // Complète depuis le pool global filtré si besoin (lui aussi shuffled)
  if (picked.length < targetCount) {
    const shuffledAll = weightedShuffle(filtered, (ex) => weightFromScore(pickScore(ex, level)));
    for (const ex of shuffledAll) {
      if (picked.length >= targetCount) break;
      if (!seen.has(ex.id)) {
        seen.add(ex.id);
        picked.push(ex);
      }
    }
  }

  // Construit le nom
  const name = (() => {
    if (subMuscles.length === 1) return `Séance ${subMuscles[0]}`;
    if (groups.length === 1) {
      const g = MUSCLE_GROUPS.find((x) => x.id === groups[0]);
      return g ? `Séance ${g.label}` : 'Séance personnalisée';
    }
    return 'Séance personnalisée';
  })();

  const description = subMuscles.length > 0
    ? subMuscles.join(' • ')
    : groups
      .map((g) => (MUSCLE_GROUPS.find((x) => x.id === g) || {}).label)
      .filter(Boolean)
      .join(' • ');

  return {
    name,
    description,
    exercises: picked.map((ex) => ({
      ...ex,
      sets: defaultSets(4),
      notes: '',
      groupId: null,
    })),
    notes: '',
    status: 'in_progress',
    durationSeconds: 0,
  };
}
