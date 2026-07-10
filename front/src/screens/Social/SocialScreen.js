import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator, Animated, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useToast } from '../../context/ToastContext';
import { useUser } from '../../context/UserContext';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import FriendshipLevelUpModal from '../../components/social/FriendshipLevelUpModal';
import FriendPreviewModal from '../../components/social/FriendPreviewModal';
import AddFriendModal from '../../components/social/AddFriendModal';
import {
  searchUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  cancelFriendRequest, removeFriend,
  getFriendsList, getPendingRequests, getLeaderboard, getExerciseLeaderboard,
  getMyGroup, inviteToGroup, respondToGroupInvite, shakeMember, checkGroupStreak, leaveGroup,
} from '../../services/social.service';
import { MAJOR_EXERCISES } from '../../data/majorExercises';
import ExercisePickerModal from '../../components/social/ExercisePickerModal';
import TutorialOverlay from '../../components/tutorial/TutorialOverlay';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';

// Podium / classements : positions 1-3 affichées en médaille colorée plutôt
// qu'en emoji 🥇🥈🥉.
const MEDAL_COLORS = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

function MedalBadge({ position, size = 16 }) {
  const color = MEDAL_COLORS[position];
  if (!color) return null;
  return <Ionicons name="medal" size={size} color={color} />;
}

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
  const { user, refetch: refetchUser } = useUser();
  const { addBonusXp } = useWorkoutLogs();
  const [segment, setSegment] = useState('friends');

  // ─── Tutorial (chapitre Social) ──────────────────────────────────────────────
  const { pendingChapterId, activeChapterId, startChapter } = useTutorial();
  const { ref: segmentsRef, onLayout: onSegmentsLayout } = useTutorialTarget('social_segments');

  // ── Données ──
  const [friends,     setFriends]     = useState([]);
  const [pending,     setPending]     = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [group,       setGroup]       = useState(null);
  const [groupInvites, setGroupInvites] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  // ── Ajout d'ami par tag exact "Pseudo#1234" (Section III) ──
  // Point d'entrée unique : bouton "+ Ajouter un ami" → AddFriendModal
  // (pseudo + # séparés, affiche aussi mon propre tag) → un résultat trouvé
  // ferme AddFriendModal et ouvre la carte Preview (FriendPreviewModal).
  const [addFriendVisible, setAddFriendVisible] = useState(false);
  const [searching,    setSearching]    = useState(false);
  const [searchError,  setSearchError]  = useState('');
  const [previewResult, setPreviewResult] = useState(null);

  // ── Confirmation quitter le groupe ──
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);

  // ── Confirmation retrait d'un ami ──
  const [removeFriendTarget, setRemoveFriendTarget] = useState(null); // { friendshipId, pseudo }

  // ── Célébration montée de niveau d'amitié ──────────────────────────────────
  // Comparaison du niveau d'amitié de chaque ami entre deux loadAll() : toute
  // hausse détectée (déclenchée par une validation de streak de groupe) est
  // mise en file et célébrée une par une. Le tout premier chargement mémorise
  // sans célébrer (évite un faux déclenchement au démarrage — même garde que
  // LevelUpCelebration.js).
  const previousFriendshipLevels = useRef(new Map());
  const [levelUpQueue, setLevelUpQueue]   = useState([]);
  const [activeLevelUp, setActiveLevelUp] = useState(null);

  // ── Popup "objet Unique à réclamer" (streak de groupe 30j à 5 membres) ────
  const [bloodSangUnlockedVisible, setBloodSangUnlockedVisible] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [friendsRes, pendingRes, boardRes, groupRes] = await Promise.all([
        getFriendsList(), getPendingRequests(), getLeaderboard(), getMyGroup(),
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
      if (newlyLeveledUp.length > 0) {
        setLevelUpQueue((q) => [...q, ...newlyLeveledUp]);
      }

      setFriends(incomingFriends);
      setPending(pendingRes.requests ?? []);
      setSentRequests(pendingRes.sent ?? []);
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

  // Défile la file un item à la fois — jamais deux modales superposées.
  useEffect(() => {
    if (!activeLevelUp && levelUpQueue.length > 0) {
      setActiveLevelUp(levelUpQueue[0]);
      setLevelUpQueue((q) => q.slice(1));
    }
  }, [activeLevelUp, levelUpQueue]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  useFocusEffect(
    useCallback(() => {
      if (pendingChapterId === 'social') {
        const t = setTimeout(() => startChapter('social'), 400);
        return () => clearTimeout(t);
      }
    }, [pendingChapterId, startChapter]),
  );

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  // Recherche déclenchée depuis AddFriendModal, avec le tag déjà construit à
  // partir des 2 champs séparés (pseudo + # à 4 chiffres) — jamais au fil de
  // la frappe, pour éviter d'ajouter la mauvaise personne.
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
      setSearchError(error?.data?.message || 'Recherche impossible.');
    } finally {
      setSearching(false);
    }
  };

  // ── Actions amis ──
  const doAction = async (fn, successMsg) => {
    try {
      await fn();
      if (successMsg) showToast(successMsg, 'success');
      loadAll();
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
      <View
        ref={segmentsRef}
        onLayout={onSegmentsLayout}
        collapsable={false}
        style={styles.segmentRow}
      >
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
              sentRequests={sentRequests}
              onOpenAddFriend={() => setAddFriendVisible(true)}
              onAccept={(id)  => doAction(() => acceptFriendRequest(id), 'Vous êtes maintenant amis !')}
              onDecline={(id) => doAction(() => declineFriendRequest(id))}
              onCancelSent={(id) => doAction(() => cancelFriendRequest(id), 'Demande annulée.')}
              onRemoveFriend={(friendshipId, pseudo) => setRemoveFriendTarget({ friendshipId, pseudo })}
              onOpenProfile={(friend, friendshipLevel) =>
                navigation.navigate('FriendProfile', { friendId: friend._id, pseudo: friend.pseudo, friendshipLevel })}
            />
          )}

          {segment === 'leaderboard' && <LeaderboardSegment leaderboard={leaderboard} />}

          {segment === 'group' && (
            <GroupSegment
              group={group}
              myId={user?._id}
              invites={groupInvites}
              friends={friends}
              onInvite={(ids, name) => doAction(() => inviteToGroup(ids, name), 'Demande de Streak de Groupe envoyée')}
              onRespond={(groupId, accept) =>
                doAction(() => respondToGroupInvite(groupId, accept), accept ? 'Bienvenue dans le groupe !' : null)}
              onShake={(groupId, memberId, pseudo) =>
                doAction(() => shakeMember(groupId, memberId), `${pseudo} a été secoué !`)}
              onCheckStreak={async (groupId) => {
                try {
                  const res = await checkGroupStreak(groupId);
                  if (res.allValidated) {
                    showToast(`Streak jour ${res.currentStreak} ! +${res.groupBonus?.bonusXp ?? 0} XP (x${res.groupBonus?.multiplier ?? 1})`, 'success');
                    // Le bonus XP peut faire franchir un palier de niveau, refetch
                    // le profil global pour que LevelUpCelebration le détecte,
                    // et pousse le même gain dans les logs locaux pour que le
                    // Profil (calculé localement) se mette à jour immédiatement.
                    refetchUser();
                    if (res.groupBonus?.bonusXp > 0) {
                      addBonusXp('Bonus de groupe', res.groupBonus.bonusXp);
                    }
                    if (res.bloodSangUnlocked) setBloodSangUnlockedVisible(true);
                  } else if (res.alreadyValidated) {
                    showToast('Déjà validée aujourd\'hui', 'success');
                  } else {
                    showToast('Tous les membres n\'ont pas encore validé leur séance.', 'error');
                  }
                  loadAll();
                } catch (error) {
                  if (!error.isSessionExpired) showToast(error.data?.message || 'Erreur.', 'error');
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
        title="Quitter le groupe"
        body="Êtes-vous sûr de vouloir quitter le groupe ? Cette action est irréversible et tu perdras l'accès à la streak collective."
        confirmLabel="Quitter le groupe"
        cancelLabel="Annuler"
        destructive
        onConfirm={() => {
          setLeaveConfirmVisible(false);
          doAction(() => leaveGroup(), 'Vous avez quitté le groupe.');
        }}
        onCancel={() => setLeaveConfirmVisible(false)}
      />

      <ConfirmModal
        visible={!!removeFriendTarget}
        icon="person-remove-outline"
        title="Retirer cet ami ?"
        body={`${removeFriendTarget?.pseudo ?? 'Cette personne'} ne fera plus partie de tes amis. Vous pourrez vous réajouter plus tard si besoin.`}
        confirmLabel="Retirer"
        cancelLabel="Annuler"
        destructive
        onConfirm={() => {
          const target = removeFriendTarget;
          setRemoveFriendTarget(null);
          doAction(() => removeFriend(target.friendshipId), `${target.pseudo} a été retiré de tes amis.`);
        }}
        onCancel={() => setRemoveFriendTarget(null)}
      />

      <ConfirmModal
        visible={bloodSangUnlockedVisible}
        icon="color-palette"
        title="Couleur Unique débloquée !"
        body="Votre groupe a validé 30 jours de streak à 5 membres. La couleur de cadre « Rouge Sang » vous attend dans votre inventaire - direction le Sac pour la réclamer."
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
        myTag={user?.pseudo && user?.discriminator ? `${user.pseudo}#${user.discriminator}` : null}
        searching={searching}
        error={searchError}
        onSearch={onSearchTag}
        onClose={() => { setAddFriendVisible(false); setSearchError(''); }}
      />

      <FriendPreviewModal
        visible={!!previewResult}
        result={previewResult}
        onSend={async () => {
          await doAction(() => sendFriendRequest(previewResult.user._id), 'Invitation envoyée');
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
  friends, pending, sentRequests, onOpenAddFriend, onAccept, onDecline, onCancelSent, onRemoveFriend, onOpenProfile,
}) {
  return (
    <>
      {/* ── Point d'entrée unique pour ajouter un ami (Section III) ── */}
      <TouchableOpacity style={styles.addFriendBtn} onPress={onOpenAddFriend} activeOpacity={0.85}>
        <Ionicons name="person-add" size={17} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.addFriendBtnTxt}>Ajouter un nouvel ami</Text>
      </TouchableOpacity>

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

      {/* ── Demandes envoyées, en attente de réponse ── */}
      {(sentRequests ?? []).length > 0 && (
        <>
          <Text style={styles.sectionLabel}>DEMANDES ENVOYÉES</Text>
          {sentRequests.map((req, i) => (
            <AnimatedRow key={req._id} index={i}>
              <UserRow user={req.recipient}>
                <View style={styles.sentTagRow}>
                  <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.sentTag}>En attente</Text>
                </View>
                <SmallBtn label="" icon="close" color={Colors.error} onPress={() => onCancelSent(req._id)} />
              </UserRow>
            </AnimatedRow>
          ))}
        </>
      )}

      {/* ── Mes amis ── */}
      <Text style={styles.sectionLabel}>MES AMIS ({friends.length})</Text>
      {friends.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={34} color={Colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTxt}>Pas encore d'amis.{'\n'}Cherche un pseudo ci-dessus pour commencer !</Text>
        </View>
      ) : friends.map((f, i) => (
        <AnimatedRow key={f.user._id} index={i}>
          <TouchableOpacity activeOpacity={0.75} onPress={() => onOpenProfile(f.user, f.friendshipLevel)}>
            <UserRow user={f.user}>
              <FriendshipHearts level={f.friendshipLevel ?? 1} />
              <TouchableOpacity
                onPress={() => onRemoveFriend(f.friendshipId, f.user.pseudo)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 6 }}
              >
                <Ionicons name="person-remove-outline" size={17} color={Colors.textMuted} />
              </TouchableOpacity>
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
  const [mode, setMode] = useState('xp'); // 'xp' | 'records'

  return (
    <>
      {/* ── Bascule XP / Records ── */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'xp' && styles.modeBtnActive]}
          onPress={() => setMode('xp')}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={13} color={mode === 'xp' ? '#fff' : Colors.textMuted} />
          <Text style={[styles.modeTxt, mode === 'xp' && styles.modeTxtActive]}>XP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'records' && styles.modeBtnActive]}
          onPress={() => setMode('records')}
          activeOpacity={0.8}
        >
          <Ionicons name="barbell" size={13} color={mode === 'records' ? '#fff' : Colors.textMuted} />
          <Text style={[styles.modeTxt, mode === 'records' && styles.modeTxtActive]}>Records</Text>
        </TouchableOpacity>
      </View>

      {mode === 'xp' ? <XpLeaderboard leaderboard={leaderboard} /> : <RecordsLeaderboard />}
    </>
  );
}

function XpLeaderboard({ leaderboard }) {
  const podium = leaderboard.slice(0, 3);
  const rest   = leaderboard.slice(3);

  return (
    <>
      {leaderboard.length < 2 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="trophy-outline" size={36} color={Colors.textMuted} style={{ marginBottom: 10 }} />
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
                <Text style={[styles.boardPos, styles.boardPosTxt]}>#{entry.position}</Text>
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
      {/* ── Suggestions rapides + accès au catalogue complet (~100+ exercices) ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exoChipRow}>
        <TouchableOpacity
          style={[styles.exoChip, styles.exoChipMore]}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={13} color={Colors.primary} style={{ marginRight: 4 }} />
          <Text style={[styles.exoChipTxt, { color: Colors.primary, fontWeight: '800' }]}>Tous les exercices</Text>
        </TouchableOpacity>
        {MAJOR_EXERCISES.map((exo) => {
          const active = exo.name === exercise;
          return (
            <TouchableOpacity
              key={exo.name}
              style={[styles.exoChip, active && styles.exoChipActive]}
              onPress={() => setExercise(exo.name)}
              activeOpacity={0.8}
            >
              <Text style={[styles.exoChipTxt, active && styles.exoChipTxtActive]}>{exo.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible}
        value={exercise}
        onSelect={setExercise}
        onClose={() => setPickerVisible(false)}
      />

      {loading ? (
        <View style={styles.recordsLoading}><ActivityIndicator size="small" color={Colors.primary} /></View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="barbell-outline" size={36} color={Colors.textMuted} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTxt}>
            Aucun record sur cet exercice dans ton réseau.{'\n'}Sois le premier à poser la barre !
          </Text>
        </View>
      ) : rows.map((entry, i) => (
        <AnimatedRow key={entry.user._id} index={i}>
          <View style={[styles.boardRow, entry.isMe && styles.boardRowMe]}>
            <View style={styles.boardPos}>
              {entry.position <= 3
                ? <MedalBadge position={entry.position} size={17} />
                : <Text style={styles.boardPosTxt}>#{entry.position}</Text>}
            </View>
            <Text style={[styles.boardPseudo, entry.isMe && { color: Colors.primary }]}>
              {entry.user.pseudo}{entry.isMe ? ' (moi)' : ''}
            </Text>
            <Text style={styles.boardKg}>{entry.maxPoids} kg</Text>
            <Text style={styles.boardReps}>× {entry.maxReps}</Text>
          </View>
        </AnimatedRow>
      ))}
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
        <View style={styles.podiumMedal}>
          <MedalBadge position={entry.position} size={22} />
        </View>
      </Animated.View>
    </View>
  );
}

// ═══ Segment Groupe ═══════════════════════════════════════════════════════════

function GroupSegment({ group, myId, invites, friends, onInvite, onRespond, onShake, onCheckStreak, onLeaveGroup }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName]     = useState('');

  const toggle = (id) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <>
      {/* ── Invitations reçues ── */}
      {invites.map((inv) => (
        <View key={inv._id} style={styles.inviteCard}>
          <View style={styles.inviteTxtRow}>
            <Ionicons name="flame" size={15} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.inviteTxt}>
              Demande de Streak de Groupe : <Text style={{ fontWeight: '800' }}>{inv.name || 'Sans nom'}</Text>
            </Text>
          </View>
          <View style={styles.inviteBtns}>
            <SmallBtn label="Rejoindre" icon="checkmark" color={Colors.valid} onPress={() => onRespond(inv._id, true)} />
            <SmallBtn label="" icon="close" color={Colors.error} onPress={() => onRespond(inv._id, false)} />
          </View>
        </View>
      ))}

      {group ? (
        <GroupCard group={group} myId={myId} onShake={onShake} onCheckStreak={onCheckStreak} onLeaveGroup={onLeaveGroup} />
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
              <Text style={styles.sectionLabel}>SÉLECTIONNE TES AMIS</Text>
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

// Barème de référence (miroir de computeGroupXpBonus côté backend) : à taille
// et régularité fixées, quel multiplicateur peut-on espérer atteindre.
const SIZE_SCALE = [1, 2, 3, 4, 5].map((n) => ({ n, multiplier: 1 + 0.35 * (n - 1) }));
const REGULARITY_SCALE = [0, 7, 14, 21, 28, 35, 42, 49, 56].map((days) => ({
  days,
  multiplier: 1 + Math.min(0.6, 0.08 * Math.floor(days / 7)),
}));

function GroupCard({ group, myId, onShake, onCheckStreak, onLeaveGroup }) {
  const flame = useRef(new Animated.Value(1)).current;
  const [showScale, setShowScale] = useState(false);

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
  // xpBonus vient du backend (getMyGroup) — source de vérité pour le détail
  // taille/régularité. Fallback taille-seule si absent (réponse en cache ancienne).
  const xpBonus = group.xpBonus ?? { sizeMultiplier: 1 + 0.25 * (memberCount - 1), regularityMultiplier: 1, multiplier: 1 + 0.25 * (memberCount - 1) };

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Animated.View style={[styles.groupFlameWrap, { transform: [{ scale: flame }] }]}>
          <Ionicons name="flame" size={30} color={Colors.primary} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupName}>{group.name || 'Groupe de Streak'}</Text>
          <Text style={styles.groupStreak}>
            Streak : <Text style={{ color: Colors.primary, fontWeight: '800' }}>{group.currentStreak ?? 0} jours</Text>
          </Text>
        </View>
      </View>

      {/* ── Hall of Shame : reste affiché jusqu'à la prochaine streak validée ── */}
      {(group.shameBreakers ?? []).length > 0 && (
        <View style={styles.shameBanner}>
          <Ionicons name="snow" size={16} color="#38BDF8" />
          <Text style={styles.shameTxt}>
            Briseur{group.shameBreakers.length > 1 ? 's' : ''} de Streak actuel : {' '}
            <Text style={styles.shameNames}>
              {group.shameBreakers.map((b) => b.pseudo).join(', ')}
            </Text>
          </Text>
        </View>
      )}

      {/* ── Détail du multiplicateur d'XP ── */}
      <View style={styles.multiplierCard}>
        <View style={styles.multiplierHeader}>
          <Ionicons name="trending-up" size={14} color={Colors.gold} />
          <Text style={styles.multiplierTitle}>Multiplicateur d'XP</Text>
          <Text style={styles.multiplierTotal}>×{xpBonus.multiplier.toFixed(2)}</Text>
        </View>
        <View style={styles.multiplierRow}>
          <Ionicons name="people" size={13} color={Colors.textMuted} />
          <Text style={styles.multiplierLabel}>Taille du groupe ({memberCount} membres)</Text>
          <Text style={styles.multiplierValue}>×{xpBonus.sizeMultiplier.toFixed(2)}</Text>
        </View>
        <View style={styles.multiplierRow}>
          <Ionicons name="calendar" size={13} color={Colors.textMuted} />
          <Text style={styles.multiplierLabel}>Régularité ({group.currentStreak ?? 0}j de streak)</Text>
          <Text style={styles.multiplierValue}>×{xpBonus.regularityMultiplier.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.scaleToggle} onPress={() => setShowScale((v) => !v)} activeOpacity={0.75}>
          <Text style={styles.scaleToggleTxt}>{showScale ? 'Masquer le barème' : 'Voir le barème complet'}</Text>
          <Ionicons name={showScale ? 'chevron-up' : 'chevron-down'} size={13} color={Colors.gold} />
        </TouchableOpacity>

        {showScale && (
          <View style={styles.scaleWrap}>
            <View style={styles.scaleCol}>
              <Text style={styles.scaleColTitle}>Taille</Text>
              {SIZE_SCALE.map((row) => (
                <View key={row.n} style={styles.scaleRow}>
                  <Text style={styles.scaleRowLabel}>{row.n} {row.n > 1 ? 'membres' : 'membre'}</Text>
                  <Text style={styles.scaleRowValue}>×{row.multiplier.toFixed(2)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.scaleCol}>
              <Text style={styles.scaleColTitle}>Régularité</Text>
              {REGULARITY_SCALE.map((row) => (
                <View key={row.days} style={styles.scaleRow}>
                  <Text style={styles.scaleRowLabel}>{row.days === 0 ? '0 j' : `${row.days}+ j`}</Text>
                  <Text style={styles.scaleRowValue}>×{row.multiplier.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <Text style={styles.sectionLabel}>MEMBRES ({memberCount}/5)</Text>
      {(group.members ?? []).map((m) => {
        const isMe = myId && m._id === myId;
        const alreadyShaken = (group.shakenTodayByMe ?? []).includes(m._id);
        return (
          <UserRow key={m._id} user={m}>
            {!isMe && (
              <TouchableOpacity
                style={[styles.shakeBtn, alreadyShaken && styles.shakeBtnDisabled]}
                onPress={() => onShake(group._id, m._id, m.pseudo)}
                activeOpacity={alreadyShaken ? 1 : 0.8}
                disabled={alreadyShaken}
              >
                <Ionicons name="warning" size={12} color={alreadyShaken ? Colors.textMuted : Colors.error} style={{ marginRight: 4 }} />
                <Text style={[styles.shakeTxt, alreadyShaken && styles.shakeTxtDisabled]}>
                  {alreadyShaken ? 'Secoué' : 'Secouer'}
                </Text>
              </TouchableOpacity>
            )}
          </UserRow>
        );
      })}

      <TouchableOpacity style={styles.ctaBtn} onPress={() => onCheckStreak(group._id)} activeOpacity={0.85}>
        <Ionicons name="flash" size={16} color="#fff" style={{ marginRight: 7 }} />
        <Text style={styles.ctaTxt}>Valider la streak du jour</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.leaveBtn} onPress={() => onLeaveGroup(group._id)} activeOpacity={0.75}>
        <Ionicons name="exit-outline" size={15} color={Colors.error} style={{ marginRight: 6 }} />
        <Text style={styles.leaveBtnTxt}>Quitter le groupe</Text>
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

// Météo des séances : 4 états stricts remontés par le backend (getMyGroup)
// dans `member.weatherStatus`. Affiché uniquement quand présent (les listes
// amis/requêtes n'en portent pas — seuls les membres de groupe en ont un).
const WEATHER_META = {
  done:     { icon: 'checkmark-circle', color: '#22C55E', label: 'Séance validée' },
  active:   { icon: 'flash',            color: '#FBBF24', label: 'Séance active' },
  ready:    { icon: 'flame',            color: Colors.primary, label: 'Prêt' },
  sleeping: { icon: 'moon',             color: Colors.textMuted, label: 'En sommeil' },
};

function UserRow({ user, children }) {
  const weather = user?.weatherStatus ? WEATHER_META[user.weatherStatus] : null;
  return (
    <View style={styles.userRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarTxt}>{(user?.pseudo ?? '?').charAt(0).toUpperCase()}</Text>
        {weather && (
          <View style={styles.weatherBadge} accessibilityLabel={weather.label}>
            <Ionicons name={weather.icon} size={11} color={weather.color} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.userPseudo}>{user?.pseudo ?? '-'}</Text>
        <Text style={styles.userMeta}>
          Nv. {user?.level ?? 1} · {user?.rank ?? 'Novice'}
          {weather ? ` · ${weather.label}` : ''}
        </Text>
      </View>
      <View style={styles.userActions}>{children}</View>
    </View>
  );
}

function FriendshipHearts({ level }) {
  return (
    <View style={styles.hearts}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          key={i}
          name={i < level ? 'heart' : 'heart-outline'}
          size={11}
          color={i < level ? '#FF4D6D' : Colors.borderDim}
          style={{ marginLeft: i === 0 ? 0 : 1 }}
        />
      ))}
    </View>
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

  // ── Ajout d'ami ──
  addFriendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 13, height: 48, marginBottom: 4,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  addFriendBtnTxt: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  sentTagRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 },
  sentTag:    { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },

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
  weatherBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.cardDeep,
    borderWidth: 1.5, borderColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  userPseudo: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  userMeta:   { color: Colors.textMuted, fontSize: 11.5, marginTop: 1 },
  userActions:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  hearts:     { flexDirection: 'row', alignItems: 'center' },

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
  podiumMedal: { alignItems: 'center', justifyContent: 'center' },

  boardRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 12, paddingHorizontal: 14, height: 46, marginBottom: 7,
  },
  boardRowMe:  { borderColor: 'rgba(254,116,57,0.45)', backgroundColor: 'rgba(254,116,57,0.06)' },
  boardPos:    { width: 36 },
  boardPosTxt: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  boardPseudo: { flex: 1, color: Colors.textPrimary, fontSize: 13.5, fontWeight: '600' },
  boardXp:     { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '700' },
  boardKg:     { color: Colors.primary, fontSize: 13.5, fontWeight: '800' },
  boardReps:   { color: Colors.textMuted, fontSize: 11.5, fontWeight: '600', marginLeft: 4, width: 34 },

  // ── Bascule XP / Records ──
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 4 },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  modeBtnActive: { backgroundColor: Colors.secondaryAccent, borderColor: Colors.secondaryAccent },
  modeTxt:       { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  modeTxtActive: { color: '#fff' },

  // ── Chips d'exercices ──
  exoChipRow: { gap: 6, paddingVertical: 10, paddingRight: 4 },
  exoChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  exoChipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  exoChipMore:      { flexDirection: 'row', alignItems: 'center', borderColor: `${Colors.primary}50`, backgroundColor: `${Colors.primary}12` },
  exoChipTxt:       { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  exoChipTxtActive: { color: '#fff' },
  recordsLoading:   { paddingVertical: 30, alignItems: 'center' },

  // ── Groupe ──
  inviteCard: {
    backgroundColor: 'rgba(254,116,57,0.07)',
    borderWidth: 1, borderColor: 'rgba(254,116,57,0.30)',
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  inviteTxtRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inviteTxt:  { flex: 1, color: Colors.textPrimary, fontSize: 13.5, lineHeight: 19 },
  inviteBtns: { flexDirection: 'row', gap: 8 },

  groupCard: {
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 18, padding: 16, marginTop: 6,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupFlameWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(254,116,57,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  groupName:   { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  groupStreak: { color: Colors.textSecondary, fontSize: 12.5, marginTop: 3 },

  // ── Hall of Shame ──
  shameBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(56,189,248,0.10)',
    borderWidth:     1,
    borderColor:     'rgba(56,189,248,0.35)',
    borderRadius:    12,
    padding:         10,
    marginTop:       12,
    gap:             8,
  },
  shameTxt:   { color: Colors.textSecondary, fontSize: 12.5, flex: 1, lineHeight: 18 },
  shameNames: { color: '#38BDF8', fontWeight: '800' },

  // ── Détail multiplicateur ──
  multiplierCard: {
    backgroundColor: 'rgba(255,215,0,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.18)',
    borderRadius: 14, padding: 12, marginTop: 14,
  },
  multiplierHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  multiplierTitle:  { flex: 1, color: Colors.textPrimary, fontSize: 12.5, fontWeight: '700' },
  multiplierTotal:  { color: Colors.gold, fontSize: 14, fontWeight: '800' },
  multiplierRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  multiplierLabel:  { flex: 1, color: Colors.textMuted, fontSize: 11.5 },
  multiplierValue:  { color: Colors.textSecondary, fontSize: 11.5, fontWeight: '700' },

  scaleToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,215,0,0.18)',
  },
  scaleToggleTxt: { color: Colors.gold, fontSize: 11.5, fontWeight: '700' },
  scaleWrap: { flexDirection: 'row', gap: 14, marginTop: 12 },
  scaleCol:  { flex: 1 },
  scaleColTitle: {
    color: Colors.textMuted, fontSize: 10.5, fontWeight: '800',
    letterSpacing: 0.6, marginBottom: 6,
  },
  scaleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 3,
  },
  scaleRowLabel: { color: Colors.textSecondary, fontSize: 11.5 },
  scaleRowValue: { color: Colors.textPrimary, fontSize: 11.5, fontWeight: '700' },

  shakeBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,77,77,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,77,77,0.40)',
    borderRadius: 9, paddingHorizontal: 10, height: 32, justifyContent: 'center',
  },
  shakeBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: Colors.borderSubtle,
  },
  shakeTxt: { color: Colors.error, fontSize: 11.5, fontWeight: '800' },
  shakeTxtDisabled: { color: Colors.textMuted },

  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 42, borderRadius: 13, marginTop: 10,
    borderWidth: 1, borderColor: 'rgba(255,77,77,0.30)',
  },
  leaveBtnTxt: { color: Colors.error, fontSize: 13, fontWeight: '700' },

  selectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 12, padding: 12, marginBottom: 9,
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
  emptyTxt:   { color: Colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptySmall: { color: Colors.textMuted, fontSize: 12.5, marginTop: 8, marginLeft: 4 },
});
