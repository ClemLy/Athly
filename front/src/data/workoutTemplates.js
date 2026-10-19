// Templates de séances — données locales, indépendantes du backend.
// Les exercices reprennent les muscles et équipements visibles dans la maquette,
// avec 4 sets vides par exercice. Les sets sont remplis pendant la séance.

import { catalogEntryFor } from './exerciseCatalog';

const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

const emptySets = (n = 4) => {
  const arr = [];
  for (let i = 0; i < n; i += 1) arr.push({});
  return arr;
};

function buildExercise({ name, targetMuscle, secondaryMuscles = [], equipment = [], level = 'intermediaire', sets = 4, videoQuery }) {
  return {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    targetMuscle,
    secondaryMuscles,
    equipment: Array.isArray(equipment) ? equipment : [equipment].filter(Boolean),
    level,
    videoUrl: yt(videoQuery || name),
    sets: emptySets(sets),
    notes: '',
  };
}

export const TEMPLATES = [
  {
    id: 'push',
    name: 'Séance Push',
    description: 'Pectoraux, épaules, triceps',
    musclesSummary: 'Pectoraux • Triceps • Épaules',
    icon: 'barbell-outline',
    estimatedDurationMin: 75,
    buildExercises: () => [
      buildExercise({
        name: 'Développé couché',
        targetMuscle: 'Pectoraux',
        secondaryMuscles: ['Triceps', 'Épaules'],
        equipment: ['Haltères'],
        videoQuery: 'développé couché haltères technique',
      }),
      buildExercise({
        name: 'Développé incliné',
        targetMuscle: 'Pectoraux (haut)',
        secondaryMuscles: ['Triceps', 'Épaules'],
        equipment: ['Haltères'],
        videoQuery: 'développé incliné haltères technique',
      }),
      buildExercise({
        name: 'Écarté à la poulie',
        targetMuscle: 'Pectoraux',
        secondaryMuscles: ['Épaules avant'],
        equipment: ['Câble'],
        videoQuery: 'écarté à la poulie technique',
      }),
      buildExercise({
        name: 'Dips',
        targetMuscle: 'Triceps',
        secondaryMuscles: ['Pectoraux', 'Épaules'],
        equipment: ['Poids du corps'],
        videoQuery: 'dips technique',
      }),
      buildExercise({
        name: 'Extension triceps',
        targetMuscle: 'Triceps',
        secondaryMuscles: [],
        equipment: ['Haltères'],
        videoQuery: 'extension triceps haltères',
      }),
      buildExercise({
        name: 'Élévations latérales',
        targetMuscle: 'Épaules (latéral)',
        secondaryMuscles: ['Trapèzes'],
        equipment: ['Haltères'],
        videoQuery: 'élévations latérales haltères',
      }),
      buildExercise({
        name: 'Développé militaire',
        targetMuscle: 'Épaules',
        secondaryMuscles: ['Triceps'],
        equipment: ['Barre'],
        videoQuery: 'développé militaire barre',
      }),
      buildExercise({
        name: 'Oiseau',
        targetMuscle: 'Épaules (arrière)',
        secondaryMuscles: ['Trapèzes'],
        equipment: ['Haltères'],
        videoQuery: 'oiseau haltères deltoïde postérieur',
      }),
    ],
  },
  {
    id: 'pull',
    name: 'Séance Pull',
    description: 'Dos, biceps, trapèzes',
    musclesSummary: 'Dos • Biceps • Trapèzes',
    icon: 'fitness-outline',
    estimatedDurationMin: 70,
    buildExercises: () => [
      buildExercise({
        name: 'Tractions',
        targetMuscle: 'Dos',
        secondaryMuscles: ['Biceps'],
        equipment: ['Poids du corps'],
        videoQuery: 'tractions technique',
      }),
      buildExercise({
        name: 'Rowing barre',
        targetMuscle: 'Dos',
        secondaryMuscles: ['Biceps', 'Avant-bras'],
        equipment: ['Barre'],
        videoQuery: 'rowing barre technique',
      }),
      buildExercise({
        name: 'Tirage poitrine',
        targetMuscle: 'Dos (large)',
        secondaryMuscles: ['Biceps'],
        equipment: ['Câble'],
        videoQuery: 'tirage poitrine technique',
      }),
      buildExercise({
        name: 'Tirage horizontal',
        targetMuscle: 'Dos (milieu)',
        secondaryMuscles: ['Biceps', 'Trapèzes'],
        equipment: ['Câble'],
        videoQuery: 'tirage horizontal technique',
      }),
      buildExercise({
        name: 'Curl biceps',
        targetMuscle: 'Biceps',
        secondaryMuscles: [],
        equipment: ['Haltères'],
        videoQuery: 'curl biceps haltères',
      }),
      buildExercise({
        name: 'Curl marteau',
        targetMuscle: 'Biceps',
        secondaryMuscles: ['Avant-bras'],
        equipment: ['Haltères'],
        videoQuery: 'curl marteau haltères',
      }),
      buildExercise({
        name: 'Élévations arrière',
        targetMuscle: 'Épaules (arrière)',
        secondaryMuscles: ['Trapèzes'],
        equipment: ['Haltères'],
        videoQuery: 'élévations arrière haltères',
      }),
    ],
  },
  {
    id: 'legs',
    name: 'Séance Jambes',
    description: 'Quadriceps, ischios, fessiers',
    musclesSummary: 'Quadriceps • Ischios • Fessiers',
    icon: 'walk-outline',
    estimatedDurationMin: 80,
    buildExercises: () => [
      buildExercise({
        name: 'Squat',
        targetMuscle: 'Quadriceps',
        secondaryMuscles: ['Fessiers', 'Ischios'],
        equipment: ['Barre'],
        videoQuery: 'squat technique',
      }),
      buildExercise({
        name: 'Soulevé de terre roumain',
        targetMuscle: 'Ischios',
        secondaryMuscles: ['Fessiers', 'Lombaires'],
        equipment: ['Barre'],
        videoQuery: 'soulevé de terre roumain',
      }),
      buildExercise({
        name: 'Leg Press',
        targetMuscle: 'Quadriceps',
        secondaryMuscles: ['Fessiers'],
        equipment: ['Machine'],
        videoQuery: 'presse à cuisses',
      }),
      buildExercise({
        name: 'Fentes marchées',
        targetMuscle: 'Quadriceps',
        secondaryMuscles: ['Fessiers', 'Ischios'],
        equipment: ['Haltères'],
        videoQuery: 'fentes marchées haltères',
      }),
      buildExercise({
        name: 'Leg curl',
        targetMuscle: 'Ischios',
        secondaryMuscles: [],
        equipment: ['Machine'],
        videoQuery: 'leg curl machine',
      }),
      buildExercise({
        name: 'Mollets debout',
        targetMuscle: 'Mollets',
        secondaryMuscles: [],
        equipment: ['Machine'],
        videoQuery: 'mollets debout machine',
      }),
    ],
  },
  {
    id: 'fullbody',
    name: 'Full body',
    description: 'Tout le corps en une séance',
    musclesSummary: 'Pectoraux • Dos • Jambes • Bras',
    icon: 'flame-outline',
    estimatedDurationMin: 60,
    buildExercises: () => [
      buildExercise({
        name: 'Squat',
        targetMuscle: 'Quadriceps',
        secondaryMuscles: ['Fessiers'],
        equipment: ['Barre'],
        videoQuery: 'squat technique',
      }),
      buildExercise({
        name: 'Développé couché',
        targetMuscle: 'Pectoraux',
        secondaryMuscles: ['Triceps', 'Épaules'],
        equipment: ['Haltères'],
        videoQuery: 'développé couché haltères',
      }),
      buildExercise({
        name: 'Tractions',
        targetMuscle: 'Dos',
        secondaryMuscles: ['Biceps'],
        equipment: ['Poids du corps'],
        videoQuery: 'tractions technique',
      }),
      buildExercise({
        name: 'Soulevé de terre roumain',
        targetMuscle: 'Ischios',
        secondaryMuscles: ['Fessiers', 'Lombaires'],
        equipment: ['Barre'],
        videoQuery: 'soulevé de terre roumain',
      }),
      buildExercise({
        name: 'Développé militaire',
        targetMuscle: 'Épaules',
        secondaryMuscles: ['Triceps'],
        equipment: ['Barre'],
        videoQuery: 'développé militaire',
      }),
      buildExercise({
        name: 'Gainage',
        targetMuscle: 'Abdos',
        secondaryMuscles: ['Lombaires'],
        equipment: ['Poids du corps'],
        videoQuery: 'gainage planche technique',
      }),
    ],
  },
];

// ─── Séances types de calisthénie ─────────────────────────────────────────────
// Construites depuis le catalogue (démos, suivi en secondes, part du poids du
// corps). Les séances A et B reprennent la structure d'un programme progressif :
// A = poussée, jambes, gainage ; B = tirage, chaîne postérieure, gainage.
function fromCatalog(name, sets = 3) {
  const entry = catalogEntryFor({ name });
  if (!entry) return null;
  return { ...entry, id: `${entry.id}-${Math.random().toString(36).slice(2, 7)}`, sets: emptySets(sets), notes: '' };
}

function caliTemplate(t) {
  return {
    discipline: 'calisthenie',
    icon: 'body-outline',
    ...t,
    buildExercises: () => t.exercises.map(([name, sets]) => fromCatalog(name, sets)).filter(Boolean),
  };
}

export const CALI_TEMPLATES = [
  caliTemplate({
    id: 'cali-decouverte', level: 'debutant', name: 'Corps entier débutant complet',
    description: 'Pour reprendre en douceur, sans matériel ou presque',
    musclesSummary: 'Pompes • Tirage • Jambes • Gainage', estimatedDurationMin: 30,
    exercises: [['Pompes au mur', 2], ['Rowing sous la table genoux pliés', 2], ['Squat à la chaise', 2], ['Glute bridge', 2], ['Planche sur les genoux', 2], ['Bird dog', 2]],
  }),
  caliTemplate({
    id: 'cali-a', level: 'debutant', name: 'Séance A : poussée, jambes, gainage',
    description: 'À alterner avec la séance B', musclesSummary: 'Pectoraux • Épaules • Cuisses • Abdos', estimatedDurationMin: 40,
    exercises: [['Pompes inclinées', 3], ['Pike push-up mains sur la table', 3], ['Fentes statiques', 3], ['Squat tempo', 2], ['Gainage', 3], ['Planche latérale sur les genoux', 2]],
  }),
  caliTemplate({
    id: 'cali-b', level: 'debutant', name: 'Séance B : tirage, chaîne postérieure, gainage',
    description: 'À alterner avec la séance A', musclesSummary: 'Dos • Fessiers • Ischios • Tronc', estimatedDurationMin: 40,
    exercises: [['Rowing sous la table jambes tendues', 3], ['Tirage vertical à l’élastique', 3], ['Face pull à l’élastique', 2], ['Hip thrust poids du corps', 3], ['Soulevé de terre à une jambe', 2], ['Dead bug', 2], ['Pallof press', 2]],
  }),
  caliTemplate({
    id: 'cali-push', level: 'intermediaire', name: 'Push calisthénie', icon: 'arrow-up-outline',
    description: 'Poussées horizontales et verticales', musclesSummary: 'Pectoraux • Épaules • Triceps', estimatedDurationMin: 45,
    exercises: [['Pompes', 4], ['Pike push-up', 3], ['Dips', 3], ['Pompes diamant', 3], ['Hollow hold', 3]],
  }),
  caliTemplate({
    id: 'cali-pull', level: 'intermediaire', name: 'Pull calisthénie', icon: 'arrow-down-outline',
    description: 'Tractions et rowing', musclesSummary: 'Dos • Biceps • Abdos', estimatedDurationMin: 45,
    exercises: [['Tractions', 4], ['Tractions australiennes', 3], ['Chin-ups', 3], ['Hanging knee raises', 3], ['Superman', 2]],
  }),
  caliTemplate({
    id: 'cali-legs', level: 'intermediaire', name: 'Jambes calisthénie', icon: 'walk-outline',
    description: 'Unilatéral et chaîne postérieure', musclesSummary: 'Cuisses • Fessiers • Ischios • Mollets', estimatedDurationMin: 45,
    exercises: [['Squat bulgare', 3], ['Pistol squat assisté', 3], ['Leg curl glissé', 3], ['Single leg calf raise', 3], ['Side plank', 2]],
  }),
  caliTemplate({
    id: 'cali-force', level: 'avance', name: 'Force avancée', icon: 'flash-outline',
    description: 'Les variantes dures des mouvements de base', musclesSummary: 'Corps entier', estimatedDurationMin: 55,
    exercises: [['Tractions archer', 4], ['Dips aux anneaux', 4], ['Pompes archer', 3], ['Pistol squat', 3], ['L-sit', 3], ['Toes to bar', 3]],
  }),
  caliTemplate({
    id: 'cali-equilibre', level: 'intermediaire', name: 'Skill : équilibre sur les mains', icon: 'hand-left-outline',
    description: 'Construire le poirier pas à pas', musclesSummary: 'Épaules • Poignets • Gainage', estimatedDurationMin: 35,
    exercises: [['Wall walk', 3], ['Poirier face au mur', 4], ['Pike push-up pieds surélevés', 3], ['Hollow hold', 3]],
  }),
  caliTemplate({
    id: 'cali-planche', level: 'avance', name: 'Skill : planche', icon: 'airplane-outline',
    description: 'Épaules en avant, bras verrouillés', musclesSummary: 'Épaules • Pectoraux • Gainage', estimatedDurationMin: 40,
    exercises: [['Planche lean', 4], ['Posture du corbeau', 3], ['Tuck planche', 4], ['Pompes pseudo planche', 3], ['L-sit groupé', 3]],
  }),
  caliTemplate({
    id: 'cali-front-lever', level: 'avance', name: 'Skill : front lever et muscle-up', icon: 'trending-up-outline',
    description: 'Tirage puissant et gainage sous la barre', musclesSummary: 'Dos • Abdos • Bras', estimatedDurationMin: 45,
    exercises: [['Tuck front lever', 4], ['Tractions explosives', 4], ['Transition de muscle-up', 3], ['Skin the cat', 2], ['Relevé de jambes suspendu', 3]],
  }),
  caliTemplate({
    id: 'cali-elite', level: 'elite', name: 'Élite', icon: 'trophy-outline',
    description: 'Pour ceux qui maîtrisent déjà les skills', musclesSummary: 'Corps entier', estimatedDurationMin: 60,
    exercises: [['Muscle-up', 4], ['Straddle front lever', 4], ['Straddle planche', 4], ['Pompes en équilibre contre le mur', 3], ['Pistol squat lesté', 3], ['Dragon flag', 3]],
  }),
];

// Construit un workout prêt-à-être-passé à WorkoutScreen depuis un template.
export function instantiateWorkout(template) {
  if (!template) return null;
  return {
    name: template.name,
    exercises: template.buildExercises(),
    notes: '',
    status: 'in_progress',
    durationSeconds: 0,
  };
}

export function findTemplate(id) {
  return [...TEMPLATES, ...CALI_TEMPLATES].find((t) => t.id === id) || null;
}

// Mapping muscle group → template "principal" qui le sollicite le plus.
// Utilisé par la home page pour proposer une séance recommandée à partir d'un
// groupe sous-travaillé (cf. stats.service.recommendNextMuscleGroup).
const GROUP_TO_TEMPLATE = {
  pectoraux: 'push',
  epaules: 'push',
  dos: 'pull',
  bras: 'pull',
  jambes: 'legs',
  abdos: 'fullbody',
};

const GROUP_TO_CALI = {
  pectoraux: 'cali-push', epaules: 'cali-push', dos: 'cali-pull', bras: 'cali-pull', jambes: 'cali-legs', abdos: 'cali-a',
};

// practice : 'salle' (défaut), 'calisthenie' ou 'mixte' (voir hooks/usePractice)
export function findTemplateForGroup(groupId, practice = 'salle') {
  if (practice === 'calisthenie') {
    const id = GROUP_TO_CALI[groupId] || 'cali-a';
    return CALI_TEMPLATES.find((t) => t.id === id) || CALI_TEMPLATES[0];
  }
  const templateId = GROUP_TO_TEMPLATE[groupId] || 'fullbody';
  return TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0] || null;
}
