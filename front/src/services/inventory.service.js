import API from '../api/api';
import { Colors } from '../constants/theme';

// ─── Inventaire & Coffres (Brique II) ─────────────────────────────────────────

// Catalogue d'affichage — miroir du backend (User.js enum + chest.service.js).
// Source de vérité des effets : le backend. Ceci ne sert qu'à l'UI.
// icon = nom Ionicons (pas d'emoji — cohérence avec le reste du design system).
export const ITEM_CATALOG = {
  ENERGY_DRINK: {
    name: 'Boisson énergisante', icon: 'flash', rarity: 'common',
    description: 'Te donne 150 XP tout de suite.', effect: '+150 XP', usable: true,
  },
  STREAK_FREEZE: {
    name: 'Gel de streak', icon: 'snow', rarity: 'rare',
    description: 'Charge 1 gel (3 maximum). Un gel sauve ta série si tu manques un jour.', effect: '+1 gel', usable: true, gel: true,
  },
  DOUBLE_XP: {
    name: 'Fiole d\'XP', icon: 'flask-outline', rarity: 'rare',
    description: 'Te donne 200 XP tout de suite.', effect: '+200 XP', usable: true,
  },
  SUPER_STREAK_FREEZE: {
    name: 'Super-gel de streak', icon: 'snow-outline', rarity: 'epic',
    description: 'Remplit d\'un coup tes 3 emplacements de gel.', effect: 'Gels au maximum', usable: true, gel: true,
  },
  TRIPLE_XP: {
    name: 'Élixir d\'XP', icon: 'flame', rarity: 'epic',
    description: 'Te donne 300 XP tout de suite.', effect: '+300 XP', usable: true,
  },
  LEVEL_COUPON: {
    name: 'Coupon de niveau', icon: 'ticket', rarity: 'legendary',
    description: 'Te fait passer directement au niveau suivant.', effect: '+1 niveau', usable: true,
  },
  QUINTUPLE_XP: {
    name: 'Météore d\'XP', icon: 'rocket', rarity: 'legendary',
    description: 'Te donne 500 XP tout de suite.', effect: '+500 XP', usable: true,
  },
  CHEST_KEY: {
    name: 'Coffre', icon: 'cube', rarity: 'common',
    description: 'Contient un objet tiré au hasard.', usable: false,
  },
  PROFILE_FRAME_BLOOD_BOND: {
    name: 'Cadre Croc de Dragon', icon: 'shield', rarity: 'unique',
    description: "Cadre unique, obtenu en atteignant le niveau d'amitié 5. Introuvable en coffre.",
    usable: false, claimable: true,
  },
  FRAME_COLOR_BLOOD_SANG: {
    name: 'Couleur Rouge Sang', icon: 'color-palette', rarity: 'unique',
    description: "Couleur de cadre unique, obtenue avec une streak de groupe de 30 jours à 5. Introuvable en coffre.",
    usable: false, claimable: true,
  },
  THEME_UNLOCK_BLOOD_SANG: {
    name: 'Thème Rouge Sang', icon: 'color-wand', rarity: 'unique',
    description: "Thème de profil unique, obtenu après 100 coffres ouverts. Introuvable en coffre.",
    usable: false, claimable: true,
  },
};

// Couleurs par rareté — alignées sur la palette du jeu (theme.js).
// unique = Rouge Sang premium (voir Colors.uniqueBlood*), pas or : distingue
// visuellement le palier ultime de tout ce qui est légendaire/doré.
// Chances de tirage d'un coffre (miroir de back/services/chest.service.js),
// affichées dans l'inventaire par transparence.
export const CHEST_ODDS = [
  { rarity: 'common', pct: 60 },
  { rarity: 'rare', pct: 25 },
  { rarity: 'epic', pct: 12 },
  { rarity: 'legendary', pct: 3 },
];
// Minutes de séance cumulées pour gagner un coffre (back : CHEST_MINUTES_THRESHOLD).
export const CHEST_MINUTES = 120;

export const RARITY_META = {
  common:    { label: 'Commun',     color: '#9AA0AE' },
  rare:      { label: 'Rare',       color: '#3B82F6' },
  epic:      { label: 'Épique',     color: '#A855F7' },
  legendary: { label: 'Légendaire', color: '#FE7439' },
  // text : teinte lisible sur fond sombre (le rouge sang de base est trop foncé)
  unique:    { label: 'Unique',     color: Colors.uniqueBlood, text: Colors.uniqueBloodBright, gradient: [Colors.uniqueBloodBright, Colors.uniqueBlood, Colors.uniqueBloodDeep], glow: Colors.uniqueBloodGlow },
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
