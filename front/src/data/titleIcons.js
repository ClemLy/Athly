// ─── Icône de chaque titre ────────────────────────────────────────────────────
// Une icône qui évoque le défi accompli (voir back/data/titleCatalog.js).
// Un titre ajouté côté serveur sans icône ici retombe sur le ruban.

const TITLE_ICONS = {
  PERFORM_LEVEL_10:        'bandage-outline',       // Le Rescapé
  PERFORM_LEVEL_50:        'podium-outline',        // Le Titan
  REFERRAL_EARLY:          'hourglass-outline',     // L'Ancien
  PR_HEAVY_100:            'barbell-outline',       // Force de la Nature
  LOOT_LEGENDARY:          'hand-left-outline',     // Main Dorée
  LOOT_BLOOD_UNIQUE:       'water-outline',         // Élu du Sang
  INVENTORY_HOARDER:       'cube-outline',          // Le Collectionneur
  MULTI_SESSIONS_30_TITLE: 'people-outline',        // Frère d'Armes
  SOLO_SHADOW_WORK:        'paw-outline',           // Loup Solitaire
  SHAME_BURNING:           'heart-dislike-outline', // Bourreau des Cœurs
  SHAME_REPENTANCE:        'refresh-outline',       // Le Repentir
  WORKOUT_IRON_BREAKER:    'hammer-outline',        // Le Briseur de Fonte
  WORKOUT_NIGHT_OWL:       'moon-outline',          // L'Ombre de la Salle
  STREAK_INSUBMERSIBLE:    'boat-outline',          // L'Insubmersible
  GROUP_GUILD_MASTER:      'flag-outline',          // Maître de Guilde
  SOCIAL_POKE_STRIKER:     'alarm-outline',         // Fléau de la Paresse
  LOBBY_INSTIGATOR:        'megaphone-outline',     // L'Instigateur
};

export function titleIcon(titleId) {
  return TITLE_ICONS[titleId] || 'ribbon-outline';
}
