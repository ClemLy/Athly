import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { joinLobby } from '../../services';
import { navigate } from '../../navigation/navigationRef';
import LobbyInviteModal from './LobbyInviteModal';

// ─── LobbyInviteCheck ─────────────────────────────────────────────────────────
// À monter une fois dans l'arbre authentifié (AppNavigator), au même niveau
// que WeightReminderCheck / ActivityFeedModal. Écoute les notifications push
// `lobby_invite` (voir back/services/push.service.js) :
//  - reçue au premier plan  → popup custom "X t'invite..." (Rejoindre/Ignorer)
//  - tapée depuis l'arrière-plan/fermée → rejoint directement, sans popup
//    (l'utilisateur a déjà exprimé son intention en tapant la notification)

export default function LobbyInviteCheck() {
  const { userToken } = useAuth();
  const [invite, setInvite] = useState(null); // { lobbyId, fromPseudo }
  const joiningRef = useRef(false);

  const handleJoinLobby = useCallback(async (lobbyId) => {
    if (!lobbyId || joiningRef.current) return;
    joiningRef.current = true;
    try { await joinLobby(lobbyId); } catch (_) {}
    joiningRef.current = false;
    navigate('Séances', { screen: 'WorkoutList', params: { pendingLobbyId: lobbyId } });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !userToken) return undefined;

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification?.request?.content?.data;
      if (data?.type === 'lobby_invite' && data?.lobbyId) {
        setInvite({ lobbyId: data.lobbyId, fromPseudo: data.fromPseudo });
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.type === 'lobby_invite' && data?.lobbyId) {
        handleJoinLobby(data.lobbyId);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [userToken, handleJoinLobby]);

  const onJoin = useCallback(() => {
    const lobbyId = invite?.lobbyId;
    setInvite(null);
    handleJoinLobby(lobbyId);
  }, [invite, handleJoinLobby]);

  const onDismiss = useCallback(() => setInvite(null), []);

  return (
    <LobbyInviteModal
      visible={!!invite}
      fromPseudo={invite?.fromPseudo}
      onJoin={onJoin}
      onDismiss={onDismiss}
    />
  );
}
