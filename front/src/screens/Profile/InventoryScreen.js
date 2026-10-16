import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Animated,
} from 'react-native';
import { ConfirmModal } from '../../components/common';
import ChestGlyph from '../../components/inventory/ChestGlyph';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { COLOR_DEFS } from '../../components/profile/AvatarFrame';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useUser } from '../../context/UserContext';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { useToast } from '../../context/ToastContext';
import { openChest, useItem, claimUniqueItem, ITEM_CATALOG, RARITY_META, CHEST_ODDS, CHEST_MINUTES } from '../../services';
import { xpForLevel, xpToLevel } from '../../services';
import { useAvatarFrame } from '../../hooks';
import { useDevSettings } from '../../hooks';
import ChestOpeningModal from '../../components/inventory/ChestOpeningModal';
import { haptics } from '../../services';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';
import { getErrorMessage } from '../../utils/errorMessages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonGroup, Skeleton } from '../../components/common/Skeleton';

const MIN_LEVEL_FOR_CHEST = 11;
const RARITY_ORDER = ['unique', 'legendary', 'epic', 'rare', 'common'];

// Auto-équipement du cosmétique Unique juste après sa réclamation — même
// logique que l'équipement manuel (useAvatarFrame persiste en local +
// synchronise le backend ; setProfileThemeId reste une préférence locale).
// Meilleure couleur de cadre déjà débloquée par le niveau (hors Uniques).
function bestColorFor(level) {
  const owned = COLOR_DEFS.filter((c) => c.colors && !c.special && c.unlockLevel <= level);
  return owned.length ? owned[owned.length - 1].id : 'iron';
}

const CLAIM_EQUIP_ACTION = {
  // Une forme sans couleur ne s'affiche pas ("Défaut" = pas de cadre) : on
  // pose aussi la meilleure couleur disponible pour que le cadre se voie.
  PROFILE_FRAME_BLOOD_BOND: async (ctx) => {
    await ctx.selectShape('dragonfang');
    if (!ctx.colorId || ctx.colorId === 'none') await ctx.selectColor(bestColorFor(ctx.level));
  },
  FRAME_COLOR_BLOOD_SANG:   (ctx) => ctx.selectColor('bloodsang'),
  THEME_UNLOCK_BLOOD_SANG:  (ctx) => ctx.setProfileThemeId('blood_sang'),
};

// ─── InventoryScreen ──────────────────────────────────────────────────────────
// Inventaire RPG (Brique II) : coffres à ouvrir, consommables par rareté,
// cosmétiques Uniques. Chaque carte entre en scène en cascade (stagger).

export default function InventoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, loaded, refetch } = useUser();
  const { addBonusXp, totalXP } = useWorkoutLogs();
  const { showToast } = useToast();
  const { colorId, selectShape, selectColor } = useAvatarFrame();
  const { setProfileThemeId } = useDevSettings();

  const [busy, setBusy]         = useState(false);
  const [chestModal, setChestModal] = useState({ visible: false, drawnItem: null });
  const [pendingUse, setPendingUse] = useState(null); // itemType à confirmer

  // ─── Tutorial (chapitre Inventaire) ──────────────────────────────────────────
  const { pendingChapterId, activeChapterId, startChapter } = useTutorial();
  const { ref: chestRef, onLayout: onChestLayout, remeasure: rChest } = useTutorialTarget('inventory_chest');

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  useFocusEffect(
    useCallback(() => {
      if (pendingChapterId !== 'inventory') return;
      // ProfileStack (@react-navigation/stack) glisse cet écran depuis la
      // droite : mesurer la cible pendant la transition capture sa position
      // mi-glissement → spotlight décalé à droite, hors-cadre. On attend la
      // fin RÉELLE de la transition (transitionEnd) avant de re-mesurer et de
      // démarrer le chapitre ; le setTimeout reste un filet de sécurité si
      // l'event ne se déclenche pas (écran déjà stable, pas de transition).
      let started = false;
      const launch = () => {
        if (started) return;
        started = true;
        rChest();
        setTimeout(() => startChapter('inventory'), 50);
      };
      const unsub = navigation.addListener('transitionEnd', launch);
      const t = setTimeout(launch, 500);
      return () => { unsub(); clearTimeout(t); };
    }, [pendingChapterId, startChapter, navigation, rChest]),
  );

  const inventory = user?.inventory ?? [];
  const chestEntry = inventory.find((i) => i.itemType === 'CHEST_KEY');
  const chestCount = chestEntry?.quantity ?? 0;
  const level      = user?.level ?? 1;
  const chestLocked = level < MIN_LEVEL_FOR_CHEST;
  const gels       = user?.streakGels ?? 0;
  const minutesToward = (user?.totalWorkoutMinutes ?? 0) % CHEST_MINUTES;

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
        setChestModal({ visible: true, drawnItem: res.drawnItem });
        refetch();
      }
    } catch (error) {
      if (error.isSessionExpired) return;
      showToast(getErrorMessage(error, 'Le coffre n\'a pas pu être ouvert. Réessaie dans un instant.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUseItem = async (itemType) => {
    if (busy) return;
    setBusy(true);
    const beforeXp    = user?.xp ?? 0;
    const beforeLevel = user?.level ?? 1;
    const meta = ITEM_CATALOG[itemType] ?? {};
    try {
      const res = await useItem(itemType);
      if (res.success) {
        haptics.success();
        showToast(`${meta.name ?? itemType} utilisé${meta.effect ? ` : ${meta.effect}` : ''}.`, 'success');
        refetch();

        // Le Profil affiche un niveau/XP calculé localement (logs de séances),
        // distinct du user.xp backend. On pousse un log de synchronisation pour
        // que l'usage d'un objet se reflète immédiatement sur le Profil/Accueil.
        const xpGained = (res.user?.xp ?? beforeXp) - beforeXp;
        const itemLabel = `Objet : ${meta.name ?? itemType}`;
        if (xpGained > 0) {
          addBonusXp(itemLabel, xpGained);
        } else if ((res.user?.level ?? beforeLevel) > beforeLevel) {
          // LEVEL_COUPON : pas de gain d'XP direct, on pousse localement de quoi
          // franchir le prochain palier pour que le niveau affiché suive.
          const needed = xpForLevel(xpToLevel(totalXP).level + 1) - totalXP;
          if (needed > 0) addBonusXp(itemLabel, needed);
        }
      }
    } catch (error) {
      if (error.isSessionExpired) return;
      showToast(getErrorMessage(error, 'L\'objet n\'a pas pu être utilisé. Réessaie dans un instant.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Réclame un cosmétique Unique (cadre/couleur/thème) : consomme l'item côté
  // backend, débloque définitivement le cosmétique, puis l'équipe/sélectionne
  // aussitôt côté front pour un retour immédiat.
  const handleClaimItem = async (itemType) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await claimUniqueItem(itemType);
      if (res.success) {
        haptics.heavy();
        showToast(`${ITEM_CATALOG[itemType]?.name ?? itemType} débloqué et équipé.`, 'success');
        const equip = CLAIM_EQUIP_ACTION[itemType];
        if (equip) await equip({ selectShape, selectColor, setProfileThemeId, colorId, level: user?.level ?? 1 });
        refetch();
      }
    } catch (error) {
      if (error.isSessionExpired) return;
      showToast(getErrorMessage(error, 'Le cosmétique n\'a pas pu être débloqué. Réessaie dans un instant.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const closeChestModal = () => {
    setChestModal({ visible: false, drawnItem: null });
    refetch();
  };

  const openAnother = () => {
    setChestModal({ visible: false, drawnItem: null });
    handleOpenChest();
  };

  const pendingMeta = pendingUse ? ITEM_CATALOG[pendingUse] : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity accessibilityLabel="Retour" accessibilityRole="button" style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Inventaire</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Coffres ── */}
        {/* marginTop porté par le wrapper (et non la carte) pour que le
            spotlight du tutoriel épouse pile la carte, sans décalage vertical. */}
        <View ref={chestRef} onLayout={onChestLayout} collapsable={false} style={styles.chestSpot}>
          {user ? (
            <ChestCard
              count={chestCount}
              locked={chestLocked}
              busy={busy}
              minutesToward={minutesToward}
              onOpen={handleOpenChest}
            />
          ) : !loaded ? (
            <SkeletonGroup style={styles.skeletonChest} label="Chargement de ton inventaire">
              <View style={styles.skeletonChestTop}>
                <Skeleton w={64} h={64} r={16} />
                <View style={{ flex: 1, gap: 10 }}>
                  <Skeleton w="60%" h={16} r={6} />
                  <Skeleton w="85%" h={11} />
                </View>
              </View>
              <Skeleton h={52} r={14} />
            </SkeletonGroup>
          ) : (
            <View style={styles.loadError} accessibilityRole="alert">
              <Ionicons name="cloud-offline-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Ton inventaire n'a pas pu être chargé</Text>
              <Text style={styles.emptyTxt}>Vérifie ta connexion, puis réessaie. Tes objets sont en sécurité.</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.retryBtn} onPress={refetch} activeOpacity={0.85}>
                <Text style={styles.retryTxt}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Objets ── */}
        {user ? (<>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Mes objets</Text>
          <View style={styles.gelChip} accessible accessibilityLabel={`Gels de streak chargés : ${gels} sur 3`}>
            <Ionicons name="snow" size={14} color="#60A5FA" />
            <Text style={styles.gelTxt}>Gels {gels}/3</Text>
          </View>
        </View>
        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="bag-outline" size={32} color={Colors.textMuted} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>Ton sac est vide</Text>
            <Text style={styles.emptyTxt}>Ouvre des coffres pour obtenir des objets : XP, gels de streak, coupons de niveau.</Text>
          </View>
        ) : (
          items.map((entry, index) => (
            <StaggeredItemCard
              key={entry.itemType}
              entry={entry}
              index={index}
              busy={busy}
              gelsFull={gels >= 3}
              onUse={() => setPendingUse(entry.itemType)}
              onClaim={() => handleClaimItem(entry.itemType)}
            />
          ))
        )}
        </>) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ChestOpeningModal
        visible={chestModal.visible}
        drawnItem={chestModal.drawnItem}
        chestsLeft={chestCount}
        onClose={closeChestModal}
        onOpenAnother={openAnother}
      />

      <ConfirmModal
        visible={!!pendingUse}
        icon={pendingMeta?.icon || 'cube-outline'}
        title={`Utiliser ${pendingMeta?.name ?? ''} ?`}
        body={pendingMeta ? `${pendingMeta.description} L'objet sera consommé.` : ''}
        confirmLabel="Utiliser"
        onConfirm={() => { const t = pendingUse; setPendingUse(null); handleUseItem(t); }}
        onCancel={() => setPendingUse(null)}
      />

      {activeChapterId === 'inventory' && (
        <TutorialOverlay navigation={navigation} />
      )}
    </View>
  );
}

// ─── Carte coffre ─────────────────────────────────────────────────────────────

function ChestCard({ count, locked, busy, minutesToward, onOpen }) {
  const reduced = useReducedMotion();
  const float = useRef(new Animated.Value(0)).current;
  const canOpen = !locked && count > 0 && !busy;

  // Flottement léger uniquement quand un coffre attend d'être ouvert.
  useEffect(() => {
    if (!canOpen || reduced) { float.setValue(0); return undefined; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -4, duration: 1400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0,  duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [canOpen, reduced, float]);

  const pct = Math.min(1, minutesToward / CHEST_MINUTES);
  const title = locked
    ? 'Coffres verrouillés'
    : count > 0 ? `${count} coffre${count > 1 ? 's' : ''} à ouvrir` : 'Aucun coffre pour l\'instant';

  return (
    <View style={[styles.chestCard, locked && styles.chestCardLocked]}>
      <View style={styles.chestTop}>
        <Animated.View style={{ transform: [{ translateY: float }] }}>
          <ChestGlyph size={68} dimmed={locked || count === 0} />
        </Animated.View>
        <View style={styles.chestInfo}>
          <Text style={styles.chestTitle}>{title}</Text>
          <Text style={styles.chestSub}>
            {locked
              ? `Atteins le niveau ${MIN_LEVEL_FOR_CHEST} pour gagner et ouvrir des coffres.`
              : `Un coffre toutes les ${CHEST_MINUTES / 60} h de séance cumulées.`}
          </Text>
        </View>
      </View>

      {!locked ? (
        <View style={styles.progressBlock} accessible accessibilityLabel={`${minutesToward} minutes sur ${CHEST_MINUTES} avant le prochain coffre`}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
          </View>
          <Text style={styles.progressTxt}>{minutesToward} / {CHEST_MINUTES} min avant le prochain</Text>
        </View>
      ) : null}

      <TouchableOpacity accessibilityRole="button"
        accessibilityState={{ disabled: !canOpen, busy }}
        style={[styles.openBtn, !canOpen && styles.openBtnDisabled]}
        onPress={onOpen}
        disabled={!canOpen}
        activeOpacity={0.85}
      >
        {busy
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={[styles.openBtnTxt, !canOpen && styles.openBtnTxtDisabled]}>Ouvrir un coffre</Text>}
      </TouchableOpacity>

      <View style={styles.oddsRow} accessible accessibilityLabel={`Chances : ${CHEST_ODDS.map((o) => `${RARITY_META[o.rarity].label} ${o.pct} %`).join(', ')}`}>
        {CHEST_ODDS.map((o) => (
          <View key={o.rarity} style={styles.oddsItem}>
            <View style={[styles.oddsDot, { backgroundColor: RARITY_META[o.rarity].color }]} />
            <Text style={styles.oddsTxt}>{RARITY_META[o.rarity].label} {o.pct} %</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Carte item avec entrée en cascade ───────────────────────────────────────

function StaggeredItemCard({ entry, index, busy, gelsFull, onUse, onClaim }) {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 280, delay: Math.min(index, 6) * 60, useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta   = ITEM_CATALOG[entry.itemType] ?? {};
  const rarity = RARITY_META[entry.rarity] ?? RARITY_META.common;
  const tone   = rarity.text || rarity.color;
  const blocked = meta.gel && gelsFull;

  return (
    <Animated.View
      style={[
        styles.itemCard,
        { borderColor: `${rarity.color}55` },
        {
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 12, 0] }) }],
        },
      ]}
    >
      <View style={styles.itemTop}>
        <View style={[styles.itemIconBox, { backgroundColor: `${rarity.color}1F` }]}>
          <Ionicons name={meta.icon ?? 'help-circle-outline'} size={24} color={tone} />
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemName}>{meta.name ?? entry.itemType}</Text>
            {entry.quantity > 1 && <Text style={styles.itemQty}>×{entry.quantity}</Text>}
          </View>
          <Text style={[styles.itemRarity, { color: tone }]}>{rarity.label}</Text>
          <Text style={styles.itemDesc}>{meta.description}</Text>
          {blocked ? <Text style={styles.itemBlocked}>Tes 3 gels sont déjà chargés.</Text> : null}
        </View>
      </View>

      {meta.usable && (
        <TouchableOpacity accessibilityRole="button"
          accessibilityLabel={`Utiliser ${meta.name ?? ''}`}
          accessibilityState={{ disabled: busy || blocked }}
          style={[styles.useBtn, { borderColor: `${rarity.color}80` }, (busy || blocked) && styles.btnDisabled]}
          onPress={onUse}
          disabled={busy || blocked}
          activeOpacity={0.8}
        >
          <Text style={[styles.useBtnTxt, { color: tone }]}>Utiliser</Text>
        </TouchableOpacity>
      )}

      {meta.claimable && (
        <TouchableOpacity accessibilityRole="button"
          accessibilityLabel={`Débloquer ${meta.name ?? ''}`}
          style={[styles.useBtn, { borderColor: tone, backgroundColor: `${rarity.color}26` }, busy && styles.btnDisabled]}
          onPress={onClaim}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text style={[styles.useBtnTxt, { color: tone }]}>Débloquer et équiper</Text>
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
    paddingBottom:  10,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.glassBg, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: 16 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10 },
  sectionLabel: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: '800',
    letterSpacing: 0.8, textTransform: 'uppercase', marginLeft: 4,
  },
  gelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)',
  },
  gelTxt: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // ── Coffre ──
  chestSpot: { marginTop: 4 },
  chestCard: {
    backgroundColor: Colors.cardDeep,
    borderWidth:     1,
    borderColor:     'rgba(232,176,74,0.35)',
    borderRadius:    20,
    padding:         16,
  },
  chestCardLocked: { borderColor: Colors.glassBorder },
  chestTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chestInfo:  { flex: 1 },
  chestTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 3 },
  chestSub:   { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  progressBlock: { marginTop: 14 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#E8B04A' },
  progressTxt: { color: Colors.textSecondary, fontSize: 12, marginTop: 6, fontVariant: ['tabular-nums'] },
  openBtn: {
    marginTop: 14,
    backgroundColor:  Colors.primary,
    borderRadius:     14,
    minHeight:        50,
    justifyContent:   'center',
    alignItems:       'center',
  },
  openBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  openBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  openBtnTxtDisabled: { color: Colors.textMuted },
  oddsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 4, marginTop: 12 },
  oddsItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  oddsDot: { width: 7, height: 7, borderRadius: 4 },
  oddsTxt: { color: Colors.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },

  // ── Items ──
  itemCard: {
    backgroundColor: Colors.cardDeep,
    borderWidth:     1,
    borderRadius:    16,
    padding:         14,
    marginBottom:    10,
  },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start' },
  itemIconBox: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  itemInfo:  { flex: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemName:  { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  itemQty:   { color: Colors.textSecondary, fontSize: 14, fontWeight: '800' },
  itemRarity:{ fontSize: 12, fontWeight: '800', marginTop: 1, marginBottom: 4 },
  itemDesc:  { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  itemBlocked: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  useBtn: {
    marginTop: 12,
    borderWidth:      1,
    borderRadius:     12,
    minHeight:        44,
    justifyContent:   'center',
    alignItems:       'center',
  },
  btnDisabled: { opacity: 0.4 },
  useBtnTxt: { fontSize: 14, fontWeight: '800' },

  // ── Vide ──
  emptyBox: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  skeletonChest: {
    gap: 18, padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', backgroundColor: Colors.cardDeep,
  },
  skeletonChestTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  loadError: {
    alignItems: 'center', gap: 6, paddingVertical: 28, paddingHorizontal: 20, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: Colors.cardDeep,
  },
  retryBtn: {
    marginTop: 12, minHeight: 44, paddingHorizontal: 22, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary,
  },
  retryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  emptyTxt: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
