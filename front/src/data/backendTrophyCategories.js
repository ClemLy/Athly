// Catégorie ajoutée pour les trophées backend V2 sans équivalent local direct
// (collection d'objets par rareté + paliers de coffres ouverts). Partagé
// entre la Salle des Trophées et le panneau God Mode (Réglages) pour que les
// deux vues du catalogue combiné restent cohérentes.
export const COLLECTION_CATEGORY = { id: 'collection', label: 'Collection', icon: 'cube', color: '#3B82F6' };

// Les trophées "profil"/"social" du backend (anniversaire, parrainage, lien
// d'amitié niveau 5) rejoignent les catégories locales équivalentes ; la
// collection (rareté d'objets + coffres) forme sa propre catégorie.
export const BACKEND_CATEGORY_MAP = { profile: 'special', social: 'social', collection: 'collection' };
