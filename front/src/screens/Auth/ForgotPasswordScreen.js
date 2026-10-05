import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import AuthInput from '../../components/inputs/AuthInput';
import OTPCodeInput from '../../components/inputs/OTPCodeInput';
import PasswordGuide, { isPasswordValid, PASSWORD_RULES_MESSAGE } from '../../components/inputs/PasswordGuide';
import { NotificationBanner } from '../../components/common';
import { forgotPassword, resetPassword } from '../../services';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errorMessages';

const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH   = 6;
const RESEND_DELAY  = 60; // secondes, aligné sur l'anti-spam serveur

// ─── Écran principal ──────────────────────────────────────────────────────────
// Étape 1 : adresse email → envoi du code. Étape 2 : code + nouveau mot de passe.
// Le serveur répond toujours la même chose (adresse connue ou non) : l'écran
// le dit clairement et rappelle l'adresse saisie pour repérer une faute de frappe.
export default function ForgotPasswordScreen({ navigation, route }) {
  const { showToast } = useToast();
  const [step, setStep] = useState(1);

  // Étape 1
  const [email,        setEmail]        = useState(route?.params?.email || '');
  const [emailErr,     setEmailErr]     = useState('');
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Err,     setStep1Err]     = useState('');

  // Étape 2
  const [code,            setCode]            = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd,      setShowNewPwd]      = useState(false);
  const [showConfirmPwd,  setShowConfirmPwd]  = useState(false);
  const [codeErr,         setCodeErr]         = useState('');
  const [pwdErr,          setPwdErr]          = useState('');
  const [confirmErr,      setConfirmErr]      = useState('');
  const [step2Loading,    setStep2Loading]    = useState(false);
  const [step2Err,        setStep2Err]        = useState('');
  const [step2ErrType,    setStep2ErrType]    = useState('error');
  const [countdown,       setCountdown]       = useState(0);
  const [resending,       setResending]       = useState(false);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Étape 1 : envoi du code ────────────────────────────────────────────────
  const sendCode = useCallback(async () => {
    const e = email.trim();
    if (!e)                { setEmailErr('Entre l\'adresse email de ton compte.'); return false; }
    if (!EMAIL_RE.test(e)) { setEmailErr('Cette adresse email n\'est pas valide. Exemple : nom@exemple.fr'); return false; }
    setEmailErr('');
    setStep1Err('');
    await forgotPassword(e);
    setCountdown(RESEND_DELAY);
    return true;
  }, [email]);

  const handleSendCode = async () => {
    try {
      setStep1Loading(true);
      const sent = await sendCode();
      if (!sent) return;
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setStep2Err('');
      setStep(2);
    } catch (error) {
      setStep1Err(getErrorMessage(error, 'L\'envoi du code n\'a pas abouti. Réessaie dans un instant.'));
    } finally {
      setStep1Loading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      setResending(true);
      setStep2Err('');
      await sendCode();
      showToast('Nouveau code envoyé. Seul le dernier code reçu fonctionne.', 'success');
    } catch (error) {
      setStep2ErrType('error');
      setStep2Err(getErrorMessage(error, 'L\'envoi du code n\'a pas abouti. Réessaie dans un instant.'));
    } finally {
      setResending(false);
    }
  };

  // ── Étape 2 : validation puis réinitialisation ───────────────────────────
  const handleReset = useCallback(async () => {
    let ok = true;
    if (code.length < CODE_LENGTH) { setCodeErr('Entre les 6 chiffres du code reçu par email.'); ok = false; }
    else setCodeErr('');

    if (!newPassword)                       { setPwdErr('Choisis un nouveau mot de passe.'); ok = false; }
    else if (!isPasswordValid(newPassword)) { setPwdErr(PASSWORD_RULES_MESSAGE); ok = false; }
    else setPwdErr('');

    if (!confirmPassword)                     { setConfirmErr('Retape ton mot de passe pour le confirmer.'); ok = false; }
    else if (newPassword !== confirmPassword) { setConfirmErr('Les deux mots de passe ne sont pas identiques.'); ok = false; }
    else setConfirmErr('');

    if (!ok) return;

    try {
      setStep2Loading(true);
      setStep2Err('');
      await resetPassword(email.trim(), code, newPassword);
      showToast('Mot de passe modifié. Connecte-toi avec le nouveau.', 'success');
      navigation.navigate('Auth');
    } catch (err) {
      const errCode = err?.data?.code;
      if (errCode === 'INVALID_CODE' || errCode === 'CODE_EXPIRED' || errCode === 'TOO_MANY_ATTEMPTS') {
        setCodeErr(getErrorMessage(err, 'Ce code n\'est pas valide.'));
        if (errCode !== 'INVALID_CODE') setCode('');
        return;
      }
      setStep2ErrType(err?.status === 429 || err?.network ? 'warning' : 'error');
      setStep2Err(getErrorMessage(err, 'La modification n\'a pas abouti. Réessaie dans un instant.'));
    } finally {
      setStep2Loading(false);
    }
  }, [code, newPassword, confirmPassword, email, navigation, showToast]);

  const goBack = () => (step === 2 ? setStep(1) : navigation.goBack());

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDeep} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={s.backBtn}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={step === 2 ? 'Modifier l\'adresse email' : 'Retour à la connexion'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>

          {step === 1 && (
            <>
              <View style={s.iconWrap}>
                <Ionicons name="key-outline" size={30} color={Colors.primary} />
              </View>

              <View style={s.titleBlock}>
                <Text style={s.title} accessibilityRole="header">Mot de passe oublié</Text>
                <Text style={s.tagline}>
                  Entre l'adresse email de ton compte : on t'envoie un code pour choisir un nouveau mot de passe.
                </Text>
              </View>

              <AuthInput
                label="Email"
                icon="mail-outline"
                placeholder="nom@exemple.fr"
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailErr) setEmailErr(''); if (step1Err) setStep1Err(''); }}
                onBlur={() => {
                  const e = email.trim();
                  if (e && !EMAIL_RE.test(e)) setEmailErr('Cette adresse email n\'est pas valide. Exemple : nom@exemple.fr');
                }}
                error={emailErr}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                inputMode="email"
                enterKeyHint="send"
                onSubmitEditing={handleSendCode}
              />

              {step1Err ? <NotificationBanner message={step1Err} type="warning" /> : null}

              <TouchableOpacity
                style={s.primaryBtn}
                onPress={handleSendCode}
                disabled={step1Loading}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityState={{ busy: step1Loading, disabled: step1Loading }}
              >
                {step1Loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Recevoir un code</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <View style={s.iconWrap}>
                <Ionicons name="shield-checkmark-outline" size={30} color={Colors.primary} />
              </View>

              <View style={s.titleBlock}>
                <Text style={s.title} accessibilityRole="header">Nouveau mot de passe</Text>
                <Text style={s.tagline}>
                  Si un compte existe pour{' '}
                  <Text style={s.emailHighlight}>{email.trim()}</Text>
                  , tu vas recevoir un code à 6 chiffres. Il est valable 15 minutes.
                </Text>
              </View>

              <View style={s.hintBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
                <Text style={s.hintTxt}>
                  Rien reçu après 2 minutes ? Regarde dans tes spams, ou vérifie l'adresse avec le bouton retour.
                </Text>
              </View>

              <Text style={s.codeLabel}>Code reçu par email</Text>
              <OTPCodeInput
                value={code}
                onChange={(v) => { setCode(v); if (codeErr) setCodeErr(''); }}
                disabled={step2Loading}
                hasError={!!codeErr}
              />
              {codeErr ? (
                <Text style={s.errorText} accessibilityRole="alert">{codeErr}</Text>
              ) : null}

              <AuthInput
                label="Nouveau mot de passe"
                icon="lock-closed-outline"
                placeholder="8 caractères minimum"
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  if (pwdErr && isPasswordValid(v)) setPwdErr('');
                  if (confirmErr && confirmPassword) {
                    setConfirmErr(v !== confirmPassword ? 'Les deux mots de passe ne sont pas identiques.' : '');
                  }
                }}
                isPassword
                secureTextEntry={!showNewPwd}
                showPassword={showNewPwd}
                setShowPassword={setShowNewPwd}
                error={pwdErr}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <PasswordGuide password={newPassword} />

              <AuthInput
                label="Confirmer le mot de passe"
                icon="shield-checkmark-outline"
                placeholder="Retape ton mot de passe"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (confirmErr) {
                    setConfirmErr(v !== newPassword ? 'Les deux mots de passe ne sont pas identiques.' : '');
                  }
                }}
                isPassword
                secureTextEntry={!showConfirmPwd}
                showPassword={showConfirmPwd}
                setShowPassword={setShowConfirmPwd}
                error={confirmErr}
                autoComplete="new-password"
                textContentType="newPassword"
                enterKeyHint="done"
                onSubmitEditing={handleReset}
              />

              {step2Err ? <NotificationBanner message={step2Err} type={step2ErrType} /> : null}

              <TouchableOpacity
                style={s.primaryBtn}
                onPress={handleReset}
                disabled={step2Loading}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityState={{ busy: step2Loading, disabled: step2Loading }}
              >
                {step2Loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Changer mon mot de passe</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={s.resendRow}
                onPress={handleResend}
                disabled={countdown > 0 || resending}
                accessibilityRole="button"
                accessibilityState={{ disabled: countdown > 0 || resending }}
              >
                {resending
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : (
                    <Text style={countdown > 0 ? s.resendDisabled : s.resendText}>
                      {countdown > 0 ? `Renvoyer un code dans ${countdown} s` : 'Renvoyer un code'}
                    </Text>
                  )}
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.backgroundDeep },
  content:  { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 56 },

  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 16 },

  iconWrap: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: 'rgba(254, 116, 57, 0.1)',
    borderWidth: 1, borderColor: 'rgba(254, 116, 57, 0.18)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24, alignSelf: 'flex-start',
  },

  titleBlock: { marginBottom: 32 },
  title: {
    color: Colors.textPrimary, fontSize: 28, fontWeight: '700',
    letterSpacing: -0.5, marginBottom: 8,
  },
  tagline:        { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  emailHighlight: { color: Colors.textPrimary, fontWeight: '600' },

  codeLabel: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: '600',
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8,
  },

  errorText: {
    color: Colors.error, fontSize: 13, lineHeight: 18, textAlign: 'center',
    marginTop: -12, marginBottom: 14,
  },

  hintBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 12, marginTop: -12, marginBottom: 12,
  },
  hintTxt: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },

  primaryBtn: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },

  resendRow:      { alignItems: 'center', marginTop: 16, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  resendText:     { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: Colors.textMuted, fontSize: 14 },
});
