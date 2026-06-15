import { StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

export const globalStyles = StyleSheet.create({
  // ── Conteneurs ────────────────────────────────────────────────────────────
  safeDeep: {
    flex: 1,
    backgroundColor: Colors.backgroundDeep,
  },
  safeAbyss: {
    flex: 1,
    backgroundColor: Colors.bgAbyss,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // ── Mise en page ──────────────────────────────────────────────────────────
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex1: { flex: 1 },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    padding: 16,
  },
  cardLegacy: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  glassCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 18,
    overflow: 'hidden',
  },

  // ── Typographie ───────────────────────────────────────────────────────────
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  sectionLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionLinkText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Boutons ───────────────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  ghostBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: 'transparent',
  },
  ghostBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Écrans vides ──────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
