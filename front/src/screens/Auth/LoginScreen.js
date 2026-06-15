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
import NotificationBanner from '../../components/common/NotificationBanner';
import { login } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';

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

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(true);
  const [emailErr, setEmailErr]         = useState('');
  const [globalErr, setGlobalErr]       = useState('');
  const [errType, setErrType]           = useState('error');

  const validateEmail = (val = email) => {
    if (!val)                { setEmailErr('Email requis');   return false; }
    if (!EMAIL_RE.test(val)) { setEmailErr('Email invalide'); return false; }
    setEmailErr(''); return true;
  };

  const handleLogin = async () => {
    if (!validateEmail() || !password) {
      if (!password) { setErrType('error'); setGlobalErr('Veuillez entrer votre mot de passe.'); }
      return;
    }
    try {
      setLoading(true);
      setGlobalErr('');
      const res = await login(email, password);
      if (res?.token) {
        await signIn(res.token, rememberMe);
      } else {
        throw new Error('no_token');
      }
    } catch (error) {
      const status = error?.status;
      const code   = error?.data?.code;
      if (status === 403 || code === 'EMAIL_NOT_VERIFIED') {
        navigation.navigate('EmailVerification', { email, fromLogin: true });
        return;
      }
      if (status === 429) {
        setErrType('warning');
        setGlobalErr('Trop de tentatives. Veuillez patienter avant de réessayer.');
        return;
      }
      if (status >= 500) {
        setErrType('info');
        setGlobalErr('Une erreur est survenue, notre équipe est sur le coup.');
        return;
      }
      setErrType('error');
      setGlobalErr('Email ou mot de passe incorrect.');
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
            <Text style={s.tagline}>Connectez-vous pour continuer</Text>
          </View>

          <AuthInput
            label="Email"
            icon="mail-outline"
            placeholder="votre@email.com"
            value={email}
            onChangeText={(v) => { setEmail(v); if (emailErr) validateEmail(v); }}
            onBlur={() => validateEmail()}
            error={emailErr}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
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
          />

          {/* Rester connecté + Mot de passe oublié */}
          <View style={s.optionRow}>
            <TouchableOpacity
              style={s.rememberRow}
              onPress={() => setRememberMe(v => !v)}
              activeOpacity={0.75}
            >
              <View style={[s.checkbox, rememberMe && s.checkboxActive]}>
                {rememberMe && <Ionicons name="checkmark" size={11} color="#fff" />}
              </View>
              <Text style={s.rememberLabel}>Rester connecté</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={s.forgotLink}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>

          {globalErr ? <NotificationBanner message={globalErr} type={errType} /> : null}

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading ? <FadeLoader /> : <Text style={s.btnText}>Se connecter</Text>}
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>ou</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Pas encore de compte ? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={s.linkBold}>S'inscrire</Text>
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

  switchRow: { flexDirection: 'row', justifyContent: 'center' },
  switchLabel: { color: Colors.textMuted, fontSize: 14 },
  linkBold: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});
