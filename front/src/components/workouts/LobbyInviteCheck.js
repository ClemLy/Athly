import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useWorkoutInProgress } from '../../context/WorkoutInProgressContext';
import { joinLobby, getLobbyInvites, declineLobbyInvite, Notifications } from '../../services';
import { navigate } from '../../navigation/navigationRef';
import LobbyInviteModal from './LobbyInviteModal';

const POLL_MS = 30000;

// ─── LobbyInviteCheck ─────────────────────────────────────────────────────────
// À monter une fois dans l'arbre authentifié (AppNavigator). Deux sources
// d'invitations Multi :
//  - les invitations enregistrées sur le serveur, interrogées toutes les 30 s
//    tant que l'app est au premier plan : elles marchent partout (web, Expo
//    Go, notifications coupées), là où le push seul n'arrivait jamais ;
//  - la notification push `lobby_invite` (si disponible) : reçue au premier
//    plan → même popup ; tapée depuis l'arrière-plan → rejoint directement.
// Pas de popup pendant une séance en cours : l'invitation reste visible dans
// l'écran Social.

export default function LobbyInviteCheck() {
  const { userToken } = useAuth();
  const { startedAt, state } = useWorkoutInProgress();
  const busy = !!startedAt || (state?.exercises?.length ?? 0) > 0;
  const [invite, setInvite] = useState(null); // { lobbyId, fromPseudo, memberCount }
  const handledRef = useRef(new Set());       // invitations déjà proposées
  const joiningRef = useRef(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const handleJoinLobby = useCallback(async (lobbyId) => {
    if (!lobbyId || joiningRef.current) return;
    joiningRef.current = true;
    try { await joinLobby(lobbyId); } catch (_) { /* le salon affichera l'erreur */ }
    joiningRef.current = false;
    navigate('Main', { screen: 'Séances', params: { screen: 'WorkoutList', params: { pendingLobbyId: lobbyId } } });
  }, []);

  const offer = useCallback((next) => {
    const id = String(next.lobbyId);
    if (handledRef.current.has(id) || busyRef.current) return;
    handledRef.current.add(id);
    setInvite((current) => current || { ...next, lobbyId: id });
  }, []);

  // ── Invitations serveur (sans notification) ──
  useEffect(() => {
    if (!userToken) return undefined;
    let timer = null;
    const check = async () => {
      try {
        const res = await getLobbyInvites();
        const first = (res.invites ?? [])[0];
        if (first) offer({ lobbyId: first.lobbyId, fromPseudo: first.from?.pseudo, memberCount: first.memberCount });
      } catch (_) { /* réseau : on réessaiera */ }
    };
    const start = () => { if (!timer) { check(); timer = setInterval(check, POLL_MS); } };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

    start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, [userToken, offer]);

  // ── Notifications push (si disponibles) ──
  useEffect(() => {
    // Notifications est null sur web et dans Expo Go Android (voir notificationService).
    if (!Notifications || !userToken) return undefined;

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification?.request?.content?.data;
      if (data?.type === 'lobby_invite' && data?.lobbyId) {
        offer({ lobbyId: data.lobbyId, fromPseudo: data.fromPseudo });
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.type === 'lobby_invite' && data?.lobbyId) {
        handledRef.current.add(String(data.lobbyId));
        handleJoinLobby(data.lobbyId);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [userToken, handleJoinLobby, offer]);

  const onJoin = useCallback(() => {
    const lobbyId = invite?.lobbyId;
    setInvite(null);
    handleJoinLobby(lobbyId);
  }, [invite, handleJoinLobby]);

  const onDismiss = useCallback(() => {
    const lobbyId = invite?.lobbyId;
    setInvite(null);
    if (lobbyId) declineLobbyInvite(lobbyId).catch(() => {});
  }, [invite]);

  return (
    <LobbyInviteModal
      visible={!!invite}
      fromPseudo={invite?.fromPseudo}
      memberCount={invite?.memberCount}
      onJoin={onJoin}
      onDismiss={onDismiss}
    />
  );
}
