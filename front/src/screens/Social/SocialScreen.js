import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator, Animated, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useToast } from '../../context/ToastContext';
import {
  searchUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  getFriendsList, getPendingRequests, getLeaderboard,
  getMyGroup, inviteToGroup, respondToGroupInvite, shakeMember, checkGroupStreak,
} from '../../services/social.service';

const SEGMENTS = [
  { key: 'friends',     label: 'Amis',       icon: 'people' },
  { key: 'leaderboard', label: 'Classement', icon: 'podium' },
  { key: 'group',       label: 'Groupe',     icon: 'flame' },
];

// ─── SocialScreen ─────────────────────────────────────────────────────────────
// Hub social (Briques III & IV) : amis + demandes + recherche, classement XP,
// groupe de streak avec bouton Secouer. Chaque segment a ses entrées animées.

export default function SocialScreen({ navigation }) {
  const { showToast } = useToast();
  const [segment, setSegment] = useState('friends');

  // ── Données ──
  const [friends,     setFriends]     = useState([]);
  const [pending,     setPending]     = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [group,       setGroup]       = useState(null);
  const [groupInvites, setGroupInvites] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  // ── Recherche ──
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState(null); // null = pas de recherche active
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const loadAll = useCallback(async () => {
    try {
      const [friendsRes, pendingRes, boardRes, groupRes] = await Promise.all([
        getFriendsList(), getPendingRequests(), getLeaderboard(), getMyGroup(),
      ]);
      setFriends(friendsRes.friends ?? []);
      setPending(pendingRes.requests ?? []);
      setLeaderboard(boardRes.leaderboard ?? []);
      setGroup(groupRes.group ?? null);
      setGroupInvites(groupRes.invites ?? []);
    } catch (error) {
      if (!error.isSessionExpired) {
        showToast('Impossible de charger le social. Vérifie ta connexion.', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  // ── Recherche débouncée (400 ms) ──
  const onQueryChange = (text) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) { setResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchUsers(text.trim());
        setResults(res.results ?? []);
      } catch (_) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  useEffect(() => () => searchTimer.current && clearTimeout(searchTimer.current), []);

  // ── Actions amis ──
  const doAction = async (fn, successMsg) => {
    try {
      await fn();
      if (successMsg) showToast(successMsg, 'success');
      loadAll();
      if (query.trim().length >= 2) onQueryChange(query); // rafraîchit la recherche
    } catch (error) {
      if (error.isSessionExpired) return;
      showToast(error.data?.message || 'Action impossible.', 'error');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <Text style={styles.title}>Social</Text>

      {/* ── Segments ── */}
      <View style={styles.segmentRow}>
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          const badge = s.key === 'friends' && pending.length > 0 ? pending.length
            : s.key === 'group' && groupInvites.length > 0 ? groupInvites.length
            : null;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setSegment(s.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={active ? s.icon : `${s.icon}-outline`} size={15} color={active ? '#fff' : Colors.textMuted} />
              <Text style={[styles.segmentTxt, active && styles.segmentTxtActive]}>{s.label}</Text>
              {badge != null && (
                <View style={styles.badge}><Text style={styles.badgeTxt}>{badge}</Text></View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          keyboardShouldPersistTaps="handled"
        >
          {segment === 'friends' && (
            <FriendsSegment
              friends={friends}
              pending={pending}
              query={query}
              results={results}
              searching={searching}
              onQueryChange={onQueryChange}
              onSend={(id)    => doAction(() => sendFriendRequest(id), 'Invitation envoyée ⚡')}
              onAccept={(id)  => doAction(() => acceptFriendRequest(id), 'Vous êtes maintenant amis ! 🤝')}
              onDecline={(id) => doAction(() => declineFriendRequest(id))}
              onOpenProfile={(friend, friendshipLevel) =>
                navigation.navigate('FriendProfile', { friendId: friend._id, pseudo: friend.pseudo, friendshipLevel })}
            />
          )}

          {segment === 'leaderboard' && <LeaderboardSegment leaderboard={leaderboard} />}

          {segment === 'group' && (
            <GroupSegment
              group={group}
              invites={groupInvites}
              friends={friends}
              onInvite={(ids, name) => doAction(() => inviteToGroup(ids, name), 'Demande de Streak de Groupe envoyée 🔥')}
              onRespond={(groupId, accept) =>
                doAction(() => respondToGroupInvite(groupId, accept), accept ? 'Bienvenue dans le groupe ! 🔥' : null)}
              onShake={(groupId, memberId, pseudo) =>
                doAction(() => shakeMember(groupId, memberId), `${pseudo} a été secoué ! 🚨`)}
              onCheckStreak={async (groupId) => {
                try {
                  const res = await checkGroupStreak(groupId);
                  if (res.allValidated) {
                    showToast(`Streak jour ${res.currentStreak} ! +${res.groupBonus?.bonusXp ?? 0} XP (x${res.groupBonus?.multiplier ?? 1}) 🔥`, 'success');
                  } else if (res.alreadyValidated) {
                    showToast('Déjà validée aujourd\'hui ✅', 'success');
                  } else {
                    showToast('Tous les membres n\'ont pas encore validé leur séance.', 'error');
                  }
                  loadAll();
                } catch (error) {
                  if (!error.isSessionExpired) showToast(error.data?.message || 'Erreur.', 'error');
                }
              }}
            />
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ═══ Segment Amis ═════════════════════════════════════════════════════════════

function FriendsSegment({
  friends, pending, query, results, searching,
  onQueryChange, onSend, onAccept, onDecline, onOpenProfile,
}) {
  return (
    <>
      {/* ── Recherche ── */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Chercher un athlète par pseudo…"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.primary}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      {results !== null && (
        <>
          <Text style={styles.sectionLabel}>RÉSULTATS</Text>
          {results.length === 0 && !searching ? (
            <Text style={styles.emptySmall}>Aucun athlète trouvé.</Text>
          ) : results.map((r, i) => (
            <AnimatedRow key={r.user._id} index={i}>
              <UserRow user={r.user}>
                {r.relationStatus === 'none' && (
                  <SmallBtn label="Inviter" icon="person-add" color={Colors.primary} onPress={() => onSend(r.user._id)} />
                )}
                {r.relationStatus === 'pending_sent' && <Text style={styles.pendingTag}>Envoyée ✓</Text>}
                {r.relationStatus === 'pending_received' && (
                  <SmallBtn label="Accepter" icon="checkmark" color={Colors.valid} onPress={() => onAccept(r.requestId)} />
                )}
                {r.relationStatus === 'accepted' && <Text style={styles.friendTag}>Ami 🤝</Text>}
              </UserRow>
            </AnimatedRow>
          ))}
        </>
      )}

      {/* ── Demandes reçues ── */}
      {pending.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>DEMANDES REÇUES</Text>
          {pending.map((req, i) => (
            <AnimatedRow key={req._id} index={i}>
              <UserRow user={req.requester}>
                <SmallBtn label="" icon="checkmark" color={Colors.valid} onPress={() => onAccept(req._id)} />
                <SmallBtn label="" icon="close" color={Colors.error} onPress={() => onDecline(req._id)} />
              </UserRow>
            </AnimatedRow>
          ))}
        </>
      )}

      {/* ── Mes amis ── */}
      <Text style={styles.sectionLabel}>MES AMIS ({friends.length})</Text>
      {friends.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🤝</Text>
          <Text style={styles.emptyTxt}>Pas encore d'amis.{'\n'}Cherche un pseudo ci-dessus pour commencer !</Text>
        </View>
      ) : friends.map((f, i) => (
        <AnimatedRow key={f.user._id} index={i}>
          <TouchableOpacity activeOpacity={0.75} onPress={() => onOpenProfile(f.user, f.friendshipLevel)}>
            <UserRow user={f.user}>
              <FriendshipHearts level={f.friendshipLevel ?? 1} />
              <Ionicons name="chevron-forward" size={16} color={Colors.chevron} />
            </UserRow>
          </TouchableOpacity>
        </AnimatedRow>
      ))}
    </>
  );
}

// ═══ Segment Classement ═══════════════════════════════════════════════════════

const PODIUM_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function LeaderboardSegment({ leaderboard }) {
  const podium = leaderboard.slice(0, 3);
  const rest   = leaderboard.slice(3);

  return (
    <>
      {leaderboard.length < 2 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyTxt}>Ajoute des amis pour lancer la compétition !</Text>
        </View>
      ) : (
        <>
          {/* ── Podium ── */}
          <View style={styles.podiumRow}>
            {[1, 0, 2].map((idx) => {
              const entry = podium[idx];
              if (!entry) return <View key={idx} style={{ flex: 1 }} />;
              return (
                <PodiumColumn
                  key={entry.user._id}
                  entry={entry}
                  height={idx === 0 ? 96 : idx === 1 ? 72 : 56}
                  color={PODIUM_COLORS[idx]}
                  delay={idx === 0 ? 250 : idx === 1 ? 0 : 450}
                />
              );
            })}
          </View>

          {/* ── Reste du classement ── */}
          {rest.map((entry, i) => (
            <AnimatedRow key={entry.user._id} index={i}>
              <View style={[styles.boardRow, entry.isMe && styles.boardRowMe]}>
                <Text style={styles.boardPos}>#{entry.position}</Text>
                <Text style={[styles.boardPseudo, entry.isMe && { color: Colors.primary }]}>
                  {entry.user.pseudo}{entry.isMe ? ' (moi)' : ''}
                </Text>
                <Text style={styles.boardXp}>{entry.user.xp} XP</Text>
              </View>
            </AnimatedRow>
          ))}
        </>
      )}
    </>
  );
}

function PodiumColumn({ entry, height, color, delay }) {
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(grow, { toValue: 1, friction: 6, tension: 50, delay, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.podiumCol}>
      <Text style={styles.podiumPseudo} numberOfLines={1}>{entry.user.pseudo}</Text>
      <Text style={[styles.podiumXp, { color }]}>{entry.user.xp} XP</Text>
      <Animated.View
        style={[styles.podiumBar, {
          height,
          backgroundColor: `${color}22`,
          borderColor: `${color}66`,
          transform: [{ scaleY: grow }],
        }]}
      >
        <Text style={styles.podiumMedal}>
          {entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : '🥉'}
        </Text>
      </Animated.View>
    </View>
  );
}

// ═══ Segment Groupe ═══════════════════════════════════════════════════════════

function GroupSegment({ group, invites, friends, onInvite, onRespond, onShake, onCheckStreak }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName]     = useState('');

  const toggle = (id) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <>
      {/* ── Invitations reçues ── */}
      {invites.map((inv) => (
        <View key={inv._id} style={styles.inviteCard}>
          <Text style={styles.inviteTxt}>
            🔥 Demande de Streak de Groupe — <Text style={{ fontWeight: '800' }}>{inv.name || 'Sans nom'}</Text>
          </Text>
          <View style={styles.inviteBtns}>
            <SmallBtn label="Rejoindre" icon="checkmark" color={Colors.valid} onPress={() => onRespond(inv._id, true)} />
            <SmallBtn label="" icon="close" color={Colors.error} onPress={() => onRespond(inv._id, false)} />
          </View>
        </View>
      ))}

      {group ? (
        <GroupCard group={group} onShake={onShake} onCheckStreak={onCheckStreak} />
      ) : (
        <>
          <Text style={styles.sectionLabel}>CRÉER UN GROUPE DE STREAK (MAX 5)</Text>
          <View style={styles.searchBox}>
            <Ionicons name="flag" size={15} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Nom du groupe (ex: Les Warriors)"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
            />
          </View>

          {friends.length === 0 ? (
            <Text style={styles.emptySmall}>Ajoute d'abord des amis pour former un groupe.</Text>
          ) : (
            <>
              {friends.map((f) => {
                const selected = selectedIds.includes(f.user._id);
                return (
                  <TouchableOpacity
                    key={f.user._id}
                    style={[styles.selectRow, selected && styles.selectRowActive]}
                    onPress={() => toggle(f.user._id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={selected ? Colors.primary : Colors.borderDim}
                    />
                    <Text style={styles.selectPseudo}>{f.user.pseudo}</Text>
                    <Text style={styles.selectLevel}>Nv. {f.user.level}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.ctaBtn, (selectedIds.length === 0 || selectedIds.length > 4) && { opacity: 0.4 }]}
                disabled={selectedIds.length === 0 || selectedIds.length > 4}
                onPress={() => { onInvite(selectedIds, groupName.trim() || undefined); setSelectedIds([]); setGroupName(''); }}
                activeOpacity={0.85}
              >
                <Ionicons name="flame" size={16} color="#fff" style={{ marginRight: 7 }} />
                <Text style={styles.ctaTxt}>
                  Envoyer la demande ({selectedIds.length + 1}/5 membres)
                </Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </>
  );
}

function GroupCard({ group, onShake, onCheckStreak }) {
  const flame = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flame, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(flame, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memberCount = group.members?.length ?? 0;
  const multiplier  = (1 + 0.25 * (memberCount - 1)).toFixed(2);

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Animated.Text style={[styles.groupFlame, { transform: [{ scale: flame }] }]}>🔥</Animated.Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupName}>{group.name || 'Groupe de Streak'}</Text>
          <Text style={styles.groupStreak}>
            Streak : <Text style={{ color: Colors.primary, fontWeight: '800' }}>{group.currentStreak ?? 0} jours</Text>
            {'   '}Multiplicateur : <Text style={{ color: Colors.gold, fontWeight: '800' }}>x{multiplier}</Text>
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>MEMBRES ({memberCount}/5)</Text>
      {(group.members ?? []).map((m) => (
        <UserRow key={m._id} user={m}>
          <TouchableOpacity
            style={styles.shakeBtn}
            onPress={() => onShake(group._id, m._id, m.pseudo)}
            activeOpacity={0.8}
          >
            <Text style={styles.shakeTxt}>🚨 Secouer</Text>
          </TouchableOpacity>
        </UserRow>
      ))}

      <TouchableOpacity style={styles.ctaBtn} onPress={() => onCheckStreak(group._id)} activeOpacity={0.85}>
        <Ionicons name="flash" size={16} color="#fff" style={{ marginRight: 7 }} />
        <Text style={styles.ctaTxt}>Valider la streak du jour</Text>
      </TouchableOpacity>
    </View>
  );
}

// ═══ Composants partagés ══════════════════════════════════════════════════════

function AnimatedRow({ index, children }) {
  const slide = useRef(new Animated.Value(18)).current;
  const fade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 280, delay: index * 55, useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 1, duration: 280, delay: index * 55, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      {children}
    </Animated.View>
  );
}

function UserRow({ user, children }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarTxt}>{(user?.pseudo ?? '?').charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.userPseudo}>{user?.pseudo ?? '—'}</Text>
        <Text style={styles.userMeta}>Nv. {user?.level ?? 1} · {user?.rank ?? 'Novice'}</Text>
      </View>
      <View style={styles.userActions}>{children}</View>
    </View>
  );
}

function FriendshipHearts({ level }) {
  return (
    <Text style={styles.hearts}>
      {'❤️'.repeat(level)}{'🤍'.repeat(Math.max(0, 5 - level))}
    </Text>
  );
}

function SmallBtn({ label, icon, color, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.smallBtn, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={14} color={color} />
      {label ? <Text style={[styles.smallBtnTxt, { color }]}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgAbyss },
  title: {
    color: Colors.textPrimary, fontSize: 26, fontWeight: '800',
    letterSpacing: -0.5, paddingHorizontal: 16, paddingTop: 58, paddingBottom: 14,
  },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16 },

  // ── Segments ──
  segmentRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14,
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  segmentBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentTxt:       { color: Colors.textMuted, fontSize: 12.5, fontWeight: '700' },
  segmentTxtActive: { color: '#fff' },
  badge: {
    backgroundColor: Colors.error, borderRadius: 9, minWidth: 17, height: 17,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 20, marginBottom: 8, marginLeft: 4,
  },

  // ── Recherche ──
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 12, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },

  // ── Lignes utilisateur ──
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 14, padding: 12, marginBottom: 8,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(254,116,57,0.14)',
    justifyContent: 'center', alignItems: 'center', marginRight: 11,
  },
  avatarTxt:  { color: Colors.primary, fontSize: 16, fontWeight: '800' },
  userPseudo: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  userMeta:   { color: Colors.textMuted, fontSize: 11.5, marginTop: 1 },
  userActions:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingTag: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  friendTag:  { color: Colors.valid, fontSize: 12, fontWeight: '700' },
  hearts:     { fontSize: 10, letterSpacing: 1 },

  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, height: 32,
  },
  smallBtnTxt: { fontSize: 12, fontWeight: '700' },

  // ── Podium ──
  podiumRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    marginTop: 18, marginBottom: 6, paddingHorizontal: 8,
  },
  podiumCol:    { flex: 1, alignItems: 'center' },
  podiumPseudo: { color: Colors.textPrimary, fontSize: 12.5, fontWeight: '700', marginBottom: 2 },
  podiumXp:     { fontSize: 11, fontWeight: '800', marginBottom: 6 },
  podiumBar: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    justifyContent: 'flex-start', alignItems: 'center', paddingTop: 8,
  },
  podiumMedal: { fontSize: 22 },

  boardRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 12, paddingHorizontal: 14, height: 46, marginBottom: 7,
  },
  boardRowMe:  { borderColor: 'rgba(254,116,57,0.45)', backgroundColor: 'rgba(254,116,57,0.06)' },
  boardPos:    { color: Colors.textMuted, fontSize: 13, fontWeight: '800', width: 36 },
  boardPseudo: { flex: 1, color: Colors.textPrimary, fontSize: 13.5, fontWeight: '600' },
  boardXp:     { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '700' },

  // ── Groupe ──
  inviteCard: {
    backgroundColor: 'rgba(254,116,57,0.07)',
    borderWidth: 1, borderColor: 'rgba(254,116,57,0.30)',
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  inviteTxt:  { color: Colors.textPrimary, fontSize: 13.5, lineHeight: 19, marginBottom: 10 },
  inviteBtns: { flexDirection: 'row', gap: 8 },

  groupCard: {
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 18, padding: 16, marginTop: 6,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupFlame:  { fontSize: 34 },
  groupName:   { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  groupStreak: { color: Colors.textSecondary, fontSize: 12.5, marginTop: 3 },

  shakeBtn: {
    backgroundColor: 'rgba(255,77,77,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,77,77,0.40)',
    borderRadius: 9, paddingHorizontal: 10, height: 32, justifyContent: 'center',
  },
  shakeTxt: { color: Colors.error, fontSize: 11.5, fontWeight: '800' },

  selectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 12, padding: 12, marginBottom: 7,
  },
  selectRowActive: { borderColor: 'rgba(254,116,57,0.45)' },
  selectPseudo:    { flex: 1, color: Colors.textPrimary, fontSize: 13.5, fontWeight: '600' },
  selectLevel:     { color: Colors.textMuted, fontSize: 12 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: 13, height: 48, marginTop: 14,
  },
  ctaTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // ── Vide ──
  emptyBox:   { alignItems: 'center', paddingVertical: 36 },
  emptyEmoji: { fontSize: 38, marginBottom: 10 },
  emptyTxt:   { color: Colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptySmall: { color: Colors.textMuted, fontSize: 12.5, marginTop: 8, marginLeft: 4 },
});
