import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SocialScreen        from '../screens/Social/SocialScreen';
import FriendProfileScreen from '../screens/Social/FriendProfileScreen';

const Stack = createStackNavigator();

// Les deux écrans gèrent leur propre header (fond abyss + chevron custom)
export default function SocialStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SocialHub"     component={SocialScreen} />
      <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
    </Stack.Navigator>
  );
}
