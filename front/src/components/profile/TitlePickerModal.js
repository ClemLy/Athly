import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import { getTitles, equipTitle } from '../../services/title.service';
import { RARITY_META } from '../../services/inventory.service';
import { haptics } from '../../services/haptics.service';

// ─── TitleInfoModal ───────────────────────────────────────────────────────────
// Affiche la quête exacte pour un titre encore verrouillé, avec une barre de
// progression quand le titre a un seuil numérique (voir progress côté backend).
function TitleInfoModal({ title, onClose }) {
  const visible = Boolean(title);
  const meta = title ? (RARITY_META[title.rarity] || RARITY_META.common) : RARITY_META.common;
  const progress = title?.progress;
  const pct = progress ? Math.max(0, Math.min(1, progress.current / progress.target)) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.infoBackdrop}>
        <View style={[s.infoCard, { borderColor: `${meta.color}45` }]}>
          <View style={[s.infoIconWrap, { backgroundColor: `${meta.color}1A`, borderColor: `${meta.color}45` }]}>
            <Ionicons name="lock-closed" size={26} color={meta.color} />
          </View>
          <Text style={s.infoTitle}>{title?.label}</Text>
          <Text style={s.infoBody}>{title?.condition}</Text>

          {progress && (
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pct * 100}%`, backgroundColor: meta.color }]} />
              </View>
              <Text style={s.progressLabel}>{progress.current} / {progress.target}</Text>
            </View>
          )}

          <TouchableOpacity style={[s.infoCloseBtn, { backgroundColor: meta.color }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.infoCloseTxt}>Compris</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── TitlePickerModal ─────────────────────────────────────────────────────────
// Sélecteur de titres (Section X) : liste directe, tap sur un titre débloqué
// = équipé immédiatement (pas de preview ni d'étape de confirmation
// intermédiaire — juste choisir parmi ce qu'on a et ce qu'on n'a pas).
//
// Props : visible bool, onClose () => void

export default function TitlePickerModal({ visible, onClose }) {
  const [titles, setTitles] = useState([]);
  const [equippedTitleId, setEquippedTitleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [equippingId, setEquippingId] = useState(undefined); // id en cours d'équipement, ou undefined
  const [infoTitle, setInfoTitle] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getTitles();
      setTitles(res.titles);
      setEquippedTitleId(res.equippedTitle);
    } catch (_) {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleSelect = useCallback(async (titleId) => {
    if (titleId === equippedTitleId) return;
    try {
      setEquippingId(titleId);
      await equipTitle(titleId);
      haptics.success();
      setEquippedTitleId(titleId);
    } catch (_) {
      // best-effort
    } finally {
      setEquippingId(undefined);
    }
  }, [equippedTitleId]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <TouchableOpacity style={s.closeIcon} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>

          <Text style={s.sheetTitle}>Titres</Text>
          <Text style={s.sheetSub}>Choisis le titre affiché sous ton pseudo.</Text>

          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
              <View style={s.grid}>
                {/* ── Tuile "Aucun titre" ── */}
                <TouchableOpacity
                  style={[s.tile, equippedTitleId === null && s.tileEquippedNeutral]}
                  onPress={() => handleSelect(null)}
                  activeOpacity={0.85}
                >
                  {equippedTitleId === null && (
                    <View style={[s.tileCheck, { backgroundColor: Colors.textMuted }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                  {equippingId === null
                    ? <ActivityIndicator size="small" color={Colors.textMuted} />
                    : <Ionicons name="remove-circle-outline" size={18} color={Colors.textMuted} />}
                  <Text style={s.tileNoneLabel}>Aucun titre</Text>
                </TouchableOpacity>

                {titles.map((title) => {
                  const meta = RARITY_META[title.rarity] || RARITY_META.common;
                  const isEquipped = title.id === equippedTitleId;

                  if (!title.unlocked) {
                    return (
                      <TouchableOpacity
                        key={title.id}
                        style={s.tileLocked}
                        onPress={() => setInfoTitle(title)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
                        <Text style={s.tileLockedLabel} numberOfLines={2}>{title.label}</Text>
                        {title.progress && (
                          <Text style={s.tileLockedProgress}>
                            {title.progress.current}/{title.progress.target}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={title.id}
                      style={[
                        s.tile,
                        { borderColor: `${meta.color}40` },
                        isEquipped && {
                          borderColor: meta.color,
                          backgroundColor: `${meta.color}1F`,
                        },
                      ]}
                      onPress={() => handleSelect(title.id)}
                      activeOpacity={0.85}
                    >
                      {isEquipped && (
                        <View style={[s.tileCheck, { backgroundColor: meta.color }]}>
                          <Ionicons name="checkmark" size={10} color="#fff" />
                        </View>
                      )}
                      {equippingId === title.id
                        ? <ActivityIndicator size="small" color={meta.color} />
                        : <Ionicons name="sparkles" size={15} color={meta.color} />}
                      <Text style={[s.tileLabel, { color: meta.color }]} numberOfLines={2}>{title.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      <TitleInfoModal title={infoTitle} onClose={() => setInfoTitle(null)} />
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  sheet: {
    width: '100%', maxHeight: '85%', backgroundColor: '#13131C',
    borderRadius: 24, borderWidth: 1, borderColor: `${Colors.primary}38`,
    padding: 22, paddingTop: 40,
  },
  closeIcon: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  sheetSub: { color: Colors.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 4, marginBottom: 18 },

  scroll: { maxHeight: 420 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 4 },

  tile: {
    width: '47%', minHeight: 82, borderRadius: 14, borderWidth: 1,
    backgroundColor: '#1A1A24', padding: 10, alignItems: 'center', justifyContent: 'center',
  },
  tileEquippedNeutral: {
    borderColor: Colors.textMuted, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tileCheck: {
    position: 'absolute', top: 8, right: 8, width: 17, height: 17, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  tileLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  tileNoneLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 6 },

  tileLocked: {
    width: '47%', minHeight: 82, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: 'rgba(255,255,255,0.02)', padding: 10, alignItems: 'center', justifyContent: 'center',
    opacity: 0.55,
  },
  tileLockedLabel: { color: Colors.textMuted, fontSize: 10.5, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  tileLockedProgress: { color: Colors.textMuted, fontSize: 9.5, marginTop: 4 },

  // ── TitleInfoModal ─────────────────────────────────────────────────────────
  infoBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  infoCard: {
    width: '100%', backgroundColor: '#13131C', borderRadius: 22, borderWidth: 1,
    padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.65, shadowRadius: 32, elevation: 20,
  },
  infoIconWrap: {
    width: 60, height: 60, borderRadius: 18, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  infoTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  infoBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 18 },
  progressWrap: { width: '100%', marginBottom: 22 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#0A0A0A', overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { color: Colors.textMuted, fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  infoCloseBtn: {
    width: '100%', height: 50, borderRadius: 13, justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 12, elevation: 6,
  },
  infoCloseTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
