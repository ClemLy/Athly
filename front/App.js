import React from 'react';
import { Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import AppNavigator from './src/navigation';
import DesktopInstallPage from './src/components/web/DesktopInstallPage';

const isDesktopWeb =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.innerWidth >= 768;

export default function App() {
  if (isDesktopWeb) {
    return <DesktopInstallPage />;
  }

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
