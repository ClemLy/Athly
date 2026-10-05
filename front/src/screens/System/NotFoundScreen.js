import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

// ─── Page introuvable (404) ───────────────────────────────────────────────────
// Affichée pour toute adresse inconnue (lien cassé, faute de frappe, ancienne
// URL). Explique ce qui s'est passé et ramène à un endroit utile en un geste.
export default function NotFoundScreen({ navigation }) {
  const { userToken } = useAuth();
  const isLoggedIn = Boolean(userToken);

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: isLoggedIn ? 'Main' : 'Auth' }] });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.content}>
        <View style={s.iconWrap}>
          <Ionicons name="compass-outline" size={36} color={Colors.primary} />
        </View>
        <Text style={s.code}>Erreur 404</Text>
        <Text style={s.title} accessibilityRole="header">Cette page n'existe pas</Text>
        <Text style={s.body}>
          Le lien que tu as suivi est peut-être incomplet, ou la page a été déplacée.
          Tes données ne sont pas concernées.
        </Text>

        <TouchableOpacity
          style={s.primaryBtn}
          onPress={goHome}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons name={isLoggedIn ? 'home-outline' : 'log-in-outline'} size={18} color="#fff" />
          <Text style={s.primaryTxt}>{isLoggedIn ? "Retour à l'accueil" : 'Aller à la connexion'}</Text>
        </TouchableOpacity>

        {navigation.canGoBack() && (
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={s.secondaryTxt}>Revenir à la page précédente</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundDeep },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(254,116,57,0.10)',
    borderWidth: 1, borderColor: 'rgba(254,116,57,0.22)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  code: {
    color: Colors.primary, fontSize: 12, fontWeight: '800',
    letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8,
  },
  title: {
    color: Colors.textPrimary, fontSize: 24, fontWeight: '800',
    letterSpacing: -0.4, textAlign: 'center', marginBottom: 12,
  },
  body: {
    color: Colors.textSecondary, fontSize: 15, lineHeight: 22,
    textAlign: 'center', marginBottom: 28,
  },
  primaryBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'stretch', height: 52, borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 8, paddingVertical: 14, paddingHorizontal: 12 },
  secondaryTxt: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
