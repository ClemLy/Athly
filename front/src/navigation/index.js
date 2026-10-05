// ============================================================================
// AppNavigator : pile racine unique. Selon le token, elle expose les écrans
// d'authentification OU l'application (onglets), plus deux écrans communs :
// les pages légales et la page 404. Englobe les contextes globaux nécessaires
// aux deux côtés (logs de séances pour Stats / Profil).
// ============================================================================
import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, Platform } from 'react-native';

import BottomTabs from './BottomTabs';
import { navigationRef } from './navigationRef';
import { linking, documentTitle } from './linking';
import { screenTransition } from './transitions';

import { Colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { WorkoutLogsProvider } from '../context/WorkoutLogsContext';
import { SavedWorkoutsProvider } from '../context/SavedWorkoutsContext';
import { CustomExercisesProvider } from '../context/CustomExercisesContext';
import { QuestProvider } from '../context/QuestContext';
import { UserProvider } from '../context/UserContext';
import { TutorialProvider } from '../context/TutorialContext';
import { WorkoutInProgressProvider } from '../context/WorkoutInProgressContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupNotificationChannels, ensureDailyRemindersScheduled, getExpoPushToken } from '../services';
import { registerPushToken } from '../services';
import BirthdayCelebration from '../components/profile/BirthdayCelebration';
import LevelUpCelebration from '../components/profile/LevelUpCelebration';
import ActivityFeedModal from '../components/social/ActivityFeedModal';
import WeightReminderCheck from '../components/stats/WeightReminderCheck';
import LobbyInviteCheck from '../components/workouts/LobbyInviteCheck';

import LoginScreen             from '../screens/Auth/LoginScreen';
import RegisterScreen          from '../screens/Auth/RegisterScreen';
import EmailVerificationScreen from '../screens/Auth/EmailVerificationScreen';
import ForgotPasswordScreen    from '../screens/Auth/ForgotPasswordScreen';
import LegalScreen             from '../screens/Legal/LegalScreen';
import NotFoundScreen          from '../screens/System/NotFoundScreen';

const NOTIF_ENABLED_KEY = 'athly:notif:enabled:v1';

const Root = createStackNavigator();

// Thème de navigation sombre : évite tout flash blanc entre deux écrans
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.backgroundDeep,
    card: Colors.backgroundDeep,
    text: Colors.textPrimary,
    border: Colors.borderSubtle,
    notification: Colors.primary,
  },
};

// Application connectée : onglets + célébrations et vérifications globales
function MainApp() {
  return (
    <WorkoutInProgressProvider>
      <BirthdayCelebration />
      <LevelUpCelebration />
      <ActivityFeedModal />
      <WeightReminderCheck />
      <LobbyInviteCheck />
      <BottomTabs />
    </WorkoutInProgressProvider>
  );
}

function LoadingScreen() {
  return (
    <View
      style={{ flex: 1, backgroundColor: Colors.backgroundDeep, justifyContent: 'center', alignItems: 'center' }}
      accessibilityLabel="Chargement d'Athly"
    >
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

export default function AppNavigator() {
  const { userToken, isLoading } = useAuth();

  useEffect(() => {
    setupNotificationChannels();
    (async () => {
      try {
        const enabled = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
        if (enabled === 'true') await ensureDailyRemindersScheduled();
      } catch (_) {}
    })();
  }, []);

  // Enregistre le token Expo Push auprès du backend une fois connecté : c'est
  // ce qui permet aux notifications d'un AUTRE appareil (Secouer, réactions
  // du flux d'activité) d'atteindre réellement celui-ci. Best-effort : un
  // échec (permission refusée, web, hors ligne) ne bloque jamais l'app.
  useEffect(() => {
    if (!userToken || Platform.OS === 'web') return;
    (async () => {
      const token = await getExpoPushToken();
      if (token) {
        try { await registerPushToken(token); } catch (_) {}
      }
    })();
  }, [userToken]);

  if (isLoading) return <LoadingScreen />;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      linking={linking}
      documentTitle={documentTitle}
      fallback={<LoadingScreen />}
    >
      {/* key : à chaque connexion / déconnexion, tous les contextes repartent de
          zéro et relisent les données locales du compte actif. Aucune donnée
          d'un compte ne reste affichée après la déconnexion. */}
      <TutorialProvider key={userToken ? 'session' : 'guest'}>
        <UserProvider>
          <WorkoutLogsProvider>
            <SavedWorkoutsProvider>
              <CustomExercisesProvider>
                <QuestProvider>
                  <Root.Navigator
                    screenOptions={{
                      headerShown: false,
                      cardStyle: { backgroundColor: Colors.backgroundDeep },
                      ...screenTransition,
                    }}
                  >
                    {userToken === null ? (
                      <>
                        <Root.Screen name="Auth"              component={LoginScreen} />
                        <Root.Screen name="Register"          component={RegisterScreen} />
                        <Root.Screen name="EmailVerification" component={EmailVerificationScreen} />
                        <Root.Screen name="ForgotPassword"    component={ForgotPasswordScreen} />
                      </>
                    ) : (
                      <Root.Screen name="Main" component={MainApp} />
                    )}
                    <Root.Screen name="Legal"    component={LegalScreen} />
                    <Root.Screen name="NotFound" component={NotFoundScreen} />
                  </Root.Navigator>
                </QuestProvider>
              </CustomExercisesProvider>
            </SavedWorkoutsProvider>
          </WorkoutLogsProvider>
        </UserProvider>
      </TutorialProvider>
    </NavigationContainer>
  );
}
