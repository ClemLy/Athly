import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import { NotificationBanner } from '../../components/common';
import OTPCodeInput from '../../components/inputs/OTPCodeInput';
import { verifyEmail, resendVerificationEmail } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/errorMessages';

const CODE_LENGTH  = 6;
const RESEND_DELAY = 60; // secondes, aligné sur l'anti-spam serveur

// ─── Écran ────────────────────────────────────────────────────────────────────
export default function EmailVerificationScreen({ navigation, route }) {
  const email     = route?.params?.email || '';
  const fromLogin = route?.params?.fromLogin || false;
  const { signIn } = useAuth();

  const [code,      setCode]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_DELAY);
  const [error,     setError]     = useState('');
  const [errType,   setErrType]   = useState('error');
  const [success,   setSuccess]   = useState('');

  // Compte à rebours avant de pouvoir redemander un code
  useEffect(() => {
    if (countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleVerify = async (submitted = code) => {
    const cleanCode = submitted.replace(/[^0-9]/g, '');
    if (cleanCode.length < CODE_LENGTH) {
      setErrType('error');
      setError('Entre les 6 chiffres du code reçu par email.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await verifyEmail(email, cleanCode);
      if (res?.token) {
        await signIn(res.token, true);
      } else {
        navigation.navigate('Auth');
      }
    } catch (err) {
      const errCode = err?.data?.code;
      if (errCode === 'ALREADY_VERIFIED') {
        navigation.navigate('Auth');
        return;
      }
      if (errCode === 'CODE_EXPIRED' || errCode === 'TOO_MANY_ATTEMPTS') setCode('');
      setErrType(err?.network ? 'warning' : 'error');
      setError(getErrorMessage(err, 'La vérification n\'a pas abouti. Réessaie dans un instant.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      setResending(true);
      setError('');
      setSuccess('');
      await resendVerificationEmail(email);
      setCode('');
      setSuccess('Nouveau code envoyé. Seul le dernier code reçu fonctionne.');
      setCountdown(RESEND_DELAY);
    } catch (err) {
      setErrType('warning');
      setError(getErrorMessage(err, 'L\'envoi du code n\'a pas abouti. Réessaie dans un instant.'));
    } finally {
      setResending(false);
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
          <View style={s.iconWrap}>
            <Ionicons name="mail-unread-outline" size={34} color={Colors.primary} />
          </View>

          <Text style={s.title} accessibilityRole="header">Confirme ton email</Text>
          <Text style={s.subtitle}>
            Entre le code à 6 chiffres envoyé à{'\n'}
            <Text style={s.emailHighlight}>{email}</Text>
          </Text>

          {fromLogin && (
            <NotificationBanner
              message="Ton compte n'est pas encore confirmé. Un code t'a été envoyé par email."
              type="info"
            />
          )}

          <OTPCodeInput
            value={code}
            onChange={(v) => { setCode(v); if (error) setError(''); }}
            onComplete={(full) => handleVerify(full)}
            disabled={loading}
            hasError={!!error && errType === 'error'}
            autoFocus
          />

          {error   ? <NotificationBanner message={error} type={errType} /> : null}
          {success ? <NotificationBanner message={success} type="success" /> : null}

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => handleVerify()}
            disabled={loading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityState={{ busy: loading, disabled: loading }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Confirmer</Text>
            }
          </TouchableOpacity>

          <Text style={s.spamHint}>
            Rien reçu après 2 minutes ? Regarde dans tes spams avant de redemander un code.
          </Text>

          <TouchableOpacity
            style={s.resendBtn}
            onPress={handleResend}
            disabled={countdown > 0 || resending}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: countdown > 0 || resending }}
          >
            {resending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : countdown > 0 ? (
              <Text style={s.resendDisabled}>Renvoyer un code dans {countdown} s</Text>
            ) : (
              <Text style={s.resendActive}>Renvoyer un code</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.changeEmailBtn}
            onPress={() => navigation.navigate('Register')}
            accessibilityRole="link"
          >
            <Text style={s.changeEmailText}>Ce n'est pas ma bonne adresse</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.backgroundDeep },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 40,
    alignItems: 'center',
  },

  iconWrap: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: 'rgba(254, 116, 57, 0.1)',
    borderWidth: 1, borderColor: 'rgba(254, 116, 57, 0.18)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },

  title: {
    color: Colors.textPrimary, fontSize: 26, fontWeight: '700',
    letterSpacing: -0.5, textAlign: 'center', marginBottom: 12,
  },
  subtitle: {
    color: Colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22,
  },
  emailHighlight: { color: Colors.textPrimary, fontWeight: '600' },

  primaryBtn: {
    width: '100%', backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 16, marginBottom: 8,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },

  resendBtn:      { paddingVertical: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  resendActive:   { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: Colors.textMuted, fontSize: 14 },

  changeEmailBtn:  { paddingVertical: 12, marginTop: 4 },
  changeEmailText: { color: Colors.textSecondary, fontSize: 13.5, textDecorationLine: 'underline' },

  spamHint: {
    color: Colors.textMuted, fontSize: 13, textAlign: 'center',
    lineHeight: 19, marginTop: 12, paddingHorizontal: 8,
  },
});
