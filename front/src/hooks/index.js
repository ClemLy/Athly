// ─── Barrel des hooks ─────────────────────────────────────────────────────────
// Point d'entrée unique : `import { useAvatarFrame, useEffortTimer } from '../hooks';`
// Les hooks à export default sont ré-exportés sous leur nom canonique.

export { useAvatarFrame } from './useAvatarFrame';
export { useDevSettings } from './useDevSettings';
export { default as useEffortTimer, formatDuration } from './useEffortTimer';
export { default as useExerciseSorting, isFiltering } from './useExerciseSorting';
export { useFeaturedTrophies, MAX_FEATURED } from './useFeaturedTrophies';
export { useGoogleAuth } from './useGoogleAuth';
export { default as useWorkoutState } from './useWorkoutState';
