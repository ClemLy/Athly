import { StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

// ─── modalStyles ──────────────────────────────────────────────────────────────
// Styles partagés par la famille des modales centrées (ConfirmModal, InfoModal).
// Source de vérité unique pour le rendu "carte sombre centrée + badge d'icône
// + CTA plein" — toute évolution visuelle de ces modales se fait ici, une fois.
//
// Les accents (couleur du badge, du CTA, des bordures) restent passés en inline
// par chaque modale car ils dépendent d'un état (destructive → rouge).

export const modalStyles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 24,
  },
  card: {
    width:           '100%',
    backgroundColor: Colors.bgDeep2,
    borderRadius:    22,
    borderWidth:     1,
    padding:         28,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.65,
    shadowRadius:    32,
    elevation:       20,
  },
  iconWrap: {
    width:            60,
    height:           60,
    borderRadius:     18,
    borderWidth:      1,
    justifyContent:   'center',
    alignItems:       'center',
    marginBottom:     18,
  },
  title: {
    color:          Colors.textPrimary,
    fontSize:       18,
    fontWeight:     '800',
    letterSpacing:  -0.3,
    marginBottom:   10,
    textAlign:      'center',
  },
  body: {
    color:        Colors.textSecondary,
    fontSize:     14,
    lineHeight:   21,
    textAlign:    'center',
    marginBottom: 24,
  },
  ctaBtn: {
    width:            '100%',
    height:           50,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
