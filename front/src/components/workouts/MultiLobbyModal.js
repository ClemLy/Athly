import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { createLobby, getLobby, joinLobby, inviteToLobby, readyLobby, unreadyLobby } from '../../services';
import { getFriendsList } from '../../services';
import { useUser } from '../../context/UserContext';

const POLL_MS = 3000;
const INVITE_COOLDOWN_MS = 30000;

const STATUS_META = {
  waiting:  { icon: 'time-outline',       color: Colors.textMuted },
  ready:    { icon: 'checkmark-circle',   color: Colors.success },
  finished: { icon: 'flag',               color: Colors.primary },
};

// Bonus XP Multi — miroir de computeMultiBonusPercent (back/workoutLobby.controller.js) :
// généreux à dessein, un groupe de 5 est rare (2 joueurs → 15%, 3 → 25%,
// 4 → 35%, 5 → 50%).
const MULTI_BONUS_BY_COUNT = { 1: 0, 2: 0.15, 3: 0.25, 4: 0.35, 5: 0.50 };
function computeBonusPercent(memberCount) {
  if (memberCount >= 5) return MULTI_BONUS_BY_COUNT[5];
  return MULTI_BONUS_BY_COUNT[memberCount] ?? 0;
}

const BONUS_TABLE = [1, 2, 3, 4, 5].map((n) => ({ count: n, percent: computeBonusPercent(n) }));

// ─── BonusTableModal ──────────────────────────────────────────────────────────
// Petit tableau expliquant le bonus XP de groupe par effectif — ouvert en
// appuyant sur le chip de bonus dans MultiLobbyModal.
function BonusTableModal({ visible, memberCount, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.tableCard}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="flash" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Bonus XP de groupe</Text>
          <Text style={styles.body}>
            Plus vous êtes nombreux, plus le bonus grimpe. Assembler un groupe de 5 est difficile - ça se mérite !
          </Text>

          <View style={styles.tableRows}>
            {BONUS_TABLE.map((row) => (
              <View
                key={row.count}
                style={[styles.tableRow, row.count === memberCount && styles.tableRowActive]}
              >
                <Text style={[styles.tableRowLabel, row.count === memberCount && styles.tableRowLabelActive]}>
                  {row.count} joueur{row.count > 1 ? 's' : ''}
                </Text>
                <Text style={[styles.tableRowPercent, row.count === memberCount && styles.tableRowPercentActive]}>
                  +{Math.round(row.percent * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── MultiLobbyModal ──────────────────────────────────────────────────────────
// Étape de lancement d'une séance en Multi (Section VII) : crée le lobby (ou
// rejoint un lobby existant depuis une invitation reçue), permet d'inviter des
// amis (vraie notification push, avec cooldown anti-spam de 30s), affiche qui
// a rejoint et son statut ainsi que le bonus XP de groupe, et se ferme
// automatiquement (onReady) dès que le lobby passe 'active' — c'est-à-dire dès
// que 100% des membres sont prêts.
//
// Props :
//   visible         bool
//   existingLobbyId string | null — rejoint ce lobby au lieu d'en créer un neuf
//   onClose         () => void — annule (le lobby reste en base, abandonné)
//   onReady         (lobbyId: string) => void — lobby actif, lance la séance

export default function MultiLobbyModal({ visible, existingLobbyId, onClose, onReady }) {
  const { user } = useUser();
  const myId = user?._id;

  const [lobby, setLobby] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [readying, setReadying] = useState(false);
  const [bonusTableVisible, setBonusTableVisible] = useState(false);
  const [invitedAt, setInvitedAt] = useState({}); // { friendId: timestampMs }
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef(null);
  const cooldownTickRef = useRef(null);
  const firedReadyRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    firedReadyRef.current = false;
    setLoading(true);
    setInvitePanelOpen(false);
    setInvitedAt({});

    (async () => {
      try {
        const [lobbyRes, friendsRes] = await Promise.all([
          existingLobbyId ? joinLobby(existingLobbyId) : createLobby(),
          getFriendsList(),
        ]);
        setLobby(lobbyRes.lobby);
        setFriends(friendsRes.friends ?? []);
      } catch (_) {
        // Best-effort — fermeture silencieuse si la création/jointure échoue.
      } finally {
        setLoading(false);
      }
    })();

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [visible, existingLobbyId]);

  // Poll l'état du lobby — pas de websocket, cohérent avec le reste de l'app
  // (Météo des séances, Groupe de streak...).
  useEffect(() => {
    if (!visible || !lobby?._id) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await getLobby(lobby._id);
        setLobby(res.lobby);
        if (res.lobby.status === 'active' && !firedReadyRef.current) {
          firedReadyRef.current = true;
          clearInterval(pollRef.current);
          onReady(res.lobby._id);
        }
      } catch (_) {
        // best-effort
      }
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [visible, lobby?._id, onReady]);

  // Tick pour rafraîchir les cercles de cooldown d'invitation (1x/s).
  useEffect(() => {
    if (!visible) return undefined;
    cooldownTickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(cooldownTickRef.current);
  }, [visible]);

  const handleInvite = useCallback(async (friendId) => {
    if (!lobby) return;
    const startedAt = invitedAt[friendId];
    if (startedAt && Date.now() - startedAt < INVITE_COOLDOWN_MS) return;
    setInvitedAt((prev) => ({ ...prev, [friendId]: Date.now() }));
    try { await inviteToLobby(lobby._id, friendId); } catch (_) {}
  }, [lobby, invitedAt]);

  const myMember = (lobby?.members ?? []).find((m) => m.user._id === myId);
  const isReady = myMember?.status === 'ready';
  const canReady = (lobby?.memberCount ?? 0) >= 2;

  const handleToggleReady = useCallback(async () => {
    if (!lobby) return;
    setReadying(true);
    try {
      const res = isReady ? await unreadyLobby(lobby._id) : await readyLobby(lobby._id);
      setLobby(res.lobby);
      if (res.lobby.status === 'active' && !firedReadyRef.current) {
        firedReadyRef.current = true;
        onReady(res.lobby._id);
      }
    } catch (_) {
      // best-effort
    } finally {
      setReadying(false);
    }
  }, [lobby, isReady, onReady]);

  const memberIds = new Set((lobby?.members ?? []).map((m) => m.user._id));
  const invitableFriends = friends.filter((f) => !memberIds.has(f.user._id));
  const bonusPercent = computeBonusPercent(lobby?.memberCount ?? 1);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="people" size={26} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Séance en Multi</Text>
          <Text style={styles.body}>
            Invite jusqu'à 4 amis. La séance démarre pour tout le monde dès que
            chacun se déclare prêt.
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <View style={styles.membersRow}>
                {(lobby?.members ?? []).map((m) => {
                  const meta = STATUS_META[m.status] ?? STATUS_META.waiting;
                  return (
                    <View key={m.user._id} style={styles.memberBubbleWrap}>
                      <View style={styles.memberBubble}>
                        <Text style={styles.memberBubbleTxt}>{(m.user.pseudo ?? '?').charAt(0).toUpperCase()}</Text>
                        <View style={[styles.statusDot, { backgroundColor: meta.color }]}>
                          <Ionicons name={meta.icon} size={9} color="#fff" />
                        </View>
                      </View>
                      <Text style={styles.memberName} numberOfLines={1}>{m.user.pseudo}</Text>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.bonusChip} onPress={() => setBonusTableVisible(true)} activeOpacity={0.8}>
                <Ionicons name="flash" size={15} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.bonusChipTxt}>Bonus de groupe : +{Math.round(bonusPercent * 100)}% XP</Text>
                <Ionicons name="information-circle-outline" size={15} color="#fff" style={{ marginLeft: 8 }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inviteToggle}
                onPress={() => setInvitePanelOpen((v) => !v)}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={15} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.inviteToggleTxt}>Inviter un ami</Text>
                <Ionicons name={invitePanelOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textMuted} />
              </TouchableOpacity>

              {invitePanelOpen && (
                <View style={styles.invitePanel}>
                  {invitableFriends.length === 0 ? (
                    <Text style={styles.inviteEmpty}>Tous tes amis sont déjà dans le lobby (ou tu n'as pas d'amis disponibles).</Text>
                  ) : (
                    <FlatList
                      data={invitableFriends}
                      keyExtractor={(f) => f.user._id}
                      style={{ maxHeight: 160 }}
                      renderItem={({ item }) => {
                        const startedAt = invitedAt[item.user._id];
                        const elapsedMs = startedAt ? now - startedAt : Infinity;
                        const onCooldown = elapsedMs < INVITE_COOLDOWN_MS;
                        const remainingSec = onCooldown ? Math.ceil((INVITE_COOLDOWN_MS - elapsedMs) / 1000) : 0;
                        return (
                          <TouchableOpacity
                            style={styles.friendRow}
                            onPress={() => handleInvite(item.user._id)}
                            activeOpacity={0.75}
                            disabled={onCooldown}
                          >
                            <Text style={styles.friendName}>{item.user.pseudo}</Text>
                            {onCooldown ? (
                              <View style={styles.cooldownCircle}>
                                <Text style={styles.cooldownTxt}>{remainingSec}</Text>
                              </View>
                            ) : (
                              <Ionicons name="paper-plane-outline" size={15} color={Colors.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      }}
                    />
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.readyBtn,
                  isReady && styles.unreadyBtn,
                  !canReady && !isReady && styles.readyBtnDisabled,
                ]}
                onPress={handleToggleReady}
                disabled={readying || (!canReady && !isReady)}
                activeOpacity={0.85}
              >
                {readying
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <Ionicons
                        name={isReady ? 'close-circle' : 'checkmark-circle'}
                        size={17}
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.readyBtnTxt}>
                        {isReady ? 'Je ne suis plus prêt' : 'Je suis prêt'}
                      </Text>
                    </>
                  )}
              </TouchableOpacity>
              <Text style={styles.waitHint}>
                {canReady
                  ? 'En attente que tout le monde soit prêt pour démarrer ensemble…'
                  : 'Il faut au moins 2 joueurs dans le lobby pour se déclarer prêt.'}
              </Text>
            </>
          )}
        </View>
      </View>

      <BonusTableModal
        visible={bonusTableVisible}
        memberCount={lobby?.memberCount ?? 1}
        onClose={() => setBonusTableVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    borderColor:     `${Colors.primary}38`,
    padding:         24,
    paddingTop:      36,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.65,
    shadowRadius:    32,
    elevation:       20,
  },
  closeIcon: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: `${Colors.primary}1A`,
    borderWidth: 1, borderColor: `${Colors.primary}45`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 18 },
  membersRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginBottom: 18, width: '100%' },
  memberBubbleWrap: { alignItems: 'center', width: 56 },
  memberBubble: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(254,116,57,0.14)',
    justifyContent: 'center', alignItems: 'center',
  },
  memberBubbleTxt: { color: Colors.primary, fontSize: 16, fontWeight: '800' },
  statusDot: {
    position: 'absolute', bottom: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.bgDeep2,
    justifyContent: 'center', alignItems: 'center',
  },
  memberName: { color: Colors.textMuted, fontSize: 10.5, fontWeight: '600', marginTop: 5, textAlign: 'center' },
  bonusChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 38, width: '100%', borderRadius: 12,
    backgroundColor: Colors.primary, marginBottom: 12,
  },
  bonusChipTxt: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  inviteToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 42, width: '100%', borderRadius: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 8, gap: 6,
  },
  inviteToggleTxt: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  invitePanel: { width: '100%', marginBottom: 12 },
  inviteEmpty: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 10 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  friendName: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: '600' },
  cooldownCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.textMuted,
    justifyContent: 'center', alignItems: 'center',
  },
  cooldownTxt: { color: Colors.textMuted, fontSize: 9.5, fontWeight: '700' },
  readyBtn: {
    flexDirection: 'row', width: '100%', height: 50, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary,
    marginTop: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  unreadyBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: 'transparent', shadowOpacity: 0, elevation: 0,
  },
  readyBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    shadowColor: 'transparent', shadowOpacity: 0, elevation: 0,
  },
  readyBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  waitHint: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10 },

  // ── BonusTableModal ──────────────────────────────────────────────────────
  tableCard: {
    width:           '100%',
    backgroundColor: Colors.bgDeep2,
    borderRadius:    22,
    borderWidth:     1,
    borderColor:     `${Colors.primary}38`,
    padding:         24,
    paddingTop:      36,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.65,
    shadowRadius:    32,
    elevation:       20,
  },
  tableRows: { width: '100%', gap: 8 },
  tableRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tableRowActive: {
    backgroundColor: `${Colors.primary}1A`,
    borderWidth: 1, borderColor: `${Colors.primary}45`,
  },
  tableRowLabel: { color: Colors.textSecondary, fontSize: 13.5, fontWeight: '600' },
  tableRowLabelActive: { color: Colors.textPrimary, fontWeight: '800' },
  tableRowPercent: { color: Colors.textMuted, fontSize: 14, fontWeight: '800' },
  tableRowPercentActive: { color: Colors.primary },
});
