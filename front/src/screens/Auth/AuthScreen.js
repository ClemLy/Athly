import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Dimensions, Animated, Easing, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import AuthInput from '../../components/inputs/AuthInput';
import { login, register } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';

// Imports statiques des assets (chemin : src/screens/Auth/ → ../../../assets/)
const LOGO_ORANGE      = require('../../../assets/logo-orange.png');
const LOGO_ICON_ORANGE = require('../../../assets/minimalist-logo-orange.png');

const { width: _rawW } = Dimensions.get('window');
const W = Platform.OS === 'web' ? Math.min(430, _rawW) : _rawW;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FadeLoader() {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity }}>
      <ActivityIndicator color="#fff" />
    </Animated.View>
  );
}

export default function AuthScreen() {
  const { signIn } = useAuth();
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Login state ──────────────────────────────────────────
  const [loginEmail, setLoginEmail]         = useState('');
  const [loginPassword, setLoginPassword]   = useState('');
  const [loginLoading, setLoginLoading]     = useState(false);
  const [loginShowPwd, setLoginShowPwd]     = useState(false);
  const [loginEmailErr, setLoginEmailErr]   = useState('');
  const [loginGlobalErr, setLoginGlobalErr] = useState('');

  // ── Register state ───────────────────────────────────────
  const [regName, setRegName]           = useState('');
  const [regEmail, setRegEmail]         = useState('');
  const [regPassword, setRegPassword]   = useState('');
  const [regLoading, setRegLoading]     = useState(false);
  const [regShowPwd, setRegShowPwd]     = useState(false);
  const [regNameErr, setRegNameErr]     = useState('');
  const [regEmailErr, setRegEmailErr]   = useState('');
  const [regPwdErr, setRegPwdErr]       = useState('');
  const [regGlobalErr, setRegGlobalErr] = useState('');

  // ── Slide ────────────────────────────────────────────────
  const slideTo = (panel) => {
    Animated.timing(slideAnim, {
      toValue: panel === 'login' ? 0 : -W,
      duration: 400,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  };

  // ── Validators ───────────────────────────────────────────
  const validateLoginEmail = (val = loginEmail) => {
    if (!val)                { setLoginEmailErr('Email requis');   return false; }
    if (!EMAIL_RE.test(val)) { setLoginEmailErr('Email invalide'); return false; }
    setLoginEmailErr(''); return true;
  };

  const validateRegEmail = (val = regEmail) => {
    if (!val)                { setRegEmailErr('Email requis');   return false; }
    if (!EMAIL_RE.test(val)) { setRegEmailErr('Email invalide'); return false; }
    setRegEmailErr(''); return true;
  };

  // ── Handlers ─────────────────────────────────────────────
  const handleLogin = async () => {
    if (!validateLoginEmail() || !loginPassword) return;
    try {
      setLoginLoading(true);
      setLoginGlobalErr('');
      const res = await login(loginEmail, loginPassword);
      if (res?.token) await signIn(res.token);
      else throw new Error();
    } catch {
      setLoginGlobalErr('Email ou mot de passe incorrect.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    let ok = true;
    if (!regName)                { setRegNameErr('Nom requis'); ok = false; } else setRegNameErr('');
    if (!validateRegEmail())       ok = false;
    if (regPassword.length < 6)  { setRegPwdErr('6 caractères minimum'); ok = false; } else setRegPwdErr('');
    if (!ok) return;
    try {
      setRegLoading(true);
      setRegGlobalErr('');
      const res = await register({ name: regName, email: regEmail, password: regPassword });
      if (res?.token) await signIn(res.token);
      else slideTo('login');
    } catch {
      setRegGlobalErr("Erreur lors de l'inscription. Email déjà utilisé ?");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDeep} />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.clipper}>
          <Animated.View style={[styles.slider, { transform: [{ translateX: slideAnim }] }]}>

            {/* ══════════════════════════════════════════════════
                PANEL LOGIN
            ══════════════════════════════════════════════════ */}
            <ScrollView
              style={styles.panel}
              contentContainerStyle={styles.panelContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={LOGO_ORANGE}
                style={styles.logoImg}
                resizeMode="contain"
                accessible
                accessibilityLabel="Logo Athly"
              />

              <View style={styles.titleBlock}>
                <Text style={styles.brand}>Bienvenue</Text>
                <Text style={styles.tagline}>Connectez-vous pour continuer</Text>
              </View>

              <AuthInput
                label="Email"
                icon="mail-outline"
                placeholder="votre@email.com"
                value={loginEmail}
                onChangeText={(v) => { setLoginEmail(v); if (loginEmailErr) validateLoginEmail(v); }}
                onBlur={() => validateLoginEmail()}
                error={loginEmailErr}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <AuthInput
                label="Mot de passe"
                icon="lock-closed-outline"
                placeholder="••••••••"
                value={loginPassword}
                onChangeText={setLoginPassword}
                isPassword
                secureTextEntry={!loginShowPwd}
                showPassword={loginShowPwd}
                setShowPassword={setLoginShowPwd}
              />

              {loginGlobalErr ? <Text style={styles.globalError}>{loginGlobalErr}</Text> : null}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleLogin}
                disabled={loginLoading}
                activeOpacity={0.82}
              >
                {loginLoading ? <FadeLoader /> : <Text style={styles.btnText}>Se connecter</Text>}
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Pas encore de compte ? </Text>
                <TouchableOpacity onPress={() => slideTo('register')}>
                  <Text style={styles.linkBold}>S'inscrire</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* ══════════════════════════════════════════════════
                PANEL REGISTER
            ══════════════════════════════════════════════════ */}
            <ScrollView
              style={styles.panel}
              contentContainerStyle={styles.panelContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity style={styles.backBtn} onPress={() => slideTo('login')}>
                <Ionicons name="arrow-back" size={20} color={Colors.textMuted} />
              </TouchableOpacity>

              <Image
                source={LOGO_ICON_ORANGE}
                style={styles.logoSmall}
                resizeMode="contain"
                accessible
                accessibilityLabel="Logo Athly"
              />

              <View style={styles.titleBlock}>
                <Text style={styles.brand}>Créer un compte</Text>
                <Text style={styles.tagline}>Rejoignez la communauté Athly</Text>
              </View>

              <AuthInput
                label="Nom complet"
                icon="person-outline"
                placeholder="John Doe"
                value={regName}
                onChangeText={(v) => { setRegName(v); if (regNameErr) setRegNameErr(''); }}
                error={regNameErr}
              />
              <AuthInput
                label="Email"
                icon="mail-outline"
                placeholder="votre@email.com"
                value={regEmail}
                onChangeText={(v) => { setRegEmail(v); if (regEmailErr) validateRegEmail(v); }}
                onBlur={() => validateRegEmail()}
                error={regEmailErr}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <AuthInput
                label="Mot de passe"
                icon="lock-closed-outline"
                placeholder="••••••••"
                value={regPassword}
                onChangeText={(v) => {
                  setRegPassword(v);
                  if (regPwdErr) setRegPwdErr(v.length >= 6 ? '' : '6 caractères minimum');
                }}
                isPassword
                secureTextEntry={!regShowPwd}
                showPassword={regShowPwd}
                setShowPassword={setRegShowPwd}
                error={regPwdErr}
              />

              {regGlobalErr ? <Text style={styles.globalError}>{regGlobalErr}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 10 }]}
                onPress={handleRegister}
                disabled={regLoading}
                activeOpacity={0.82}
              >
                {regLoading ? <FadeLoader /> : <Text style={styles.btnText}>Créer mon compte</Text>}
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Déjà inscrit ? </Text>
                <TouchableOpacity onPress={() => slideTo('login')}>
                  <Text style={styles.linkBold}>Se connecter</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundDeep,
  },
  kav: {
    flex: 1,
    backgroundColor: Colors.backgroundDeep,
  },
  clipper: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundDeep,
  },
  slider: {
    flex: 1,
    flexDirection: 'row',
    width: W * 2,
  },
  panel: {
    width: W,
    backgroundColor: Colors.backgroundDeep,
  },
  panelContent: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 56,
  },

  // ── Logo Login (image brute, dimensions explicites) ──────
  logoImg: {
    width: 180,
    height: 120,
    alignSelf: 'center',
    marginBottom: 30,
    marginTop: 4,
  },
  // ── Logo Register (icône discrète) ───────────────────────
  logoSmall: {
    width: 26,
    height: 26,
    alignSelf: 'flex-start',
    marginBottom: 20,
    opacity: 0.6,
  },

  // ── Typographie ──────────────────────────────────────────
  titleBlock: {
    marginBottom: 32,
  },
  brand: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    color: Colors.textMuted,
    fontSize: 14,
    letterSpacing: 0.2,
  },

  // ── Erreur globale ───────────────────────────────────────
  globalError: {
    color: Colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },

  // ── Bouton principal ─────────────────────────────────────
  primaryBtn: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // ── Lien de bascule ──────────────────────────────────────
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 36,
  },
  switchLabel: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  linkBold: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Retour ───────────────────────────────────────────────
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    marginBottom: 8,
  },
});
