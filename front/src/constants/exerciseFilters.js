// Listes des filtres / tri pour la liste d'exercices.
// MUSCLE_GROUPS : hiérarchie groupes → sous-muscles, utilisée par le Builder.
// MUSCLES : version aplatie (1 niveau) gardée pour compatibilité (FilterChip de la liste séance).

export const MUSCLE_GROUPS = [
  {
    id: 'pectoraux',
    label: 'Pectoraux',
    icon: '💪',
    subMuscles: [
      { id: 'pectoraux-haut', label: 'Pectoraux haut' },
      { id: 'pectoraux-milieu', label: 'Pectoraux milieu' },
      { id: 'pectoraux-bas', label: 'Pectoraux bas' },
    ],
  },
  {
    id: 'dos',
    label: 'Dos',
    icon: '💪',
    subMuscles: [
      { id: 'grand-dorsal', label: 'Grand dorsal' },
      { id: 'rhomboides', label: 'Rhomboïdes' },
      { id: 'trapezes', label: 'Trapèzes' },
      { id: 'lombaires', label: 'Lombaires' },
    ],
  },
  {
    id: 'epaules',
    label: 'Épaules',
    icon: '💪',
    subMuscles: [
      { id: 'deltoide-anterieur', label: 'Deltoïde antérieur' },
      { id: 'deltoide-lateral', label: 'Deltoïde latéral' },
      { id: 'deltoide-posterieur', label: 'Deltoïde postérieur' },
    ],
  },
  {
    id: 'bras',
    label: 'Bras',
    icon: '💪',
    subMuscles: [
      { id: 'biceps', label: 'Biceps' },
      { id: 'triceps', label: 'Triceps' },
      { id: 'avant-bras', label: 'Avant-bras' },
    ],
  },
  {
    id: 'jambes',
    label: 'Jambes',
    icon: '🦵',
    subMuscles: [
      { id: 'quadriceps', label: 'Quadriceps' },
      { id: 'ischios', label: 'Ischios' },
      { id: 'fessiers', label: 'Fessiers' },
      { id: 'adducteurs', label: 'Adducteurs' },
      { id: 'mollets', label: 'Mollets' },
    ],
  },
  {
    id: 'abdos',
    label: 'Abdos',
    icon: '💪',
    subMuscles: [
      { id: 'grand-droit', label: 'Grand droit' },
      { id: 'obliques', label: 'Obliques' },
      { id: 'transverse', label: 'Transverse' },
    ],
  },
];

// Vue aplatie des groupes (compat avec usages existants)
export const MUSCLES = MUSCLE_GROUPS.map((g) => ({ id: g.id, label: g.label }));

// Index : id sous-muscle → groupe parent. Utilisé pour l'affichage / matching.
export const SUBMUSCLE_TO_GROUP = MUSCLE_GROUPS.reduce((acc, g) => {
  g.subMuscles.forEach((s) => { acc[s.id] = g.id; });
  return acc;
}, {});

// Liste plate des sous-muscles avec leur groupe parent.
export const ALL_SUBMUSCLES = MUSCLE_GROUPS.flatMap((g) =>
  g.subMuscles.map((s) => ({ ...s, groupId: g.id, groupLabel: g.label })),
);

export const LEVELS = [
  { id: 'debutant', label: 'Débutant' },
  { id: 'intermediaire', label: 'Intermédiaire' },
  { id: 'avance', label: 'Avancé' },
];

export const EQUIPMENTS = [
  { id: 'halteres', label: 'Haltères' },
  { id: 'barre', label: 'Barre' },
  { id: 'cable', label: 'Câble' },
  { id: 'poids-du-corps', label: 'Poids du corps' },
  { id: 'machine', label: 'Machine' },
];

// Glyph affiché dans la card (cohérent avec la maquette : 💪 par défaut, 🔥 pour le poids du corps).
export const ICON_FOR_EQUIPMENT = {
  'poids-du-corps': '🔥',
};

export const ICON_FOR_MUSCLE_GROUP = {
  jambes: '🦵',
};

export const DEFAULT_ICON = '💪';

// Normalise une chaîne libre (accents, casse) en id stable.
export function normalizeId(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Retourne l'icône à afficher pour un exercice donné.
export function pickExerciseIcon(exercise) {
  if (!exercise) return DEFAULT_ICON;
  const equipments = Array.isArray(exercise.equipment)
    ? exercise.equipment
    : [exercise.equipment].filter(Boolean);
  for (const eq of equipments) {
    const id = normalizeId(eq);
    if (ICON_FOR_EQUIPMENT[id]) return ICON_FOR_EQUIPMENT[id];
  }
  const groupId = exercise.targetMuscleGroup
    ? normalizeId(exercise.targetMuscleGroup)
    : '';
  if (ICON_FOR_MUSCLE_GROUP[groupId]) return ICON_FOR_MUSCLE_GROUP[groupId];
  // Fallback sur le sous-muscle (cas legacy)
  const muscleId = normalizeId(exercise.targetMuscle || exercise.muscle || '');
  if (ICON_FOR_MUSCLE_GROUP[muscleId]) return ICON_FOR_MUSCLE_GROUP[muscleId];
  return DEFAULT_ICON;
}

// Retourne le label "lisible" du muscle principal d'un exercice.
// Préférence : sous-muscle (targetMuscle), puis fallback legacy.
export function primaryMuscleLabel(exercise) {
  if (!exercise) return '';
  if (exercise.targetMuscle) return exercise.targetMuscle;
  if (exercise.muscle) return exercise.muscle;
  if (Array.isArray(exercise.muscles) && exercise.muscles.length > 0) return exercise.muscles[0];
  return '';
}

// Retourne la liste des muscles secondaires (hors muscle principal).
export function secondaryMusclesLabels(exercise) {
  if (!exercise) return [];
  if (Array.isArray(exercise.secondaryMuscles)) return exercise.secondaryMuscles;
  if (Array.isArray(exercise.muscles) && exercise.muscles.length > 1) return exercise.muscles.slice(1);
  return [];
}

// Retourne le 1er équipement à afficher dans le tag (string brute).
export function primaryEquipmentLabel(exercise) {
  if (!exercise) return '';
  if (Array.isArray(exercise.equipment) && exercise.equipment.length > 0) return exercise.equipment[0];
  if (typeof exercise.equipment === 'string' && exercise.equipment.trim()) return exercise.equipment;
  return '';
}

// Retourne le label du groupe musculaire principal d'un exo (utilisé par le filtrage Builder).
export function muscleGroupLabel(exercise) {
  if (!exercise) return '';
  const id = exercise.targetMuscleGroup;
  if (!id) return '';
  const g = MUSCLE_GROUPS.find((x) => x.id === id);
  return g ? g.label : '';
}

// Récupère un MUSCLE_GROUPS par son id.
export function findMuscleGroup(id) {
  return MUSCLE_GROUPS.find((g) => g.id === id) || null;
}
