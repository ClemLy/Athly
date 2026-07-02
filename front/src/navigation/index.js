// ============================================================================
// AppNavigator : bascule Auth / App selon le token. Englobe les contextes globaux
// nécessaires aux deux côtés (logs de séances pour Stats / Profil).
// ============================================================================
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';

import AuthStack from './AuthStack';
import BottomTabs from './BottomTabs';

import { Colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { WorkoutLogsProvider } from '../context/WorkoutLogsContext';
import { SavedWorkoutsProvider } from '../context/SavedWorkoutsContext';
import { CustomExercisesProvider } from '../context/CustomExercisesContext';
import { QuestProvider } from '../context/QuestContext';
import { UserProvider } from '../context/UserContext';
import { TutorialProvider } from '../context/TutorialContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupNotificationChannels, ensureDailyRemindersScheduled } from '../services/notificationService';
import BirthdayCelebration from '../components/profile/BirthdayCelebration';

const NOTIF_ENABLED_KEY = 'athly:notif:enabled:v1';

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

  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <TutorialProvider>
        <UserProvider>
          <WorkoutLogsProvider>
            <SavedWorkoutsProvider>
              <CustomExercisesProvider>
                <QuestProvider>
                  {userToken === null ? <AuthStack /> : (
                    <>
                      <BirthdayCelebration />
                      <BottomTabs />
                    </>
                  )}
                </QuestProvider>
              </CustomExercisesProvider>
            </SavedWorkoutsProvider>
          </WorkoutLogsProvider>
        </UserProvider>
      </TutorialProvider>
    </NavigationContainer>
  );
}
