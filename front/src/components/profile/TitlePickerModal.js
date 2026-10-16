import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import { getTitles, equipTitle, RARITY_META, haptics } from '../../services';
import { titleIcon } from '../../data/titleIcons';
import { SkeletonRows } from '../common/Skeleton';

// ─── TitlePickerModal ─────────────────────────────────────────────────────────
// Liste des titres : ceux débloqués s'équipent d'un tap, ceux à débloquer
// affichent directement leur condition et leur progression.
//
// Props : visible bool, onClose () => void

const RARITY_ORDER = ['unique', 'legendary', 'epic', 'rare', 'common'];
const byRarity = (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);

export default function TitlePickerModal({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [titles, setTitles] = useState([]);
  const [equippedTitleId, setEquippedTitleId] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [equippingId, setEquippingId] = useState(undefined);
  const [equipError, setEquipError] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await getTitles();
      setTitles(res.titles || []);
      setEquippedTitleId(res.equippedTitle ?? null);
      setStatus('ready');
    } catch (_) {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (visible) { setEquipError(null); load(); }
  }, [visible, load]);

  const handleSelect = useCallback(async (titleId) => {
    if (titleId === equippedTitleId || equippingId !== undefined) return;
    setEquipError(null);
    setEquippingId(titleId);
    try {
      await equipTitle(titleId);
      haptics.success();
      setEquippedTitleId(titleId);
    } catch (_) {
      setEquipError('Le titre n\'a pas pu être équipé. Vérifie ta connexion et réessaie.');
    } finally {
      setEquippingId(undefined);
    }
  }, [equippedTitleId, equippingId]);

  const unlocked = titles.filter((t) => t.unlocked).sort(byRarity);
  const locked = titles.filter((t) => !t.unlocked).sort(byRarity);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable style={s.backdrop} onPress={onClose} accessible={false} />
        <View
          accessibilityViewIsModal
          style={[s.sheet, { maxHeight: height * 0.88, paddingBottom: insets.bottom + 12 }]}
        >
          <View style={s.handle} />
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title} accessibilityRole="header">Titres</Text>
              <Text style={s.sub}>Le titre équipé s'affiche sous ton pseudo.</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={({ pressed }) => [s.closeBtn, pressed && s.pressed]}
            >
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {equipError ? (
            <View style={s.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={s.errorTxt}>{equipError}</Text>
            </View>
          ) : null}

          {status === 'loading' ? (
            <SkeletonRows count={5} avatar={34} style={s.loader} label="Chargement des titres" />
          ) : status === 'error' ? (
            <View style={s.stateBox}>
              <Text style={s.stateTxt}>Les titres n'ont pas pu être chargés.</Text>
              <Pressable onPress={load} accessibilityRole="button" style={({ pressed }) => [s.retryBtn, pressed && s.pressed]}>
                <Text style={s.retryTxt}>Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
              <Text style={s.groupLabel}>Débloqués · {unlocked.length}</Text>
              <View style={s.group}>
                <TitleRow
                  icon="remove-circle-outline"
                  label="Aucun titre"
                  meta="Rien sous ton pseudo"
                  color={Colors.textSecondary}
                  selected={equippedTitleId === null}
                  busy={equippingId === null}
                  onPress={() => handleSelect(null)}
                />
                {unlocked.map((t) => {
                  const meta = RARITY_META[t.rarity] || RARITY_META.common;
                  return (
                    <TitleRow
                      key={t.id}
                      icon={titleIcon(t.id)}
                      label={t.label}
                      meta={meta.label}
                      color={meta.text || meta.color}
                      selected={t.id === equippedTitleId}
                      busy={equippingId === t.id}
                      onPress={() => handleSelect(t.id)}
                    />
                  );
                })}
              </View>

              {locked.length > 0 ? (
                <>
                  <Text style={s.groupLabel}>À débloquer · {locked.length}</Text>
                  <View style={s.group}>
                    {locked.map((t) => <LockedRow key={t.id} title={t} />)}
                  </View>
                </>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function TitleRow({ icon, label, meta, color, selected, busy, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, busy }}
      accessibilityLabel={`${label}, ${meta}`}
      style={({ pressed }) => [s.row, selected && { backgroundColor: `${color}14` }, pressed && s.pressed]}
    >
      <View style={[s.iconBox, { backgroundColor: `${color}1F` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.rowLabel, selected && { color }]} numberOfLines={2}>{label}</Text>
        <Text style={s.rowMeta}>{meta}</Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={selected ? color : Colors.borderDim}
        />
      )}
    </Pressable>
  );
}

function LockedRow({ title }) {
  const meta = RARITY_META[title.rarity] || RARITY_META.common;
  const p = title.progress;
  const pct = p ? Math.max(0, Math.min(1, p.current / p.target)) : 0;
  return (
    <View style={s.row} accessible accessibilityLabel={`${title.label}, ${meta.label}, verrouillé. ${title.condition}`}>
      <View style={[s.iconBox, s.iconBoxLocked]}>
        <Ionicons name={titleIcon(title.id)} size={18} color={Colors.textMuted} />
      </View>
      <View style={s.rowText}>
        <View style={s.lockedHead}>
          <Text style={s.lockedLabel} numberOfLines={1}>{title.label}</Text>
          <Text style={[s.rarityTag, { color: meta.text || meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={s.condition}>{title.condition}</Text>
        {p ? (
          <View style={s.progressRow}>
            <View style={s.track}>
              <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: meta.text || meta.color }]} />
            </View>
            <Text style={s.progressTxt}>{p.current} / {p.target}</Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: {
    backgroundColor: Colors.bgDeep2,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: Colors.glassBorder,
    paddingHorizontal: 16, paddingTop: 10,
    width: '100%', maxWidth: 480, alignSelf: 'center',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, paddingHorizontal: 4 },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pressed: { opacity: 0.7 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, marginBottom: 10,
    backgroundColor: `${Colors.error}14`, borderWidth: 1, borderColor: `${Colors.error}40`,
  },
  errorTxt: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },

  loader: { marginVertical: 8 },
  stateBox: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  stateTxt: { color: Colors.textSecondary, fontSize: 14 },
  retryBtn: { minHeight: 44, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', backgroundColor: Colors.primary },
  retryTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },

  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8 },
  groupLabel: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: '800',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 8, marginBottom: 8, marginLeft: 4,
  },
  group: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: Colors.glassBorder,
    overflow: 'hidden', marginBottom: 12,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 60, paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator,
  },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconBoxLocked: { backgroundColor: 'rgba(255,255,255,0.05)' },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

  lockedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedLabel: { flexShrink: 1, color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  rarityTag: { fontSize: 12, fontWeight: '700' },
  condition: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  progressTxt: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
