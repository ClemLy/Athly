import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import AppNavigator from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <StatusBar barStyle="light-content" />
          <AppNavigator />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
