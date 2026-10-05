import React from 'react';
import { Platform, StatusBar, View, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';

import AppNavigator from './src/navigation';
import DesktopInstallPage from './src/components/web/DesktopInstallPage';
import { ErrorBoundary } from './src/components/common';
import ConnectionBanner from './src/components/common/ConnectionBanner';
import { useWebLayout } from './src/hooks/useWebLayout';
import { Colors } from './src/constants/theme';

// Largeur maximale de l'app sur grand écran (tablette, ordinateur) : au-delà,
// elle est affichée en colonne centrée, comme sur un téléphone.
const APP_MAX_WIDTH = 480;

export default function App() {
  const { showInstallPage, openAppAnyway } = useWebLayout();
  const { width } = useWindowDimensions();

  if (showInstallPage) {
    return <DesktopInstallPage onOpenApp={openAppAnyway} />;
  }

  const framed = Platform.OS === 'web' && width > APP_MAX_WIDTH + 80;

  return (
    <ErrorBoundary>
      <View style={[styles.outer, framed && styles.outerFramed]}>
        <View style={[styles.app, framed && styles.appFramed]}>
          <SafeAreaProvider>
            <AuthProvider>
              <ToastProvider>
                <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDeep} />
                <AppNavigator />
                <ConnectionBanner />
              </ToastProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </View>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: Colors.backgroundDeep },
  outerFramed: { backgroundColor: Colors.bgAbyss, alignItems: 'center' },
  app: { flex: 1, width: '100%' },
  appFramed: {
    maxWidth: APP_MAX_WIDTH,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
});
