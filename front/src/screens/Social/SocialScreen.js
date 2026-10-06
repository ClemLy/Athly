import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, TextInput,
  StatusBar, ActivityIndicator, RefreshControl, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useToast } from '../../context/ToastContext';
import { useUser } from '../../context/UserContext';
import { useMyId } from '../../hooks/useMyId';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { ConfirmModal } from '../../components/common';
import FriendshipLevelUpModal from '../../components/social/FriendshipLevelUpModal';
import FriendPreviewModal from '../../components/social/FriendPreviewModal';
import AddFriendModal from '../../components/social/AddFriendModal';
import ExercisePickerModal from '../../components/social/ExercisePickerModal';
import UserAvatar from '../../components/social/UserAvatar';
import {
  searchUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  cancelFriendRequest,
  getFriendsList, getPendingRequests, getLeaderboard, getExerciseLeaderboard,
  getMyGroup, inviteToGroup, respondToGroupInvite, shakeMember, checkGroupStreak, leaveGroup,
  getLobbyInvites, declineLobbyInvite,
} from '../../services';
import { MAJOR_EXERCISES } from '../../data/majorExercises';
import { getFriendshipTitle } from '../../data/friendshipTitles';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';
import { getErrorMessage } from '../../utils/errorMessages';
import { formatNumber } from '../../utils/format';

const SEGMENTS = [
  { key: 'friends',     label: 'Amis' },
  { key: 'leaderboard', label: 'Classement' },
  { key: 'group',       label: 'Groupe' },
];

const MEDAL_COLORS = [Colors.gold, '#C9CED6', '#CD7F32'];
const MAX_GROUP = 5;

// ─── SocialScreen ─────────────────────────────────────────────────────────────
// Le mode en ligne d'Athly : amis (et invitations Multi), classement de la
// semaine ou total, groupe de streak. Chaque segment répond d'abord à
// « qu'est-ce que je peux faire maintenant ? » : rejoindre une séance,
// accepter une demande, relancer un coéquipier, valider la streak.

export default function SocialScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { user, refetch: refetchUser } = useUser();
  const myId = useMyId();
  const { addBonusXp } = useWorkoutLogs();
  const [segment, setSegment] = useState('friends');

  // ─── Tutorial (chapitre Social) ──────────────────────────────────────────────
  const { pendingChapterId, activeChapterId, startChapter } = useTutorial();
  const { ref: segmentsRef, onLayout: onSegmentsLayout } = useTutorialTarget('social_segments');

  // ── Données ──
  const [friends,      setFriends]      = useState([]);
  const [pending,      setPending]      = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [group,        setGroup]        = useState(null);
  const [groupInvites, setGroupInvites] = useState([]);
  const [multiInvites, setMultiInvites] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [loadError,    setLoadError]    = useState(false);

  // ── Ajout d'ami par tag exact "Pseudo#1234" ──
  const [addFriendVisible, setAddFriendVisible] = useState(false);
  const [searching,    setSearching]    = useState(false);
  const [searchError,  setSearchError]  = useState('');
  const [previewResult, setPreviewResult] = useState(null);

  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);

  // ── Célébration montée de niveau d'amitié ──────────────────────────────────
  // Comparaison du niveau d'amitié de chaque ami entre deux chargements : toute
  // hausse (validation de streak de groupe) est mise en file et célébrée une
  // par une. Le tout premier chargement mémorise sans célébrer (même garde que
  // LevelUpCelebration.js).
  const previousFriendshipLevels = useRef(new Map());
  const [levelUpQueue, setLevelUpQueue]   = useState([]);
  const [activeLevelUp, setActiveLevelUp] = useState(null);

  // ── Popup "objet Unique à réclamer" (streak de groupe 30j à 5 membres) ────
  const [bloodSangUnlockedVisible, setBloodSangUnlockedVisible] = useState(false);

  const myTag = user?.pseudo && user?.discriminator ? `${user.pseudo}#${user.discriminator}` : null;

  const loadAll = useCallback(async () => {
    try {
      const [friendsRes, pendingRes, groupRes, invitesRes] = await Promise.all([
        getFriendsList(), getPendingRequests(), getMyGroup(),
        getLobbyInvites().catch(() => ({ invites: [] })),
      ]);
      const incomingFriends = friendsRes.friends ?? [];
      const newlyLeveledUp = [];
      for (const f of incomingFriends) {
        const prevLevel = previousFriendshipLevels.current.get(f.friendshipId);
        if (prevLevel !== undefined && f.friendshipLevel > prevLevel) {
          newlyLeveledUp.push({ pseudo: f.user.pseudo, level: f.friendshipLevel });
        }
        previousFriendshipLevels.current.set(f.friendshipId, f.friendshipLevel);
      }
      if (newlyLeveledUp.length > 0) setLevelUpQueue((q) => [...q, ...newlyLeveledUp]);

      setFriends(incomingFriends);
      setPending(pendingRes.requests ?? []);
      setSentRequests(pendingRes.sent ?? []);
      setGroup(groupRes.group ?? null);
      setGroupInvites(groupRes.invites ?? []);
      setMultiInvites(invitesRes.invites ?? []);
      setLoadError(false);
    } catch (error) {
      if (!error.isSessionExpired) setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Défile la file un item à la fois — jamais deux modales superposées.
  useEffect(() => {
    if (!activeLevelUp && levelUpQueue.length > 0) {
      setActiveLevelUp(levelUpQueue[0]);
      setLevelUpQueue((q) => q.slice(1));
    }
  }, [activeLevelUp, levelUpQueue]);

  // Le profil (mon id, mon tag) est nécessaire ici : sans lui, la ligne
  // « moi » du groupe proposait de me secouer moi-même.
  useFocusEffect(useCallback(() => {
    loadAll();
    if (!user) refetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAll]));

  useFocusEffect(
    useCallback(() => {
      if (pendingChapterId === 'social') {
        const t = setTimeout(() => startChapter('social'), 400);
        return () => clearTimeout(t);
      }
    }, [pendingChapterId, startChapter]),
  );

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  // Recherche déclenchée depuis AddFriendModal (tag exact, jamais au fil de la
  // frappe, pour éviter d'ajouter la mauvaise personne).
  const onSearchTag = async (fullTag) => {
    setSearchError('');
    setSearching(true);
    try {
      const res = await searchUsers(fullTag);
      const found = (res.results ?? [])[0];
      if (found) {
        setPreviewResult(found);
        setAddFriendVisible(false);
      } else {
        setSearchError('Aucun athlète ne correspond à ce tag.');
      }
    } catch (error) {
      setSearchError(getErrorMessage(error, 'Recherche impossible.'));
    } finally {
      setSearching(false);
    }
  };

  const doAction = async (fn, successMsg) => {
    try {
      await fn();
      if (successMsg) showToast(successMsg, 'success');
      loadAll();
    } catch (error) {
      if (error.isSessionExpired) return;
      showToast(getErrorMessage(error, 'L\'action n\'a pas abouti. Réessaie dans un instant.'), 'error');
    }
  };

  const shareTag = useCallback(async () => {
    if (!myTag) return;
    try {
      await Share.share({ message: `Ajoute-moi sur Athly pour s'entraîner ensemble : ${myTag}` });
    } catch (_) { /* partage annulé */ }
  }, [myTag]);

  // ── Multi : lancer ou rejoindre une séance d'équipe ──
  const startMulti = useCallback(() => {
    navigation.navigate('Séances', { screen: 'WorkoutList', params: { openMulti: Date.now() } });
  }, [navigation]);

  const joinMulti = useCallback((lobbyId) => {
    navigation.navigate('Séances', { screen: 'WorkoutList', params: { pendingLobbyId: lobbyId } });
  }, [navigation]);

  const ignoreMulti = useCallback((lobbyId) => {
    setMultiInvites((list) => list.filter((i) => String(i.lobbyId) !== String(lobbyId)));
    declineLobbyInvite(lobbyId).catch(() => {});
  }, []);

  const badges = {
    friends: pending.length + multiInvites.length,
    group: groupInvites.length,
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title} accessibilityRole="header">Social</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ajouter un ami"
          style={styles.headerBtn}
          onPress={() => setAddFriendVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Segments ── */}
      <View
        ref={segmentsRef}
        onLayout={onSegmentsLayout}
        collapsable={false}
        style={styles.segmentRow}
        accessibilityRole="tablist"
      >
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          const badge = badges[s.key] || 0;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setSegment(s.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={badge > 0 ? `${s.label}, ${badge} en attente` : s.label}
            >
              <Text style={[styles.segmentTxt, active && styles.segmentTxtActive]} numberOfLines={1}>{s.label}</Text>
              {badge > 0 && (
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
          {loadError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="cloud-offline-outline" size={18} color={Colors.warningAmber} />
              <Text style={styles.errorTxt}>Connexion impossible pour le moment. Tire l'écran vers le bas pour réessayer.</Text>
            </View>
          ) : null}

          {segment === 'friends' && (
            <FriendsSegment
              friends={friends}
              pending={pending}
              sentRequests={sentRequests}
              multiInvites={multiInvites}
              myTag={myTag}
              onShareTag={shareTag}
              onOpenAddFriend={() => setAddFriendVisible(true)}
              onStartMulti={startMulti}
              onJoinMulti={joinMulti}
              onIgnoreMulti={ignoreMulti}
              onAccept={(id)  => doAction(() => acceptFriendRequest(id), 'Vous êtes maintenant amis !')}
              onDecline={(id) => doAction(() => declineFriendRequest(id))}
              onCancelSent={(id) => doAction(() => cancelFriendRequest(id), 'Demande annulée.')}
              onOpenProfile={(f) => navigation.navigate('FriendProfile', {
                friendId: f.user._id, pseudo: f.user.pseudo, friendshipLevel: f.friendshipLevel, friendshipId: f.friendshipId,
              })}
            />
          )}

          {segment === 'leaderboard' && (
            <LeaderboardSegment hasFriends={friends.length > 0} onOpenAddFriend={() => setAddFriendVisible(true)} />
          )}

          {segment === 'group' && (
            <GroupSegment
              group={group}
              myId={myId}
              invites={groupInvites}
              friends={friends}
              onInvite={(ids, name) => doAction(() => inviteToGroup(ids, name), 'Invitations envoyées à ton groupe.')}
              onRespond={(groupId, accept) =>
                doAction(() => respondToGroupInvite(groupId, accept), accept ? 'Bienvenue dans le groupe !' : null)}
              onShake={(groupId, memberId, pseudo) =>
                doAction(() => shakeMember(groupId, memberId), `${pseudo} a été secoué !`)}
              onCheckStreak={async (groupId) => {
                try {
                  const res = await checkGroupStreak(groupId);
                  if (res.allValidated) {
                    showToast(`Streak validée : jour ${res.currentStreak} ! +${res.groupBonus?.bonusXp ?? 0} XP`, 'success');
                    // Le bonus XP peut faire franchir un palier : on recharge le
                    // profil (LevelUpCelebration) et on pousse le gain dans les
                    // logs locaux pour que le Profil se mette à jour tout de suite.
                    refetchUser();
                    if (res.groupBonus?.bonusXp > 0) addBonusXp('Bonus de groupe', res.groupBonus.bonusXp);
                    if (res.bloodSangUnlocked) setBloodSangUnlockedVisible(true);
                  } else if (res.alreadyValidated) {
                    showToast('La streak du groupe est déjà validée aujourd\'hui.', 'success');
                  } else {
                    showToast('Il manque encore la séance de certains membres pour valider la journée.', 'info');
                  }
                  loadAll();
                } catch (error) {
                  if (!error.isSessionExpired) showToast(getErrorMessage(error, 'La validation de la streak n\'a pas abouti. Réessaie dans un instant.'), 'error');
                }
              }}
              onLeaveGroup={() => setLeaveConfirmVisible(true)}
            />
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <ConfirmModal
        visible={leaveConfirmVisible}
        icon="exit-outline"
        title="Quitter le groupe ?"
        body="Tu perdras l'accès à la streak collective de ce groupe. Pour revenir, un membre devra t'inviter à nouveau."
        confirmLabel="Quitter le groupe"
        cancelLabel="Annuler"
        destructive
        onConfirm={() => {
          setLeaveConfirmVisible(false);
          doAction(() => leaveGroup(), 'Tu as quitté le groupe.');
        }}
        onCancel={() => setLeaveConfirmVisible(false)}
      />

      <ConfirmModal
        visible={bloodSangUnlockedVisible}
        icon="color-palette"
        title="Couleur Unique débloquée !"
        body="Ton groupe a tenu 30 jours de streak à 5. La couleur de cadre « Rouge Sang » t'attend dans ton inventaire : va la réclamer."
        confirmLabel="Voir mon inventaire"
        cancelLabel="Plus tard"
        onConfirm={() => {
          setBloodSangUnlockedVisible(false);
          navigation.navigate('ProfileTab', { screen: 'Inventory' });
        }}
        onCancel={() => setBloodSangUnlockedVisible(false)}
      />

      <FriendshipLevelUpModal
        visible={!!activeLevelUp}
        pseudo={activeLevelUp?.pseudo}
        level={activeLevelUp?.level}
        onClose={() => setActiveLevelUp(null)}
      />

      <AddFriendModal
        visible={addFriendVisible}
        myTag={myTag}
        searching={searching}
        error={searchError}
        onSearch={onSearchTag}
        onClose={() => { setAddFriendVisible(false); setSearchError(''); }}
      />

      <FriendPreviewModal
        visible={!!previewResult}
        result={previewResult}
        onSend={async () => {
          await doAction(() => sendFriendRequest(previewResult.user._id), 'Demande d\'ami envoyée.');
          setPreviewResult((prev) => prev && { ...prev, relationStatus: 'pending_sent' });
        }}
        onClose={() => setPreviewResult(null)}
      />

      {activeChapterId === 'social' && (
        <TutorialOverlay navigation={navigation} />
      )}
    </View>
  );
}

// ═══ Segment Amis ═════════════════════════════════════════════════════════════

function FriendsSegment({
  friends, pending, sentRequests, multiInvites, myTag, onShareTag, onOpenAddFriend,
  onStartMulti, onJoinMulti, onIgnoreMulti, onAccept, onDecline, onCancelSent, onOpenProfile,
}) {
  return (
    <>
      {/* ── Invitations à une séance Multi (en premier : c'est maintenant) ── */}
      {multiInvites.map((inv) => (
        <View key={String(inv.lobbyId)} style={styles.liveCard}>
          <View style={styles.liveHead}>
            <View style={styles.liveDot} />
            <Text style={styles.liveKicker}>Séance Multi</Text>
          </View>
          <Text style={styles.liveTitle}>
            {inv.from?.pseudo ?? 'Un ami'} t'invite à s'entraîner ensemble
          </Text>
          <Text style={styles.liveMeta}>
            {inv.memberCount} joueur{inv.memberCount > 1 ? 's' : ''} dans le salon · bonus d'XP pour toute l'équipe
          </Text>
          <View style={styles.liveBtns}>
            <TouchableOpacity accessibilityRole="button" style={styles.ghostBtn} onPress={() => onIgnoreMulti(inv.lobbyId)} activeOpacity={0.8}>
              <Text style={styles.ghostBtnTxt}>Ignorer</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryBtn} onPress={() => onJoinMulti(inv.lobbyId)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnTxt}>Rejoindre</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* ── S'entraîner ensemble ── */}
      {friends.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={onStartMulti}
          style={({ pressed }) => [styles.multiCard, pressed && styles.pressed]}
        >
          <View style={styles.multiIcon}>
            <Ionicons name="people" size={22} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.multiTitle}>S'entraîner ensemble</Text>
            <Text style={styles.multiSub}>Lance une séance Multi : +15 % d'XP à 2, jusqu'à +50 % à 5.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.chevron} />
        </Pressable>
      ) : null}

      {/* ── Demandes d'amis reçues ── */}
      {pending.length > 0 && (
        <>
          <SectionTitle title="Demandes d'amis" count={pending.length} />
          {pending.map((req) => (
            <View key={req._id} style={styles.card}>
              <PlayerLine user={req.requester} />
              <View style={styles.requestBtns}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Refuser la demande de ${req.requester?.pseudo ?? 'cet athlète'}`}
                  style={styles.ghostBtn}
                  onPress={() => onDecline(req._id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ghostBtnTxt}>Refuser</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Accepter la demande de ${req.requester?.pseudo ?? 'cet athlète'}`}
                  style={styles.primaryBtn}
                  onPress={() => onAccept(req._id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnTxt}>Accepter</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* ── Mes amis ── */}
      {friends.length === 0 ? (
        <View style={[styles.card, styles.emptyCard]}>
          <View style={styles.emptyIcon}><Ionicons name="people" size={26} color={Colors.primary} /></View>
          <Text style={styles.emptyTitle}>Entraîne-toi avec tes amis</Text>
          <Text style={styles.emptyBody}>
            Ajoute un ami avec son tag pour comparer vos progrès, former un groupe de streak et lancer des séances à plusieurs.
          </Text>
          <TouchableOpacity accessibilityRole="button" style={[styles.primaryBtn, styles.emptyBtn]} onPress={onOpenAddFriend} activeOpacity={0.85}>
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.primaryBtnTxt}>Ajouter un ami</Text>
          </TouchableOpacity>
          {myTag ? (
            <TouchableOpacity accessibilityRole="button" style={styles.tagRow} onPress={onShareTag} activeOpacity={0.8}>
              <Text style={styles.tagLabel}>Ton tag : </Text>
              <Text style={styles.tagValue}>{myTag}</Text>
              <Ionicons name="share-outline" size={15} color={Colors.primary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <>
          <SectionTitle
            title="Mes amis"
            count={friends.length}
            action={myTag ? { label: 'Partager mon tag', icon: 'share-outline', onPress: onShareTag } : null}
          />
          <View style={styles.listCard}>
            {friends.map((f, i) => {
              const title = getFriendshipTitle(f.friendshipLevel);
              return (
                <Pressable
                  key={f.user._id}
                  accessibilityRole="button"
                  accessibilityLabel={`${f.user.pseudo}, niveau ${f.user.level ?? 1}, ${title.label}. Voir son profil`}
                  onPress={() => onOpenProfile(f)}
                  style={({ pressed }) => [styles.listRow, i > 0 && styles.listRowBorder, pressed && styles.pressed]}
                >
                  <PlayerLine
                    user={f.user}
                    extra={(
                      <View style={styles.friendshipLine}>
                        <Ionicons name="heart" size={11} color="#FF4D6D" />
                        <Text style={styles.friendshipTxt} numberOfLines={1}>{` ${f.friendshipLevel ?? 1}/5 · ${title.label}`}</Text>
                      </View>
                    )}
                  />
                  <Ionicons name="chevron-forward" size={17} color={Colors.chevron} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* ── Demandes envoyées ── */}
      {(sentRequests ?? []).length > 0 && (
        <>
          <SectionTitle title="Demandes envoyées" count={sentRequests.length} />
          <View style={styles.listCard}>
            {sentRequests.map((req, i) => (
              <View key={req._id} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                <PlayerLine user={req.recipient} meta="En attente de réponse" />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Annuler la demande envoyée à ${req.recipient?.pseudo ?? 'cet athlète'}`}
                  onPress={() => onCancelSent(req._id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.linkTxt}>Annuler</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

// ═══ Segment Classement ═══════════════════════════════════════════════════════

function LeaderboardSegment({ hasFriends, onOpenAddFriend }) {
  const [mode, setMode] = useState('xp');        // 'xp' | 'records'
  const [period, setPeriod] = useState('week');  // 'week' | 'all'

  if (!hasFriends) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <View style={styles.emptyIcon}><Ionicons name="podium" size={24} color={Colors.primary} /></View>
        <Text style={styles.emptyTitle}>Compare-toi à tes amis</Text>
        <Text style={styles.emptyBody}>
          Le classement se remplit avec tes amis : XP de la semaine, XP totale et records par exercice.
        </Text>
        <TouchableOpacity accessibilityRole="button" style={[styles.primaryBtn, styles.emptyBtn]} onPress={onOpenAddFriend} activeOpacity={0.85}>
          <Ionicons name="person-add" size={16} color="#fff" />
          <Text style={styles.primaryBtnTxt}>Ajouter un ami</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View style={styles.pillRow} accessibilityRole="tablist">
        <Pill label="XP" active={mode === 'xp'} onPress={() => setMode('xp')} />
        <Pill label="Records" active={mode === 'records'} onPress={() => setMode('records')} />
      </View>

      {mode === 'xp' ? (
        <>
          <View style={styles.subPillRow}>
            <SubPill label="Cette semaine" active={period === 'week'} onPress={() => setPeriod('week')} />
            <SubPill label="Depuis le début" active={period === 'all'} onPress={() => setPeriod('all')} />
          </View>
          <XpLeaderboard period={period} />
        </>
      ) : (
        <RecordsLeaderboard />
      )}
    </>
  );
}

function XpLeaderboard({ period }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(false);
    getLeaderboard(period)
      .then((res) => { if (!cancelled) setRows(res.leaderboard ?? []); })
      .catch(() => { if (!cancelled) { setRows([]); setError(true); } });
    return () => { cancelled = true; };
  }, [period]);

  if (rows === null) return <View style={styles.inlineLoading}><ActivityIndicator color={Colors.primary} /></View>;
  if (error) return <Text style={styles.emptySmall}>Classement indisponible pour le moment.</Text>;

  const valueOf = (e) => (period === 'week' ? (e.weeklyXp ?? 0) : (e.user.xp ?? 0));
  const nobodyThisWeek = period === 'week' && rows.every((e) => valueOf(e) === 0);

  return (
    <>
      <Text style={styles.caption}>
        {period === 'week'
          ? 'XP gagnée en séance depuis lundi. Tout le monde repart de zéro chaque semaine.'
          : 'XP totale cumulée depuis l\'inscription.'}
      </Text>

      {nobodyThisWeek ? (
        <View style={[styles.card, styles.emptyCardSmall]}>
          <Ionicons name="flash-outline" size={22} color={Colors.textMuted} />
          <Text style={styles.emptyBodySmall}>Personne n'a encore gagné d'XP cette semaine. Une séance suffit pour prendre la tête !</Text>
        </View>
      ) : (
        <>
          <Podium entries={rows.slice(0, 3)} valueOf={valueOf} />
          {rows.length > 3 ? (
            <View style={styles.listCard}>
              {rows.slice(3).map((e, i) => (
                <BoardRow key={e.user._id} entry={e} first={i === 0} value={`${formatNumber(valueOf(e))} XP`}
                  sub={period === 'week' && e.weeklySessions ? `${e.weeklySessions} séance${e.weeklySessions > 1 ? 's' : ''}` : null} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </>
  );
}

function Podium({ entries, valueOf }) {
  // Ordre visuel 2 · 1 · 3, hauteurs décroissantes.
  const order = [1, 0, 2];
  const heights = [84, 62, 48];
  return (
    <View style={styles.podiumRow}>
      {order.map((idx) => {
        const e = entries[idx];
        if (!e) return <View key={idx} style={{ flex: 1 }} />;
        const color = MEDAL_COLORS[idx];
        return (
          <View key={e.user._id} style={styles.podiumCol} accessible accessibilityLabel={`${idx + 1}e : ${e.user.pseudo}, ${formatNumber(valueOf(e))} XP`}>
            <UserAvatar user={e.user} size={idx === 0 ? 60 : 50} />
            <Text style={[styles.podiumPseudo, e.isMe && { color: Colors.primary }]} numberOfLines={1}>
              {e.isMe ? 'Toi' : e.user.pseudo}
            </Text>
            <Text style={styles.podiumXp}>{formatNumber(valueOf(e))} XP</Text>
            <View style={[styles.podiumBar, { height: heights[idx], backgroundColor: `${color}1F`, borderColor: `${color}66` }]}>
              <Text style={[styles.podiumPos, { color }]}>{idx + 1}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function BoardRow({ entry, first, value, sub }) {
  return (
    <View style={[styles.listRow, !first && styles.listRowBorder, entry.isMe && styles.meRow]}>
      <Text style={styles.boardPos}>{entry.position}</Text>
      <UserAvatar user={entry.user} size={36} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.boardPseudo, entry.isMe && { color: Colors.primary }]} numberOfLines={1}>
          {entry.isMe ? `${entry.user.pseudo} (toi)` : entry.user.pseudo}
        </Text>
        {sub ? <Text style={styles.boardSub}>{sub}</Text> : null}
      </View>
      <Text style={styles.boardValue}>{value}</Text>
    </View>
  );
}

// ── Classement par exercice (records du réseau d'amis) ─────────────────────────

function RecordsLeaderboard() {
  const [exercise, setExercise] = useState(MAJOR_EXERCISES[0].name);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getExerciseLeaderboard(exercise)
      .then((res) => { if (!cancelled) setRows(res.leaderboard ?? []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [exercise]);

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Exercice : ${exercise}. Changer d'exercice`}
        style={styles.exercisePicker}
        onPress={() => setPickerVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="barbell" size={16} color={Colors.primary} />
        <Text style={styles.exercisePickerTxt} numberOfLines={1}>{exercise}</Text>
        <Text style={styles.linkTxt}>Changer</Text>
      </TouchableOpacity>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exoChipRow}>
        {MAJOR_EXERCISES.map((exo) => (
          <SubPill key={exo.name} label={exo.name} active={exo.name === exercise} onPress={() => setExercise(exo.name)} />
        ))}
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible}
        value={exercise}
        onSelect={setExercise}
        onClose={() => setPickerVisible(false)}
      />

      {loading ? (
        <View style={styles.inlineLoading}><ActivityIndicator color={Colors.primary} /></View>
      ) : rows.length === 0 ? (
        <View style={[styles.card, styles.emptyCardSmall]}>
          <Ionicons name="barbell-outline" size={22} color={Colors.textMuted} />
          <Text style={styles.emptyBodySmall}>Aucun record sur cet exercice dans ton réseau. Sois le premier à poser la barre !</Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          {rows.map((e, i) => (
            <BoardRow
              key={e.user._id}
              entry={e}
              first={i === 0}
              value={`${String(e.maxPoids).replace('.', ',')} kg`}
              sub={`${e.maxReps} rép.`}
            />
          ))}
        </View>
      )}
    </>
  );
}

// ═══ Segment Groupe ═══════════════════════════════════════════════════════════

function GroupSegment({ group, myId, invites, friends, onInvite, onRespond, onShake, onCheckStreak, onLeaveGroup }) {
  return (
    <>
      {invites.map((inv) => (
        <View key={inv._id} style={styles.liveCard}>
          <View style={styles.liveHead}>
            <Ionicons name="flame" size={14} color={Colors.primary} />
            <Text style={styles.liveKicker}>Groupe de streak</Text>
          </View>
          <Text style={styles.liveTitle}>Invitation à rejoindre « {inv.name || 'Groupe de streak'} »</Text>
          <View style={styles.liveBtns}>
            <TouchableOpacity accessibilityRole="button" style={styles.ghostBtn} onPress={() => onRespond(inv._id, false)} activeOpacity={0.8}>
              <Text style={styles.ghostBtnTxt}>Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryBtn} onPress={() => onRespond(inv._id, true)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnTxt}>Rejoindre</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {group ? (
        <GroupCard group={group} myId={myId} onShake={onShake} onCheckStreak={onCheckStreak} onLeaveGroup={onLeaveGroup} />
      ) : (
        <CreateGroup friends={friends} onInvite={onInvite} />
      )}
    </>
  );
}

function CreateGroup({ friends, onInvite }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName]     = useState('');
  const full = selectedIds.length >= MAX_GROUP - 1;

  const toggle = (id) => setSelectedIds((prev) => {
    if (prev.includes(id)) return prev.filter((x) => x !== id);
    return prev.length >= MAX_GROUP - 1 ? prev : [...prev, id];
  });

  return (
    <>
      <View style={styles.card}>
        <View style={styles.groupIntroHead}>
          <View style={styles.flameBox}><Ionicons name="flame" size={24} color={Colors.primary} /></View>
          <Text style={styles.cardTitle}>Crée ton groupe de streak</Text>
        </View>
        <Rule icon="people" text="Jusqu'à 5 amis, toi compris." />
        <Rule icon="checkmark-done" text="Chaque jour où tout le monde fait sa séance, la streak du groupe grimpe." />
        <Rule icon="trending-up" text="Plus le groupe est grand et régulier, plus le bonus d'XP augmente." />
      </View>

      {friends.length === 0 ? (
        <Text style={styles.emptySmall}>Ajoute d'abord des amis pour former un groupe.</Text>
      ) : (
        <>
          <SectionTitle title="Nom du groupe" />
          <TextInput
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Ex : Les Warriors"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            maxLength={40}
          />

          <SectionTitle title="Invite tes amis" count={`${selectedIds.length}/${MAX_GROUP - 1}`} />
          <View style={styles.listCard}>
            {friends.map((f, i) => {
              const selected = selectedIds.includes(f.user._id);
              const disabled = !selected && full;
              return (
                <Pressable
                  key={f.user._id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled }}
                  onPress={() => toggle(f.user._id)}
                  disabled={disabled}
                  style={({ pressed }) => [styles.listRow, i > 0 && styles.listRowBorder, pressed && styles.pressed, disabled && { opacity: 0.4 }]}
                >
                  <PlayerLine user={f.user} />
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? Colors.primary : Colors.borderDim} />
                </Pressable>
              );
            })}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.blockBtn, selectedIds.length === 0 && styles.blockBtnOff]}
            disabled={selectedIds.length === 0}
            onPress={() => { onInvite(selectedIds, groupName.trim() || undefined); setSelectedIds([]); setGroupName(''); }}
            activeOpacity={0.85}
          >
            <Ionicons name="flame" size={16} color="#fff" />
            <Text style={styles.primaryBtnTxt}>
              {selectedIds.length === 0 ? 'Choisis au moins un ami' : `Créer le groupe (${selectedIds.length + 1} membres)`}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );
}

// Barème de référence (miroir de computeGroupXpBonus côté backend).
const SIZE_SCALE = [1, 2, 3, 4, 5].map((n) => ({ n, multiplier: 1 + 0.35 * (n - 1) }));
const REGULARITY_SCALE = [0, 7, 14, 21, 28, 35, 42, 49, 56].map((days) => ({
  days,
  multiplier: 1 + Math.min(0.6, 0.08 * Math.floor(days / 7)),
}));
const fmtMult = (m) => `×${m.toFixed(2).replace('.', ',')}`;

// Météo des séances (getMyGroup → member.weatherStatus), en clair.
const WEATHER = {
  done:     { icon: 'checkmark-circle', color: Colors.valid,     label: 'Séance faite' },
  active:   { icon: 'flash',            color: '#FBBF24',        label: 'En pleine séance' },
  ready:    { icon: 'time-outline',     color: Colors.textSecondary, label: 'Pas encore entraîné aujourd\'hui' },
  sleeping: { icon: 'moon-outline',     color: Colors.textMuted, label: 'Pas encore venu aujourd\'hui' },
};

function GroupCard({ group, myId, onShake, onCheckStreak, onLeaveGroup }) {
  const [showDetail, setShowDetail] = useState(false);
  const members = group.members ?? [];
  const memberCount = members.length;
  const doneCount = members.filter((m) => m.weatherStatus === 'done').length;
  const allDone = memberCount > 0 && doneCount === memberCount;
  const missing = members.filter((m) => m.weatherStatus !== 'done').map((m) => (myId && m._id === myId ? 'toi' : m.pseudo));
  const xpBonus = group.xpBonus ?? { sizeMultiplier: 1, regularityMultiplier: 1, multiplier: 1 };
  const streak = group.currentStreak ?? 0;

  return (
    <>
      {/* ── En-tête : streak ── */}
      <View style={styles.card}>
        <View style={styles.groupHead}>
          <View style={styles.flameBox}><Ionicons name="flame" size={26} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{group.name || 'Groupe de streak'}</Text>
            <Text style={styles.groupMeta}>{memberCount} membre{memberCount > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.streakBox}>
            <Text style={styles.streakValue}>{streak}</Text>
            <Text style={styles.streakLabel}>jour{streak > 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* ── Aujourd'hui ── */}
        <View style={styles.todayBlock}>
          <View style={styles.todayHead}>
            <Text style={styles.todayTitle}>Aujourd'hui</Text>
            <Text style={styles.todayCount}>{doneCount}/{memberCount} séances faites</Text>
          </View>
          <View style={styles.todayTrack}>
            {members.map((m) => (
              <View key={m._id} style={[styles.todaySeg, m.weatherStatus === 'done' && styles.todaySegDone]} />
            ))}
          </View>
        </View>

        {(group.shameBreakers ?? []).length > 0 && (
          <View style={styles.shameBanner}>
            <Ionicons name="snow" size={16} color="#38BDF8" />
            <Text style={styles.shameTxt}>
              Streak cassée par{' '}
              <Text style={styles.shameNames}>{group.shameBreakers.map((b) => b.pseudo).join(', ')}</Text>
              . Le groupe repart, à vous de jouer !
            </Text>
          </View>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !allDone }}
          style={[styles.blockBtn, !allDone && styles.blockBtnOff]}
          onPress={() => onCheckStreak(group._id)}
          disabled={!allDone}
          activeOpacity={0.85}
        >
          <Ionicons name="flash" size={16} color={allDone ? '#fff' : Colors.textMuted} />
          <Text style={[styles.primaryBtnTxt, !allDone && { color: Colors.textMuted }]}>Valider la streak du jour</Text>
        </TouchableOpacity>
        <Text style={styles.validateHint}>
          {allDone
            ? 'Tout le monde a fait sa séance : valide pour faire grimper la streak.'
            : `En attente de : ${missing.join(', ')}.`}
        </Text>
      </View>

      {/* ── Membres ── */}
      <SectionTitle title="Membres" count={`${memberCount}/${MAX_GROUP}`} />
      <View style={styles.listCard}>
        {members.map((m, i) => {
          const isMe = !!myId && m._id === myId;
          const w = WEATHER[m.weatherStatus] ?? WEATHER.sleeping;
          const canShake = !isMe && (m.weatherStatus === 'ready' || m.weatherStatus === 'sleeping');
          const shaken = (group.shakenTodayByMe ?? []).includes(m._id);
          return (
            <View key={m._id} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
              <UserAvatar user={m} size={42} />
              <View style={{ flex: 1, marginLeft: 11 }}>
                <Text style={styles.playerName} numberOfLines={1}>{isMe ? `${m.pseudo} (toi)` : m.pseudo}</Text>
                <View style={styles.weatherLine}>
                  <Ionicons name={w.icon} size={13} color={w.color} />
                  <Text style={[styles.weatherTxt, { color: w.color }]} numberOfLines={1}>{w.label}</Text>
                </View>
              </View>
              {canShake ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={shaken ? `${m.pseudo} déjà secoué aujourd'hui` : `Secouer ${m.pseudo}`}
                  style={[styles.shakeBtn, shaken && styles.shakeBtnDone]}
                  onPress={() => onShake(group._id, m._id, m.pseudo)}
                  disabled={shaken}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.shakeTxt, shaken && { color: Colors.textMuted }]}>{shaken ? 'Secoué' : 'Secouer'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* ── Bonus d'XP ── */}
      <View style={styles.card}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: showDetail }}
          style={styles.bonusHead}
          onPress={() => setShowDetail((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Bonus d'XP du groupe</Text>
            <Text style={styles.groupMeta}>Appliqué à la validation de la streak</Text>
          </View>
          <Text style={styles.bonusValue}>{fmtMult(xpBonus.multiplier)}</Text>
          <Ionicons name={showDetail ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {showDetail && (
          <View style={styles.bonusDetail}>
            <View style={styles.bonusRow}>
              <Text style={styles.bonusLabel}>Taille ({memberCount} membre{memberCount > 1 ? 's' : ''})</Text>
              <Text style={styles.bonusRowValue}>{fmtMult(xpBonus.sizeMultiplier)}</Text>
            </View>
            <View style={styles.bonusRow}>
              <Text style={styles.bonusLabel}>Régularité ({streak} jour{streak > 1 ? 's' : ''} de streak)</Text>
              <Text style={styles.bonusRowValue}>{fmtMult(xpBonus.regularityMultiplier)}</Text>
            </View>
            <View style={styles.scaleWrap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.scaleTitle}>Taille</Text>
                {SIZE_SCALE.map((r) => (
                  <View key={r.n} style={styles.scaleRow}>
                    <Text style={[styles.scaleLabel, r.n === memberCount && styles.scaleActive]}>{r.n} membre{r.n > 1 ? 's' : ''}</Text>
                    <Text style={[styles.scaleValue, r.n === memberCount && styles.scaleActive]}>{fmtMult(r.multiplier)}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scaleTitle}>Régularité</Text>
                {REGULARITY_SCALE.map((r) => (
                  <View key={r.days} style={styles.scaleRow}>
                    <Text style={styles.scaleLabel}>{r.days === 0 ? '0 jour' : `${r.days}+ jours`}</Text>
                    <Text style={styles.scaleValue}>{fmtMult(r.multiplier)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity accessibilityRole="button" style={styles.leaveLink} onPress={() => onLeaveGroup(group._id)} activeOpacity={0.7}>
        <Text style={styles.leaveLinkTxt}>Quitter le groupe</Text>
      </TouchableOpacity>
    </>
  );
}

// ═══ Composants partagés ══════════════════════════════════════════════════════

function SectionTitle({ title, count, action }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
        {count != null ? <Text style={styles.sectionCount}>{`  ${count}`}</Text> : null}
      </Text>
      {action ? (
        <TouchableOpacity accessibilityRole="button" onPress={action.onPress} style={styles.sectionAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={action.icon} size={14} color={Colors.primary} />
          <Text style={styles.linkTxt}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function PlayerLine({ user, meta, extra }) {
  return (
    <View style={styles.playerLine}>
      <UserAvatar user={user} size={44} />
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Text style={styles.playerName} numberOfLines={1}>{user?.pseudo ?? '-'}</Text>
        <Text style={styles.playerMeta} numberOfLines={1}>
          {meta || `Niv. ${user?.level ?? 1} · ${user?.rank ?? 'Novice'}`}
        </Text>
        {extra}
      </View>
    </View>
  );
}

function Rule({ icon, text }) {
  return (
    <View style={styles.rule}>
      <Ionicons name={icon} size={15} color={Colors.primary} style={{ marginTop: 2 }} />
      <Text style={styles.ruleTxt}>{text}</Text>
    </View>
  );
}

function Pill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.pillTxt, active && styles.pillTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SubPill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.subPill, active && styles.subPillActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.subPillTxt, active && styles.subPillTxtActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgAbyss },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  headerBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardDeep, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16 },
  pressed: { opacity: 0.75 },

  // ── Segments (neutres, comme Stats) ──
  segmentRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, padding: 4,
    borderRadius: 14, backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 40, borderRadius: 10,
  },
  segmentBtnActive: { backgroundColor: 'rgba(255,255,255,0.10)' },
  segmentTxt:       { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  segmentTxtActive: { color: Colors.textPrimary, fontWeight: '800' },
  badge: {
    backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 14, marginBottom: 12,
    backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  errorTxt: { flex: 1, color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19 },

  // ── Cartes ──
  card: {
    backgroundColor: Colors.cardDeep, borderRadius: 18, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  listCard: {
    backgroundColor: Colors.cardDeep, borderRadius: 18, marginBottom: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  listRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  meRow: { backgroundColor: 'rgba(254,116,57,0.07)' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 10 },
  sectionTitle: { flex: 1, color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  sectionCount: { color: Colors.textMuted, fontSize: 15, fontWeight: '700' },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  linkTxt: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  caption: { color: Colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 14 },

  // ── Joueur ──
  playerLine: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  playerName: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: '700' },
  playerMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  friendshipLine: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  friendshipTxt: { color: Colors.textMuted, fontSize: 12.5, fontWeight: '600', flexShrink: 1 },

  // ── Boutons ──
  primaryBtn: {
    flex: 1, flexDirection: 'row', gap: 7, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary,
  },
  primaryBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  ghostBtn: {
    flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  ghostBtnTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  blockBtn: {
    flexDirection: 'row', gap: 7, alignSelf: 'stretch', height: 50, borderRadius: 14, marginTop: 16,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary,
  },
  blockBtnOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  requestBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },

  // ── Invitation en direct (Multi, groupe) ──
  liveCard: {
    borderRadius: 18, padding: 16, marginBottom: 12,
    backgroundColor: 'rgba(254,116,57,0.08)', borderWidth: 1, borderColor: 'rgba(254,116,57,0.35)',
  },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  liveKicker: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  liveTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  liveMeta: { color: Colors.textSecondary, fontSize: 13.5, marginTop: 4 },
  liveBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },

  // ── Multi ──
  multiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 18, marginBottom: 12,
    backgroundColor: Colors.cardDeep, borderWidth: 1, borderColor: 'rgba(254,116,57,0.30)',
  },
  multiIcon: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(254,116,57,0.14)',
  },
  multiTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  multiSub: { color: Colors.textSecondary, fontSize: 13.5, lineHeight: 18, marginTop: 2 },

  // ── États vides ──
  emptyCard: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 20 },
  emptyIcon: {
    width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(254,116,57,0.14)', marginBottom: 12,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: Colors.textSecondary, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  emptyBtn: { flex: 0, alignSelf: 'stretch', height: 48, marginTop: 18 },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 6 },
  tagLabel: { color: Colors.textMuted, fontSize: 14 },
  tagValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  emptyCardSmall: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyBodySmall: { flex: 1, color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  emptySmall: { color: Colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },
  inlineLoading: { paddingVertical: 30, alignItems: 'center' },

  // ── Classement ──
  pillRow: {
    flexDirection: 'row', padding: 4, borderRadius: 12, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pill: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: 'rgba(255,255,255,0.10)' },
  pillTxt: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  pillTxtActive: { color: Colors.textPrimary, fontWeight: '800' },
  subPillRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  subPill: {
    height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  subPillActive: { backgroundColor: `${Colors.primary}1F`, borderColor: `${Colors.primary}80` },
  subPillTxt: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  subPillTxtActive: { color: Colors.primary, fontWeight: '800' },

  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 14 },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumPseudo: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: '800', marginTop: 6 },
  podiumXp: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 1, marginBottom: 8, fontVariant: ['tabular-nums'] },
  podiumBar: {
    width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderBottomWidth: 0,
    alignItems: 'center', paddingTop: 8,
  },
  podiumPos: { fontSize: 22, fontWeight: '900' },

  boardPos: { width: 26, color: Colors.textMuted, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  boardPseudo: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  boardSub: { color: Colors.textMuted, fontSize: 12.5, marginTop: 1 },
  boardValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },

  exercisePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 50, paddingHorizontal: 14, borderRadius: 14, marginBottom: 4,
    backgroundColor: Colors.cardDeep, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  exercisePickerTxt: { flex: 1, color: Colors.textPrimary, fontSize: 15.5, fontWeight: '700' },
  exoChipRow: { gap: 8, paddingVertical: 10, paddingRight: 4 },

  // ── Groupe ──
  groupIntroHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  flameBox: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(254,116,57,0.14)',
  },
  rule: { flexDirection: 'row', gap: 10, marginTop: 8 },
  ruleTxt: { flex: 1, color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  input: {
    height: 50, borderRadius: 14, paddingHorizontal: 14,
    backgroundColor: Colors.cardDeep, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    color: Colors.textPrimary, fontSize: 15.5,
  },

  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  streakBox: { alignItems: 'center', minWidth: 56 },
  streakValue: { color: Colors.primary, fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  streakLabel: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '700', marginTop: -2 },

  todayBlock: { marginTop: 16 },
  todayHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  todayTitle: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: '700' },
  todayCount: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  todayTrack: { flexDirection: 'row', gap: 4 },
  todaySeg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
  todaySegDone: { backgroundColor: Colors.valid },
  validateHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  shameBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(56,189,248,0.08)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.30)',
    borderRadius: 12, padding: 10, marginTop: 14,
  },
  shameTxt: { flex: 1, color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  shameNames: { color: '#38BDF8', fontWeight: '800' },

  weatherLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  weatherTxt: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  shakeBtn: {
    height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center',
    backgroundColor: 'rgba(254,116,57,0.12)', borderWidth: 1, borderColor: 'rgba(254,116,57,0.40)',
  },
  shakeBtnDone: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.10)' },
  shakeTxt: { color: Colors.primary, fontSize: 14, fontWeight: '800' },

  bonusHead: { flexDirection: 'row', alignItems: 'center' },
  bonusValue: { color: Colors.gold, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  bonusDetail: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  bonusRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  bonusLabel: { color: Colors.textSecondary, fontSize: 14 },
  bonusRowValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  scaleWrap: { flexDirection: 'row', gap: 16, marginTop: 12 },
  scaleTitle: { color: Colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  scaleLabel: { color: Colors.textSecondary, fontSize: 13 },
  scaleValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  scaleActive: { color: Colors.gold, fontWeight: '800' },

  leaveLink: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 20, marginTop: 4 },
  leaveLinkTxt: { color: Colors.error, fontSize: 14.5, fontWeight: '700' },
});
