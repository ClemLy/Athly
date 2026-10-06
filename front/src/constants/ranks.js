import { Colors } from './theme';

// ─── Données des rangs ────────────────────────────────────────────────────────

export const RANKS = [
  {
    name: 'Novice',
    levelRange: '0 à 10',
    minLevel: 0,
    maxLevel: 10,
    color: Colors.primary,
    gradientColors: ['#431A08', '#7C2D12'],
    frameId: 'none',
    perks: [
      'Suivi complet des séances et de l\'historique',
      'Statistiques globales (volume, sets, calendrier)',
      'Heatmap d\'activité sur 12 mois glissants',
      'Records personnels (poids max, volume, 1RM estimé)',
    ],
    icon: 'fitness',
  },
  {
    name: 'Initié',
    levelRange: '11 à 30',
    minLevel: 11,
    maxLevel: 30,
    color: '#FBBF24',
    gradientColors: ['#451A03', '#78350F'],
    frameId: 'bronze',
    perks: [
      'Cadre Bronze débloqué (Niv. 11)',
      'Forme Hexagone débloquée (Niv. 11)',
      'Inventaire débloqué : coffres à ouvrir en cumulant tes séances',
    ],
    icon: 'ribbon',
  },
  {
    name: 'Athlète',
    levelRange: '31 à 50',
    minLevel: 31,
    maxLevel: 50,
    color: Colors.valid,
    gradientColors: ['#052E16', '#14532D'],
    frameId: 'silver',
    perks: [
      'Cadre Argent débloqué (Niv. 31)',
      'Forme Octogone débloquée (Niv. 31)',
    ],
    icon: 'barbell',
  },
  {
    name: 'Compétiteur',
    levelRange: '51 à 70',
    minLevel: 51,
    maxLevel: 70,
    color: '#3B82F6',
    gradientColors: ['#1E3A5F', '#1E3A8A'],
    frameId: 'sapphire',
    perks: [
      'Cadre Saphir débloqué (Niv. 51)',
      'Forme Bouclier débloquée (Niv. 51)',
      'Statistiques avancées par exercice',
    ],
    icon: 'trophy',
  },
  {
    name: 'Warrior',
    levelRange: '71 à 90',
    minLevel: 71,
    maxLevel: 90,
    color: Colors.secondaryAccent,
    gradientColors: ['#1E1B4B', '#2E2A7A'],
    frameId: 'warrior',
    perks: [
      'Cadre Warrior avec aura violette (Niv. 71)',
      'Forme Éclairs débloquée (Niv. 71)',
    ],
    icon: 'shield',
  },
  {
    name: 'Élite',
    levelRange: '91 à 110',
    minLevel: 91,
    maxLevel: 110,
    color: Colors.secondaryAccent,
    gradientColors: ['#0F0F1A', '#1C1C38'],
    frameId: 'elite',
    perks: [
      'Cadre Élite animé (Niv. 91)',
      'Forme Néon débloquée (Niv. 91)',
      'Fond de profil teinté Élite (Deep Abyss)',
    ],
    icon: 'star',
  },
  {
    name: 'Maître',
    levelRange: '111 à 140',
    minLevel: 111,
    maxLevel: 140,
    color: Colors.rankViolet,
    gradientColors: ['#2E1065', '#4C1D95'],
    frameId: 'master',
    perks: [
      'Cadre Maître animé améthyste (Niv. 111)',
      'Halo d\'aura intense autour du cadre',
    ],
    icon: 'flash',
  },
  {
    name: 'Grand Maître',
    levelRange: '141 à 170',
    minLevel: 141,
    maxLevel: 170,
    color: Colors.rankPurple,
    gradientColors: ['#3B0764', '#581C87'],
    frameId: 'grandmaster',
    perks: [
      'Cadre Grand Maître animé (Niv. 141)',
      'Forme Couronne débloquée (Niv. 141)',
    ],
    icon: 'sparkles',
  },
  {
    name: 'Légende',
    levelRange: '171 à 199',
    minLevel: 171,
    maxLevel: 199,
    color: Colors.legendAccent,
    gradientColors: ['#4A044E', '#701A75'],
    frameId: 'legend',
    perks: [
      'Cadre Légende animé fuchsia (Niv. 171)',
      'Forme Ailes débloquée (Niv. 171)',
      'Braises ascendantes animées sur le profil',
      'Fond Légende profond (violet abyssal)',
      'Reflet scintillant permanent sur le pseudo',
    ],
    icon: 'planet',
  },
  {
    name: 'ATHLY GOD',
    levelRange: 'Niv. 200',
    minLevel: 200,
    maxLevel: 200,
    color: Colors.gold,
    gradientColors: ['#431407', '#78350F'],
    frameId: 'god',
    perks: [
      'Cadre Divin Doré animé (Niv. 200)',
      'Forme Divine débloquée (Niv. 200)',
      'Braises dorées permanentes sur le profil',
      'Fond Obsidian Divin (or sur noir absolu)',
    ],
    icon: 'infinite',
  },
];

// Rang de la roadmap qui contient ce niveau.
export function getRankInfo(level) {
  const lvl = Math.max(0, Number(level) || 0);
  let found = RANKS[0];
  for (const r of RANKS) if (lvl >= r.minLevel) found = r;
  return found;
}

// Rang suivant (null au rang maximal).
export function getNextRankInfo(level) {
  const i = RANKS.indexOf(getRankInfo(level));
  return RANKS[i + 1] || null;
}
