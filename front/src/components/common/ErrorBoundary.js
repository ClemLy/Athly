import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '../../constants/theme';

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
// Filet de sécurité global : une erreur de rendu dans n'importe quel écran
// affiche cet état dégradé au lieu d'un écran blanc irrécupérable.
// Doit rester un class component : les hooks ne peuvent pas capturer les
// erreurs de rendu (componentDidCatch n'a pas d'équivalent hook).

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log console uniquement — brancher un service de crash-reporting ici
    // (Sentry…) le jour où on en ajoute un.
    console.error('💥 [ErrorBoundary]', error, info?.componentStack);
  }

  handleRetry = () => {
    // Sur web (PWA), un vrai reload repart du service worker (état sain garanti).
    // Sur natif, on retente simplement le rendu de l'arbre.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.emoji}>🏋️</Text>
        <Text style={styles.title}>Oups, une erreur est survenue</Text>
        <Text style={styles.body}>
          Pas de panique — tes données sont en sécurité.{'\n'}Réessaie, ça devrait repartir.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={this.handleRetry} activeOpacity={0.85}>
          <Text style={styles.btnTxt}>Recharger l'application</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.bgAbyss,
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 48, marginBottom: 18 },
  title: {
    color:        Colors.textPrimary,
    fontSize:     19,
    fontWeight:   '800',
    letterSpacing: -0.3,
    marginBottom: 10,
    textAlign:    'center',
  },
  body: {
    color:        Colors.textSecondary,
    fontSize:     14,
    lineHeight:   21,
    textAlign:    'center',
    marginBottom: 28,
  },
  btn: {
    height:           50,
    paddingHorizontal: 28,
    borderRadius:     13,
    backgroundColor:  Colors.primary,
    justifyContent:   'center',
    alignItems:       'center',
  },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
