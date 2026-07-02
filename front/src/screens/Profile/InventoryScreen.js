import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import { openChest, useItem, ITEM_CATALOG, RARITY_META } from '../../services/inventory.service';
import ChestOpeningModal from '../../components/inventory/ChestOpeningModal';

const MIN_LEVEL_FOR_CHEST = 11;
const RARITY_ORDER = ['unique', 'legendary', 'epic', 'rare', 'common'];

// ─── InventoryScreen ──────────────────────────────────────────────────────────
// Inventaire RPG (Brique II) : coffres à ouvrir, consommables par rareté,
// cosmétiques Uniques. Chaque carte entre en scène en cascade (stagger).

export default function InventoryScreen({ navigation }) {
  const { user, refetch } = useUser();
  const { showToast } = useToast();

  const [busy, setBusy]         = useState(false);
  const [chestModal, setChestModal] = useState({ visible: false, drawnItem: null });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const inventory = user?.inventory ?? [];
  const chestEntry = inventory.find((i) => i.itemType === 'CHEST_KEY');
  const chestCount = chestEntry?.quantity ?? 0;
  const level      = user?.level ?? 1;
  const chestLocked = level < MIN_LEVEL_FOR_CHEST;

  // Items hors coffres, groupés par rareté (ordre : unique → commun)
  const items = inventory
    .filter((i) => i.itemType !== 'CHEST_KEY' && i.quantity > 0)
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

  const handleOpenChest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await openChest();
      if (res.success) {
        // La modale joue l'animation (shake → burst → reveal)
        setChestModal({ visible: true, drawnItem: res.drawnItem });
      }
    } catch (error) {
      if (error.isSessionExpired) return;
      showToast(error.data?.message || 'Impossible d\'ouvrir le coffre.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUseItem = async (itemType) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await useItem(itemType);
      if (res.success) {
        showToast(`${ITEM_CATALOG[itemType]?.name ?? itemType} utilisé ! ✨`, 'success');
        refetch();
      }
    } catch (error) {
      if (error.isSessionExpired) return;
      showToast(error.data?.message || 'Impossible d\'utiliser cet objet.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const closeChestModal = () => {
    setChestModal({ visible: false, drawnItem: null });
    refetch();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventaire</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Coffres ── */}
        <ChestCard
          count={chestCount}
          locked={chestLocked}
          busy={busy}
          onOpen={handleOpenChest}
        />

        {/* ── Objets ── */}
        <Text style={styles.sectionLabel}>MES OBJETS</Text>
        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🎒</Text>
            <Text style={styles.emptyTxt}>
              Ton sac est vide.{'\n'}Enchaîne les séances pour gagner des coffres !
            </Text>
          </View>
        ) : (
          items.map((entry, index) => (
            <StaggeredItemCard
              key={entry.itemType}
              entry={entry}
              index={index}
              busy={busy}
              onUse={() => handleUseItem(entry.itemType)}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ChestOpeningModal
        visible={chestModal.visible}
        drawnItem={chestModal.drawnItem}
        onClose={closeChestModal}
      />
    </View>
  );
}

// ─── Carte coffre avec flottement continu ────────────────────────────────────

function ChestCard({ count, locked, busy, onOpen }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -6, duration: 1400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0,  duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canOpen = !locked && count > 0 && !busy;

  return (
    <View style={[styles.chestCard, locked && styles.chestCardLocked]}>
      <Animated.Text style={[styles.chestEmoji, { transform: [{ translateY: float }] }]}>
        {locked ? '🔒' : '📦'}
      </Animated.Text>

      <View style={styles.chestInfo}>
        <Text style={styles.chestTitle}>
          {locked ? 'Coffres verrouillés' : `${count} coffre${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}`}
        </Text>
        <Text style={styles.chestSub}>
          {locked
            ? `Atteins le niveau ${MIN_LEVEL_FOR_CHEST} (Rang Initié) pour les débloquer.`
            : 'Cumule 5 h de séance pour gagner un coffre.'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.openBtn, !canOpen && styles.openBtnDisabled]}
        onPress={onOpen}
        disabled={!canOpen}
        activeOpacity={0.85}
      >
        {busy
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.openBtnTxt}>Ouvrir</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Carte item avec entrée en cascade ───────────────────────────────────────

function StaggeredItemCard({ entry, index, busy, onUse }) {
  const slide = useRef(new Animated.Value(24)).current;
  const fade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0, duration: 320, delay: index * 70, useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1, duration: 320, delay: index * 70, useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta   = ITEM_CATALOG[entry.itemType] ?? {};
  const rarity = RARITY_META[entry.rarity] ?? RARITY_META.common;

  return (
    <Animated.View
      style={[styles.itemCard, {
        borderColor: `${rarity.color}55`,
        opacity: fade,
        transform: [{ translateY: slide }],
      }]}
    >
      <View style={[styles.itemIconBox, { backgroundColor: `${rarity.color}18` }]}>
        <Text style={styles.itemEmoji}>{meta.emoji ?? '❔'}</Text>
      </View>

      <View style={styles.itemInfo}>
        <View style={styles.itemNameRow}>
          <Text style={styles.itemName}>{meta.name ?? entry.itemType}</Text>
          {entry.quantity > 1 && <Text style={styles.itemQty}>×{entry.quantity}</Text>}
        </View>
        <Text style={[styles.itemRarity, { color: rarity.color }]}>{rarity.label}</Text>
        <Text style={styles.itemDesc} numberOfLines={2}>{meta.description}</Text>
      </View>

      {meta.usable && (
        <TouchableOpacity
          style={[styles.useBtn, { borderColor: rarity.color }, busy && { opacity: 0.4 }]}
          onPress={onUse}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text style={[styles.useBtnTxt, { color: rarity.color }]}>Utiliser</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgAbyss },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop:     54,
    paddingBottom:  14,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  content: { paddingHorizontal: 16 },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 26, marginBottom: 10, marginLeft: 4,
  },

  // ── Coffre ──
  chestCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(254,116,57,0.07)',
    borderWidth:     1,
    borderColor:     'rgba(254,116,57,0.30)',
    borderRadius:    18,
    padding:         18,
    marginTop:       8,
  },
  chestCardLocked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor:     'rgba(255,255,255,0.09)',
  },
  chestEmoji: { fontSize: 40, marginRight: 14 },
  chestInfo:  { flex: 1, marginRight: 10 },
  chestTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 3 },
  chestSub:   { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  openBtn: {
    backgroundColor:  Colors.primary,
    borderRadius:     11,
    paddingHorizontal: 18,
    height:           40,
    justifyContent:   'center',
    alignItems:       'center',
  },
  openBtnDisabled: { opacity: 0.35 },
  openBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // ── Items ──
  itemCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.cardDeep,
    borderWidth:     1,
    borderRadius:    16,
    padding:         14,
    marginBottom:    10,
  },
  itemIconBox: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  itemEmoji: { fontSize: 26 },
  itemInfo:  { flex: 1, marginRight: 10 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemName:  { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  itemQty:   { color: Colors.textSecondary, fontSize: 13, fontWeight: '800' },
  itemRarity:{ fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 1, marginBottom: 3 },
  itemDesc:  { color: Colors.textMuted, fontSize: 11.5, lineHeight: 16 },
  useBtn: {
    borderWidth:      1,
    borderRadius:     10,
    paddingHorizontal: 13,
    height:           34,
    justifyContent:   'center',
  },
  useBtnTxt: { fontSize: 12, fontWeight: '800' },

  // ── Vide ──
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTxt: { color: Colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
