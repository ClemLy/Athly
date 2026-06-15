export const Colors = {
  // ── Fonds ──────────────────────────────────────────────────────────────────
  background:     '#101015',   // écrans Workouts / ExerciseDetail (héritage)
  backgroundDeep: '#0D1018',   // Home / Profile / Stats / Modals
  bgAbyss:        '#080910',   // fond le plus profond (ProfileScreen, navigation)
  bgDeep2:        '#13131C',   // modaux profonds, BorderPicker

  // ── Cards ──────────────────────────────────────────────────────────────────
  card:      '#1c1c22',   // cards WorkoutList / legacy
  cardDeep:  '#16161F',   // cards Home / Stats
  cardInner: '#0e0e12',   // boîtes d'icônes (iconBox), fond très sombre
  modalBg:   '#14141E',   // fond des modals de confirmation

  // ── Séparateurs & Bordures ─────────────────────────────────────────────────
  separator:    '#2A2A39',   // séparateurs horizontaux
  borderSubtle: '#1f1f27',   // bordures discrètes (headers, sections workout)
  borderDim:    '#3a3a50',   // bordures atténuées (checkboxes, états non sélectionnés)

  // ── Glassmorphisme (ProfileScreen) ─────────────────────────────────────────
  glassBg:     'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.09)',

  // ── Texte ──────────────────────────────────────────────────────────────────
  textPrimary:   '#FFFFFF',
  textSecondary: '#9AA0AE',
  textMuted:     '#6D7382',
  textDim:       '#8B95A3',   // labels de colonnes, sous-textes très atténués

  // ── Accents principaux ─────────────────────────────────────────────────────
  primary:         '#FE7439',   // CTA orange Athly
  muscle:          '#FF6B35',   // variante muscle
  secondaryAccent: '#6E6AF0',   // violet niveaux / badges

  // ── Accents rang & gamification ────────────────────────────────────────────
  gold:         '#FFD700',   // rang God / trophées spéciaux / tutorial
  legendAccent: '#C084FC',   // rang Legend (lilas clair)
  rankPurple:   '#A855F7',   // rang Master / Grandmaster
  rankViolet:   '#8B5CF6',   // rang Elite
  warningAmber: '#F59E0B',   // états d'avertissement (auth)

  // ── Feedback ───────────────────────────────────────────────────────────────
  valid:   '#22C55E',   // sets / exercices validés (vert chaud)
  success: '#44FF88',   // XP / gains (vert néon)
  error:   '#FF4D4D',

  // ── Utilitaires ────────────────────────────────────────────────────────────
  chevron: '#888888',
  modal:   '#1E1E29',
};

// Couleurs par groupe musculaire (pie chart, légendes, heatmap).
export const MUSCLE_GROUP_COLORS = {
  pectoraux: '#FE7439',
  dos:       '#3B82F6',
  epaules:   '#FBBF24',
  bras:      '#A855F7',
  jambes:    '#22C55E',
  abdos:     '#EC4899',
  other:     '#6B7280',
};
