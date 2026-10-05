import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StatusBar, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import AuthInput from '../../components/inputs/AuthInput';
import { NotificationBanner } from '../../components/common';
import { login, googleLogin } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useGoogleAuth } from '../../hooks';
import { getErrorMessage } from '../../utils/errorMessages';

const LOGO_ORANGE = require('../../../assets/logo-orange.png');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FadeLoader() {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity }}>
      <ActivityIndicator color="#fff" />
    </Animated.View>
  );
}

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const { isConfigured: googleConfigured, request: googleRequest, idToken, promptAsync } = useGoogleAuth();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(true);
  const [emailErr, setEmailErr]         = useState('');
  const [globalErr, setGlobalErr]       = useState('');
  const [errType, setErrType]           = useState('error');

  // Dès que promptAsync() résout avec succès, useGoogleAuth expose l'idToken —
  // on le transmet immédiatement au backend pour vérification et connexion.
  useEffect(() => {
    if (!idToken) return;
    (async () => {
      try {
        setGoogleLoading(true);
        setGlobalErr('');
        const res = await googleLogin(idToken);
        if (res?.token) {
          await signIn(res.token, rememberMe);
        }
      } catch (error) {
        setErrType(error?.network ? 'warning' : 'error');
        setGlobalErr(getErrorMessage(error, 'La connexion avec Google a échoué. Réessaie ou utilise ton email.'));
      } finally {
        setGoogleLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  const handleGoogleLogin = async () => {
    try { await promptAsync(); } catch (_) {
      setErrType('error');
      setGlobalErr('La fenêtre de connexion Google ne s\'est pas ouverte. Réessaie ou utilise ton email.');
    }
  };

  const validateEmail = (val = email) => {
    if (!val)                       { setEmailErr('Entre ton adresse email.'); return false; }
    if (!EMAIL_RE.test(val.trim())) { setEmailErr('Cette adresse email n\'est pas valide. Exemple : nom@exemple.fr'); return false; }
    setEmailErr(''); return true;
  };

  const handleLogin = async () => {
    if (!validateEmail() || !password) {
      if (!password) { setErrType('error'); setGlobalErr('Entre ton mot de passe.'); }
      return;
    }
    try {
      setLoading(true);
      setGlobalErr('');
      const res = await login(email.trim(), password);
      if (!res?.token) throw new Error('no_token');
      await signIn(res.token, rememberMe);
    } catch (error) {
      const status = error?.status;
      if (status === 403 && error?.data?.code === 'EMAIL_NOT_VERIFIED') {
        navigation.navigate('EmailVerification', { email: email.trim(), fromLogin: true });
        return;
      }
      // Un serveur injoignable ne doit JAMAIS être présenté comme un mauvais
      // mot de passe : seul un 401 signifie "identifiants incorrects".
      setErrType(status === 429 || error?.network ? 'warning' : 'error');
      setGlobalErr(status === 401
        ? 'Email ou mot de passe incorrect.'
        : getErrorMessage(error, 'La connexion n\'a pas abouti. Réessaie dans un instant.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDeep} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image source={LOGO_ORANGE} style={s.logo} resizeMode="contain" />

          <View style={s.titleBlock}>
            <Text style={s.brand}>Bienvenue</Text>
            <Text style={s.tagline}>Connecte-toi pour retrouver ta progression</Text>
          </View>

          <AuthInput
            label="Email"
            icon="mail-outline"
            placeholder="nom@exemple.fr"
            value={email}
            onChangeText={(v) => { setEmail(v); if (emailErr) validateEmail(v); if (globalErr) setGlobalErr(''); }}
            onBlur={() => { if (email) validateEmail(); }}
            error={emailErr}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            inputMode="email"
            enterKeyHint="next"
          />

          <AuthInput
            label="Mot de passe"
            icon="lock-closed-outline"
            placeholder="••••••••"
            value={password}
            onChangeText={(v) => { setPassword(v); if (globalErr) setGlobalErr(''); }}
            isPassword
            secureTextEntry={!showPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            autoComplete="current-password"
            textContentType="password"
            enterKeyHint="go"
            onSubmitEditing={handleLogin}
          />

          {/* Rester connecté + Mot de passe oublié */}
          <View style={s.optionRow}>
            <TouchableOpacity
              style={s.rememberRow}
              onPress={() => setRememberMe(v => !v)}
              activeOpacity={0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <View style={[s.checkbox, rememberMe && s.checkboxActive]}>
                {rememberMe && <Ionicons name="checkmark" size={11} color="#fff" />}
              </View>
              <Text style={s.rememberLabel}>Rester connecté</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
              accessibilityRole="link"
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Text style={s.forgotLink}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>

          {globalErr ? <NotificationBanner message={globalErr} type={errType} /> : null}

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
            accessibilityState={{ busy: loading, disabled: loading }}
          >
            {loading ? <FadeLoader /> : <Text style={s.btnText}>Se connecter</Text>}
          </TouchableOpacity>

          {googleConfigured && (
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>ou</Text>
              <View style={s.dividerLine} />
            </View>
          )}

          {googleConfigured && (
            <TouchableOpacity
              style={s.googleBtn}
              onPress={handleGoogleLogin}
              disabled={googleLoading || !googleRequest}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Continuer avec Google"
            >
              {googleLoading
                ? <ActivityIndicator color={Colors.textPrimary} />
                : (
                  <>
                    <Ionicons name="logo-google" size={18} color={Colors.textPrimary} style={{ marginRight: 10 }} />
                    <Text style={s.googleBtnText}>Continuer avec Google</Text>
                  </>
                )}
            </TouchableOpacity>
          )}

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Pas encore de compte ? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="link"
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Text style={s.linkBold}>Créer un compte</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.backgroundDeep },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 56,
  },
  logo: { width: 190, height: 120, alignSelf: 'center', marginBottom: 32 },

  titleBlock: { marginBottom: 32 },
  brand: {
    color: Colors.textPrimary, fontSize: 30, fontWeight: '700',
    letterSpacing: -0.5, marginBottom: 6,
  },
  tagline: { color: Colors.textMuted, fontSize: 14, letterSpacing: 0.2 },

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.textMuted,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rememberLabel: { color: Colors.textSecondary, fontSize: 13 },
  forgotLink: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 24,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },

  divider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 28,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.separator },
  dividerText: { color: Colors.textMuted, marginHorizontal: 12, fontSize: 12 },

  googleBtn: {
    flexDirection: 'row', height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 20,
  },
  googleBtnText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 },
  switchLabel: { color: Colors.textMuted, fontSize: 14 },
  linkBold: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});
