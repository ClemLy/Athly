import API from '../api/api';
import { Colors } from '../constants/theme';

// ─── Inventaire & Coffres (Brique II) ─────────────────────────────────────────

// Catalogue d'affichage — miroir du backend (User.js enum + chest.service.js).
// Source de vérité des effets : le backend. Ceci ne sert qu'à l'UI.
// icon = nom Ionicons (pas d'emoji — cohérence avec le reste du design system).
export const ITEM_CATALOG = {
  ENERGY_DRINK: {
    name: 'Boisson Énergisante', icon: 'flash', rarity: 'common',
    description: '+150 XP instantané', usable: true,
  },
  STREAK_FREEZE: {
    name: 'Gel de Streak', icon: 'snow', rarity: 'rare',
    description: 'Charge 1 gel, sauve ta streak en cas de jour manqué', usable: true,
  },
  DOUBLE_XP: {
    name: 'Boost Double XP', icon: 'flash-outline', rarity: 'rare',
    description: 'Bonus Double XP sur tes séances', usable: true,
  },
  SUPER_STREAK_FREEZE: {
    name: 'Super-Gel de Streak', icon: 'snow-outline', rarity: 'epic',
    description: 'Recharge instantanément tes 3 slots de gels', usable: true,
  },
  TRIPLE_XP: {
    name: 'Boost Triple XP', icon: 'flame', rarity: 'epic',
    description: 'Bonus Triple XP sur tes séances', usable: true,
  },
  LEVEL_COUPON: {
    name: 'Coupon de Niveau', icon: 'ticket', rarity: 'legendary',
    description: 'Passe instantanément au niveau supérieur', usable: true,
  },
  QUINTUPLE_XP: {
    name: 'Boost Quintuple XP', icon: 'rocket', rarity: 'legendary',
    description: 'Bonus Quintuple XP sur tes séances', usable: true,
  },
  CHEST_KEY: {
    name: 'Coffre', icon: 'cube', rarity: 'common',
    description: 'Un coffre à ouvrir, que contient-il ?', usable: false,
  },
  PROFILE_FRAME_BLOOD_BOND: {
    name: 'Cadre "Lien de Sang"', icon: 'shield', rarity: 'unique',
    description: "Cosmétique Unique (niveau d'amitié 5). Introuvable en coffre.",
    usable: false, claimable: true,
  },
  FRAME_COLOR_BLOOD_SANG: {
    name: 'Couleur "Rouge Sang"', icon: 'color-palette', rarity: 'unique',
    description: "Cosmétique Unique (streak de groupe 30 jours à 5). Introuvable en coffre.",
    usable: false, claimable: true,
  },
  THEME_UNLOCK_BLOOD_SANG: {
    name: 'Thème "Rouge Sang"', icon: 'color-wand', rarity: 'unique',
    description: "Cosmétique Unique (100 coffres ouverts). Introuvable en coffre.",
    usable: false, claimable: true,
  },
};

// Couleurs par rareté — alignées sur la palette du jeu (theme.js).
// unique = Rouge Sang premium (voir Colors.uniqueBlood*), pas or : distingue
// visuellement le palier ultime de tout ce qui est légendaire/doré.
export const RARITY_META = {
  common:    { label: 'Commun',     color: '#9AA0AE' },
  rare:      { label: 'Rare',       color: '#3B82F6' },
  epic:      { label: 'Épique',     color: '#A855F7' },
  legendary: { label: 'Légendaire', color: '#FE7439' },
  unique:    { label: 'Unique',     color: Colors.uniqueBlood, gradient: [Colors.uniqueBloodBright, Colors.uniqueBlood, Colors.uniqueBloodDeep], glow: Colors.uniqueBloodGlow },
};

export async function openChest() {
  const res = await API.post('/inventory/chest/open');
  return res.data;
}

export async function useItem(itemType) {
  const res = await API.post('/inventory/item/use', { itemType });
  return res.data;
}

// Réclame un cosmétique Unique en attente (consomme l'item d'inventaire,
// débloque définitivement le cosmétique et l'équipe automatiquement côté
// backend). Voir back/controllers/inventory.controller.js → claimUniqueItem.
export async function claimUniqueItem(itemType) {
  const res = await API.post('/inventory/claim', { itemType });
  return res.data;
}
