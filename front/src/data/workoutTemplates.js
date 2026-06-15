// Templates de séances — données locales, indépendantes du backend.
// Les exercices reprennent les muscles et équipements visibles dans la maquette,
// avec 4 sets vides par exercice. Les sets sont remplis pendant la séance.

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
    icon: '💪',
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
    icon: '💪',
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
    icon: '🦵',
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
        name: 'Presse à cuisses',
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
    icon: '🔥',
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
  return TEMPLATES.find((t) => t.id === id) || null;
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

export function findTemplateForGroup(groupId) {
  const templateId = GROUP_TO_TEMPLATE[groupId] || 'fullbody';
  return TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0] || null;
}
