import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import NotificationBanner from '../../components/common/NotificationBanner';
import { verifyEmail, resendVerificationEmail } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';

const CODE_LENGTH = 6;
const BOX_GAP     = 8;
const H_PAD       = 28 * 2; // paddingHorizontal × 2

// ─── Saisie OTP : 6 cases indépendantes ──────────────────────────────────────
function OTPInput({ value, onChange, disabled, boxW, boxH }) {
  const inputRefs = useRef([]);

  const handleChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const chars = value.split('');
    chars[index] = digit;
    onChange(chars.join(''));
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = ({ nativeEvent: { key } }, index) => {
    if (key === 'Backspace') {
      const chars = value.split('');
      if (!value[index] && index > 0) {
        chars[index - 1] = '';
        onChange(chars.join(''));
        inputRefs.current[index - 1]?.focus();
      } else {
        chars[index] = '';
        onChange(chars.join(''));
      }
    }
  };

  return (
    <View style={otp.row}>
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <TextInput
          key={i}
          ref={el => { inputRefs.current[i] = el; }}
          style={[
            otp.box,
            { width: boxW, height: boxH, fontSize: Math.round(boxW * 0.48) },
            i < CODE_LENGTH - 1 && { marginRight: BOX_GAP },
            !!value[i] && otp.boxFilled,
          ]}
          value={value[i] || ''}
          onChangeText={(text) => handleChange(text, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          keyboardAppearance="dark"
          maxLength={2}
          selectTextOnFocus
          editable={!disabled}
          textAlign="center"
        />
      ))}
    </View>
  );
}

const otp = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 28,
  },
  box: {
    borderRadius: 14,
    backgroundColor: 'rgba(22, 22, 31, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  boxFilled: { borderColor: Colors.primary },
});

// ─── Écran ────────────────────────────────────────────────────────────────────
export default function EmailVerificationScreen({ navigation, route }) {
  const email     = route?.params?.email || '';
  const fromLogin = route?.params?.fromLogin || false;
  const { signIn } = useAuth();

  const { width: windowWidth } = useWindowDimensions();
  const boxW = Math.floor((windowWidth - H_PAD - BOX_GAP * (CODE_LENGTH - 1)) / CODE_LENGTH);
  const boxH = Math.round(boxW * 1.26);

  const [code,      setCode]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  // Compte à rebours de 60 s dès l'arrivée sur l'écran
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleVerify = async () => {
    const cleanCode = code.replace(/[^0-9]/g, '');
    if (cleanCode.length < CODE_LENGTH) {
      setError('Entrez les 6 chiffres du code.');
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
    } catch {
      setError('Code invalide ou expiré. Réessayez.');
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
      setSuccess('Email renvoyé !');
      setCountdown(60);
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError("Impossible d'envoyer l'email. Réessayez.");
    } finally {
      setResending(false);
    }
  };

  const isCodeComplete = code.replace(/[^0-9]/g, '').length === CODE_LENGTH;

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
          {/* Icône */}
          <View style={s.iconWrap}>
            <Ionicons name="mail" size={34} color={Colors.primary} />
          </View>

          {/* Titre */}
          <Text style={s.title}>Vérifiez votre email</Text>
          <Text style={s.subtitle}>
            Un code à 6 chiffres a été envoyé à{'\n'}
            <Text style={s.emailHighlight}>{email}</Text>
          </Text>

          {/* Indice anti-spam */}
          <Text style={s.spamHint}>
            Si vous ne recevez pas l'e-mail dans les 2 minutes, pensez à vérifier votre dossier{' '}
            <Text style={s.spamHintBold}>Courriers indésirables (Spams)</Text>.
          </Text>

          {/* Bannière compte non vérifié (redirigé depuis le login) */}
          {fromLogin && (
            <NotificationBanner
              message="Votre compte n'est pas encore vérifié. Un code vous a été envoyé."
              type="info"
            />
          )}

          {/* Saisie du code */}
          <OTPInput
            value={code}
            onChange={(v) => { setCode(v); if (error) setError(''); }}
            disabled={loading}
            boxW={boxW}
            boxH={boxH}
          />

          {/* Messages */}
          {error   ? <Text style={s.errorText}>{error}</Text>     : null}
          {success ? <Text style={s.successText}>{success}</Text> : null}

          {/* Bouton Vérifier */}
          <TouchableOpacity
            style={[s.primaryBtn, !isCodeComplete && s.btnDisabled]}
            onPress={handleVerify}
            disabled={loading || !isCodeComplete}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.btnText, !isCodeComplete && s.btnTextMuted]}>Vérifier</Text>
            }
          </TouchableOpacity>

          {/* Renvoyer le mail */}
          <TouchableOpacity
            style={s.resendBtn}
            onPress={handleResend}
            disabled={countdown > 0 || resending}
            activeOpacity={0.7}
          >
            {resending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : countdown > 0 ? (
              <Text style={s.resendDisabled}>Renvoyer le mail ({countdown}s)</Text>
            ) : (
              <Text style={s.resendActive}>Renvoyer le mail</Text>
            )}
          </TouchableOpacity>

          {/* Changer d'email */}
          <TouchableOpacity style={s.changeEmailBtn} onPress={() => navigation.navigate('Register')}>
            <Text style={s.changeEmailText}>Utiliser un autre email</Text>
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

  errorText:   { color: Colors.error,   fontSize: 13, textAlign: 'center', marginBottom: 12 },
  successText: { color: Colors.success, fontSize: 13, textAlign: 'center', marginBottom: 12 },

  primaryBtn: {
    width: '100%', backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnDisabled:  { backgroundColor: 'rgba(255,255,255,0.08)', shadowOpacity: 0, elevation: 0 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },
  btnTextMuted: { color: Colors.textMuted },

  resendBtn:      { paddingVertical: 14, alignItems: 'center' },
  resendActive:   { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: Colors.textMuted, fontSize: 14 },

  changeEmailBtn:  { paddingVertical: 10, marginTop: 4 },
  changeEmailText: { color: Colors.textMuted, fontSize: 13 },

  spamHint: {
    color: Colors.textMuted, fontSize: 12, textAlign: 'center',
    lineHeight: 18, marginTop: 16, marginBottom: 4,
    paddingHorizontal: 8,
  },
  spamHintBold: { color: Colors.textSecondary, fontWeight: '600' },
});
