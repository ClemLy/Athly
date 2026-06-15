import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen      from '../screens/Profile/ProfileScreen';
import EditProfileScreen  from '../screens/Profile/EditProfileScreen';
import RankRoadmapScreen  from '../screens/Profile/RankRoadmapScreen';
import TrophyRoomScreen   from '../screens/Profile/TrophyRoomScreen';
import SettingsScreen     from '../screens/Profile/SettingsScreen';
import { Colors } from '../constants/theme';

const Stack = createStackNavigator();

const HEADER_BG = Colors.bgAbyss;

export default function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: HEADER_BG,
          shadowColor: 'transparent',   // iOS — remove bottom border shadow
          elevation: 0,                  // Android — remove elevation shadow
        },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 17,
          letterSpacing: 0.2,
          color: Colors.textPrimary,
        },
        headerBackTitleVisible: false,
        headerShadowVisible: false,      // React Navigation v6 flat header
      }}
    >
      {/* ProfileMain gère son propre inset + fond — on cache le header natif */}
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Modifier le profil' }}
      />
      <Stack.Screen
        name="RankRoadmap"
        component={RankRoadmapScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TrophyRoom"
        component={TrophyRoomScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Réglages' }}
      />
    </Stack.Navigator>
  );
}
