import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import {
  createLobby, getLobby, joinLobby, inviteToLobby, readyLobby, unreadyLobby, leaveLobby,
  getFriendsList,
} from '../../services';
import { useMyId } from '../../hooks/useMyId';
import { getErrorMessage } from '../../utils/errorMessages';
import UserAvatar from '../social/UserAvatar';

const POLL_MS = 3000;
const INVITE_COOLDOWN_MS = 30000;
const MAX_PLAYERS = 5;

// Bonus XP Multi — miroir de computeMultiBonusPercent (back/workoutLobby.controller.js).
const MULTI_BONUS_BY_COUNT = { 1: 0, 2: 0.15, 3: 0.25, 4: 0.35, 5: 0.50 };
export function computeBonusPercent(memberCount) {
  if (memberCount >= 5) return MULTI_BONUS_BY_COUNT[5];
  return MULTI_BONUS_BY_COUNT[memberCount] ?? 0;
}

// ─── MultiLobbyModal ──────────────────────────────────────────────────────────
// Salon d'une séance Multi, plein écran, en 3 gestes clairs :
//   1. inviter des amis (la liste est sous les yeux, pas dans un menu) ;
//   2. choisir SA séance (chacun fait la sienne, on démarre ensemble) ;
//   3. « Je suis prêt » — la séance démarre pour tous quand chacun l'est.
// Fermer le salon le quitte vraiment (sinon les autres attendaient un membre
// fantôme qui ne serait jamais prêt). Les erreurs (salon complet, déjà
// démarré, invitation refusée) sont affichées au lieu d'être avalées.
//
// Props :
//   visible          bool
//   existingLobbyId  string | null — rejoint ce salon au lieu d'en créer un
//   workoutOptions   [{ key, name, meta }] — séances proposées
//   initialWorkoutKey string | null — séance déjà choisie avant d'ouvrir
//   onClose          () => void
//   onReady          (lobbyId, workoutKey) => void — tout le monde est prêt

export default function MultiLobbyModal({
  visible, existingLobbyId, workoutOptions = [], initialWorkoutKey = null, onClose, onReady,
}) {
  const insets = useSafeAreaInsets();
  const myId = useMyId();

  const [lobby, setLobby] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [friends, setFriends] = useState([]);
  const [readying, setReadying] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [invitedAt, setInvitedAt] = useState({});   // { friendId: ms }
  const [inviteErrors, setInviteErrors] = useState({}); // { friendId: message }
  const [now, setNow] = useState(Date.now());
  const [workoutKey, setWorkoutKey] = useState(initialWorkoutKey);
  const [pickerOpen, setPickerOpen] = useState(false);
  const firedReadyRef = useRef(false);
  const lobbyIdRef = useRef(null);
  const workoutKeyRef = useRef(initialWorkoutKey);

  useEffect(() => { workoutKeyRef.current = workoutKey; }, [workoutKey]);

  const fire = useCallback((id) => {
    if (firedReadyRef.current) return;
    firedReadyRef.current = true;
    lobbyIdRef.current = null; // la séance démarre : ne surtout pas « quitter » en fermant
    onReady(id, workoutKeyRef.current);
  }, [onReady]);

  // ── Ouverture : créer ou rejoindre ──
  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    firedReadyRef.current = false;
    setLobby(null);
    setError(null);
    setActionError(null);
    setLoading(true);
    setInvitedAt({});
    setInviteErrors({});
    setWorkoutKey(initialWorkoutKey);
    setPickerOpen(!initialWorkoutKey && !!existingLobbyId);

    (async () => {
      try {
        const [lobbyRes, friendsRes] = await Promise.all([
          existingLobbyId ? joinLobby(existingLobbyId) : createLobby(),
          getFriendsList().catch(() => ({ friends: [] })),
        ]);
        if (cancelled) return;
        setLobby(lobbyRes.lobby);
        lobbyIdRef.current = lobbyRes.lobby._id;
        setFriends(friendsRes.friends ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(getErrorMessage(e, existingLobbyId
            ? 'Impossible de rejoindre cette séance Multi.'
            : 'Impossible de créer la séance Multi. Vérifie ta connexion.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, existingLobbyId]);

  // ── Suivi du salon (polling, pas de websocket dans l'app) ──
  useEffect(() => {
    if (!visible || !lobby?._id || error) return undefined;
    const id = lobby._id;
    const t = setInterval(async () => {
      try {
        const res = await getLobby(id);
        setLobby(res.lobby);
        if (res.lobby.status === 'active') { clearInterval(t); fire(id); }
      } catch (e) {
        if (e?.status === 404 || e?.status === 403) {
          clearInterval(t);
          lobbyIdRef.current = null;
          setError('Cette séance Multi n\'existe plus.');
        }
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [visible, lobby?._id, error, fire]);

  // Décompte des relances d'invitation (1×/s).
  useEffect(() => {
    if (!visible) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  // Fermer = quitter le salon (best-effort).
  const close = useCallback(() => {
    const id = lobbyIdRef.current;
    lobbyIdRef.current = null;
    if (id) leaveLobby(id).catch(() => {});
    onClose();
  }, [onClose]);

  const handleInvite = useCallback(async (friendId) => {
    if (!lobby) return;
    const startedAt = invitedAt[friendId];
    if (startedAt && Date.now() - startedAt < INVITE_COOLDOWN_MS) return;
    setInvitedAt((prev) => ({ ...prev, [friendId]: Date.now() }));
    setInviteErrors((prev) => ({ ...prev, [friendId]: null }));
    try {
      await inviteToLobby(lobby._id, friendId);
    } catch (e) {
      setInvitedAt((prev) => ({ ...prev, [friendId]: 0 }));
      setInviteErrors((prev) => ({ ...prev, [friendId]: getErrorMessage(e, 'Invitation non envoyée.') }));
    }
  }, [lobby, invitedAt]);

  const members = lobby?.members ?? [];
  const memberCount = lobby?.memberCount ?? members.length;
  const myMember = members.find((m) => m.user?._id === myId);
  const isReady = myMember?.status === 'ready';
  const alone = memberCount < 2;
  const selected = workoutOptions.find((o) => o.key === workoutKey) || null;
  const notReady = members.filter((m) => m.status !== 'ready' && m.user?._id !== myId).map((m) => m.user?.pseudo);

  const handleToggleReady = useCallback(async () => {
    if (!lobby) return;
    if (!selected && !isReady) { setPickerOpen(true); return; }
    setReadying(true);
    setActionError(null);
    try {
      const res = isReady ? await unreadyLobby(lobby._id) : await readyLobby(lobby._id);
      setLobby(res.lobby);
      if (res.lobby.status === 'active') fire(res.lobby._id);
    } catch (e) {
      setActionError(getErrorMessage(e, 'Action impossible pour le moment. Réessaie.'));
    } finally {
      setReadying(false);
    }
  }, [lobby, isReady, selected, fire]);

  const memberIds = new Set(members.map((m) => m.user?._id));
  const invitable = friends.filter((f) => !memberIds.has(f.user._id));
  const bonus = Math.round(computeBonusPercent(memberCount) * 100);
  const full = memberCount >= MAX_PLAYERS;

  let statusText;
  if (alone) statusText = 'Invite au moins un ami pour pouvoir démarrer.';
  else if (!selected && !isReady) statusText = 'Choisis ta séance, puis déclare-toi prêt.';
  else if (isReady && notReady.length > 0) statusText = `En attente de ${notReady.join(', ')}…`;
  else if (!isReady) statusText = 'La séance démarre dès que tout le monde est prêt.';
  else statusText = 'Démarrage…';

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        {/* ── En-tête ── */}
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quitter le salon" style={styles.closeBtn} onPress={close}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} accessibilityRole="header">Séance Multi</Text>
          <View style={{ width: 42 }} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.errorTitle}>{error}</Text>
            <TouchableOpacity accessibilityRole="button" style={[styles.cta, styles.ctaGhost, { alignSelf: 'stretch', marginTop: 20 }]} onPress={onClose}>
              <Text style={styles.ctaTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.intro}>
                Chacun fait sa propre séance, mais vous démarrez et terminez ensemble. Plus vous êtes nombreux, plus le bonus d'XP grimpe.
              </Text>

              {/* ── Joueurs ── */}
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Joueurs <Text style={styles.sectionCount}>{memberCount}/{MAX_PLAYERS}</Text></Text>
                <View style={styles.bonusPill}>
                  <Ionicons name="flash" size={13} color={bonus > 0 ? Colors.gold : Colors.textMuted} />
                  <Text style={[styles.bonusPillTxt, bonus === 0 && { color: Colors.textMuted }]}>+{bonus} % XP</Text>
                </View>
              </View>

              <View style={styles.slots}>
                {Array.from({ length: MAX_PLAYERS }, (_, i) => {
                  const m = members[i];
                  if (!m) {
                    return (
                      <View key={`empty-${i}`} style={styles.slot}>
                        <View style={styles.emptySlot}><Ionicons name="add" size={20} color={Colors.textMuted} /></View>
                        <Text style={styles.slotName}> </Text>
                      </View>
                    );
                  }
                  const ready = m.status === 'ready';
                  const me = m.user?._id === myId;
                  return (
                    <View key={m.user?._id || i} style={styles.slot} accessible accessibilityLabel={`${me ? 'Toi' : m.user?.pseudo}, ${ready ? 'prêt' : 'pas encore prêt'}`}>
                      <UserAvatar user={m.user} size={52} />
                      <Text style={[styles.slotName, me && { color: Colors.primary }]} numberOfLines={1}>{me ? 'Toi' : m.user?.pseudo}</Text>
                      <View style={[styles.statusChip, ready && styles.statusChipReady]}>
                        <Text style={[styles.statusChipTxt, ready && styles.statusChipTxtReady]}>{ready ? 'Prêt' : 'Pas prêt'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.scaleTxt}>
                {[2, 3, 4, 5].map((n, i) => (
                  <Text key={n} style={n === memberCount && styles.scaleActive}>
                    {`${i ? '   ·   ' : ''}${n} : +${Math.round(computeBonusPercent(n) * 100)} %`}
                  </Text>
                ))}
              </Text>

              {/* ── Ta séance ── */}
              <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Ta séance</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: pickerOpen }}
                accessibilityLabel={selected ? `Ta séance : ${selected.name}. Changer` : 'Choisir ta séance'}
                onPress={() => setPickerOpen((v) => !v)}
                disabled={isReady}
                style={({ pressed }) => [styles.workoutRow, !selected && styles.workoutRowEmpty, pressed && { opacity: 0.8 }, isReady && { opacity: 0.6 }]}
              >
                <Ionicons name="barbell" size={18} color={selected ? Colors.primary : Colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.workoutName, !selected && { color: Colors.textSecondary }]} numberOfLines={1}>
                    {selected ? selected.name : 'Choisis ta séance'}
                  </Text>
                  {selected?.meta ? <Text style={styles.workoutMeta} numberOfLines={1}>{selected.meta}</Text> : null}
                </View>
                {!isReady ? <Text style={styles.link}>{pickerOpen ? 'Fermer' : selected ? 'Changer' : 'Choisir'}</Text> : null}
              </Pressable>
              {pickerOpen && !isReady ? (
                <View style={styles.listCard}>
                  {workoutOptions.map((o, i) => {
                    const active = o.key === workoutKey;
                    return (
                      <Pressable
                        key={o.key}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        onPress={() => { setWorkoutKey(o.key); setPickerOpen(false); }}
                        style={({ pressed }) => [styles.optionRow, i > 0 && styles.rowBorder, pressed && { opacity: 0.75 }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optionName} numberOfLines={1}>{o.name}</Text>
                          {o.meta ? <Text style={styles.optionMeta} numberOfLines={1}>{o.meta}</Text> : null}
                        </View>
                        <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? Colors.primary : Colors.borderDim} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* ── Inviter ── */}
              <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Inviter des amis</Text>
              {full ? (
                <Text style={styles.muted}>Le salon est complet.</Text>
              ) : invitable.length === 0 ? (
                <Text style={styles.muted}>
                  {friends.length === 0 ? 'Ajoute des amis dans l\'onglet Social pour les inviter.' : 'Tous tes amis sont déjà dans le salon.'}
                </Text>
              ) : (
                <View style={styles.listCard}>
                  {invitable.map((f, i) => {
                    const started = invitedAt[f.user._id];
                    const elapsed = started ? now - started : Infinity;
                    const cooling = elapsed < INVITE_COOLDOWN_MS;
                    const remaining = cooling ? Math.ceil((INVITE_COOLDOWN_MS - elapsed) / 1000) : 0;
                    const err = inviteErrors[f.user._id];
                    return (
                      <View key={f.user._id} style={[styles.friendRow, i > 0 && styles.rowBorder]}>
                        <UserAvatar user={f.user} size={40} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.optionName} numberOfLines={1}>{f.user.pseudo}</Text>
                          <Text style={[styles.optionMeta, err && { color: Colors.error }]} numberOfLines={2}>
                            {err || (started ? (cooling ? `Invité · relance possible dans ${remaining} s` : 'Invité · pas encore là') : `Niv. ${f.user.level ?? 1}`)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={started ? `Relancer ${f.user.pseudo}` : `Inviter ${f.user.pseudo}`}
                          style={[styles.inviteBtn, (started || cooling) && styles.inviteBtnSent]}
                          onPress={() => handleInvite(f.user._id)}
                          disabled={cooling}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.inviteBtnTxt, (started || cooling) && { color: Colors.textSecondary }]}>
                            {cooling ? 'Invité' : started ? 'Relancer' : 'Inviter'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* ── Action ── */}
            <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
              <Text style={[styles.statusTxt, actionError && { color: Colors.error }]} accessibilityLiveRegion="polite">
                {actionError || statusText}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.cta, isReady && styles.ctaGhost, alone && !isReady && styles.ctaDisabled]}
                onPress={handleToggleReady}
                disabled={readying || (alone && !isReady)}
                activeOpacity={0.85}
              >
                {readying ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.ctaTxt}>
                    {isReady ? 'Je ne suis plus prêt' : selected ? 'Je suis prêt' : 'Choisir ma séance'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgAbyss },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  closeBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardDeep,
  },
  headerTitle: { flex: 1, textAlign: 'center', color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 12, lineHeight: 22 },

  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  intro: { color: Colors.textSecondary, fontSize: 14.5, lineHeight: 21, marginTop: 4, marginBottom: 18 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  sectionCount: { color: Colors.textMuted, fontSize: 15, fontWeight: '700' },
  sectionSpaced: { marginTop: 24, marginBottom: 10 },
  bonusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 11, borderRadius: 15,
    backgroundColor: 'rgba(255,215,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
  },
  bonusPillTxt: { color: Colors.gold, fontSize: 13.5, fontWeight: '800' },

  slots: { flexDirection: 'row', justifyContent: 'space-between' },
  slot: { width: '19%', alignItems: 'center' },
  emptySlot: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)',
  },
  slotName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 6, maxWidth: '100%' },
  statusChip: {
    marginTop: 4, paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  statusChipReady: { backgroundColor: 'rgba(34,197,94,0.16)' },
  statusChipTxt: { color: Colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  statusChipTxtReady: { color: Colors.valid },
  scaleTxt: { color: Colors.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 14 },
  scaleActive: { color: Colors.gold, fontWeight: '800' },

  workoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 16, backgroundColor: Colors.cardDeep, borderWidth: 1, borderColor: 'rgba(254,116,57,0.35)',
  },
  workoutRowEmpty: { borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)' },
  workoutName: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: '700' },
  workoutMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  listCard: {
    marginTop: 8, borderRadius: 16, overflow: 'hidden',
    backgroundColor: Colors.cardDeep, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  optionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  optionName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  optionMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  friendRow: { flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingHorizontal: 14, paddingVertical: 10 },
  inviteBtn: {
    height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  inviteBtnSent: { backgroundColor: 'rgba(255,255,255,0.07)' },
  inviteBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  muted: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },

  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: Colors.bgAbyss,
  },
  statusTxt: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 10, lineHeight: 19 },
  cta: {
    height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  ctaGhost: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  ctaDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
