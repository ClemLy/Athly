import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen             from '../screens/Auth/LoginScreen';
import RegisterScreen          from '../screens/Auth/RegisterScreen';
import EmailVerificationScreen from '../screens/Auth/EmailVerificationScreen';
import ForgotPasswordScreen    from '../screens/Auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Auth"              component={LoginScreen} />
      <Stack.Screen name="Register"          component={RegisterScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="ForgotPassword"    component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
