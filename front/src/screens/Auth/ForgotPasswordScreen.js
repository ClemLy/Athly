import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StatusBar, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import AuthInput from '../../components/inputs/AuthInput';
import NotificationBanner from '../../components/common/NotificationBanner';
import { forgotPassword, resetPassword } from '../../services/auth.service';
import { useToast } from '../../context/ToastContext';

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_UPPER  = /[A-Z]/;
const HAS_DIGIT  = /[0-9]/;
const CODE_LENGTH = 6;
const MIN_PWD     = 6;

// ─── Calcul de force ──────────────────────────────────────────────────────────
function getStrength(pwd) {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8)     s++;
  if (HAS_UPPER.test(pwd)) s++;
  if (HAS_DIGIT.test(pwd)) s++;
  return s;
}

// ─── Barre de force ───────────────────────────────────────────────────────────
function StrengthBar({ password }) {
  const score = getStrength(password);
  if (!password) return null;
  const color = score === 3 ? '#44FF88' : score === 2 ? '#FFA500' : '#FF4D4D';
  const label = score === 3 ? 'Fort' : score === 2 ? 'Moyen' : 'Faible';
  return (
    <View style={sb.wrap}>
      <View style={sb.row}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[
              sb.seg,
              i < 2 && { marginRight: 6 },
              { backgroundColor: i < score ? color : 'rgba(255,255,255,0.08)' },
            ]}
          />
        ))}
      </View>
      <Text style={[sb.lbl, { color }]}>{label}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  wrap: { marginTop: 6, marginBottom: 12 },
  row:  { flexDirection: 'row' },
  seg:  { flex: 1, height: 3, borderRadius: 2 },
  lbl:  { fontSize: 11, fontWeight: '600', marginTop: 5 },
});

// ─── Saisie OTP ───────────────────────────────────────────────────────────────
function OTPInput({ value, onChange, disabled }) {
  const inputRefs = useRef([]);

  const handleChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const chars = value.split('');
    chars[index] = digit;
    onChange(chars.join(''));
    if (digit && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
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
          style={[otp.box, i < CODE_LENGTH - 1 && { marginRight: 10 }, !!value[i] && otp.boxFilled]}
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
  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: 24 },
  box: {
    width: 46, height: 56, borderRadius: 12,
    backgroundColor: 'rgba(22, 22, 31, 0.8)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    color: Colors.textPrimary, fontSize: 20, fontWeight: '700',
  },
  boxFilled: { borderColor: Colors.primary },
});

// ─── Popup "Mot de passe simple" ─────────────────────────────────────────────
function WeakPasswordModal({ visible, onImprove, onSave, loading }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onImprove}
    >
      <View style={wm.backdrop}>
        <View style={wm.card}>

          <View style={wm.iconWrap}>
            <Ionicons name="warning-outline" size={28} color="#F59E0B" />
          </View>

          <Text style={wm.title}>Mot de passe simple</Text>
          <Text style={wm.body}>
            Votre mot de passe est facile à deviner. Pour la sécurité de vos
            entraînements, nous vous conseillons d'ajouter des chiffres ou des majuscules.
          </Text>

          {/* Bouton principal : Améliorer */}
          <TouchableOpacity
            style={wm.improveBtn}
            onPress={onImprove}
            activeOpacity={0.82}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={wm.improveTxt}>Améliorer mon mot de passe</Text>
          </TouchableOpacity>

          {/* Bouton secondaire : Enregistrer quand même */}
          <TouchableOpacity
            style={wm.saveBtn}
            onPress={onSave}
            disabled={loading}
            activeOpacity={0.75}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.textMuted} />
              : <Text style={wm.saveTxt}>Enregistrer quand même</Text>
            }
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const wm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#13131C',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 20,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 26,
  },
  improveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 50,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  improveTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  saveBtn: {
    width: '100%',
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveTxt: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function ForgotPasswordScreen({ navigation }) {
  const { showToast } = useToast();
  const [step, setStep] = useState(1);

  // Étape 1
  const [email,        setEmail]        = useState('');
  const [emailErr,     setEmailErr]     = useState('');
  const [step1Loading, setStep1Loading] = useState(false);

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

  const [weakModalVisible, setWeakModalVisible] = useState(false);

  // ── Étape 1 : envoi du code ────────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!email)                { setEmailErr('Email requis');   return; }
    if (!EMAIL_RE.test(email)) { setEmailErr('Email invalide'); return; }
    setEmailErr('');

    try {
      setStep1Loading(true);
      await forgotPassword(email);
      showToast('Code de vérification envoyé !', 'success');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setStep(2);
    } catch (error) {
      const status = error?.status;
      const code   = error?.data?.code;

      if (status === 404 || code === 'EMAIL_NOT_FOUND') {
        showToast("Cet e-mail n'est associé à aucun compte.", 'error');
      } else if (status === 429) {
        showToast('Trop de tentatives. Veuillez patienter avant de réessayer.', 'warning');
      } else if (status >= 500) {
        showToast("Erreur serveur. Réessayez dans un instant.", 'warning');
      } else {
        showToast("Impossible d'envoyer le code. Vérifiez l'e-mail saisi.", 'error');
      }
    } finally {
      setStep1Loading(false);
    }
  };

  // ── Étape 2 : appel API réel ──────────────────────────────────────────────
  const doReset = useCallback(async () => {
    setWeakModalVisible(false);
    try {
      setStep2Loading(true);
      setStep2Err('');
      await resetPassword(email, code, newPassword);
      navigation.navigate('Auth');
    } catch (err) {
      const status = err?.status;
      const msg    = err?.data?.message || '';
      if (status === 429) {
        setStep2ErrType('warning');
        setStep2Err('Trop de tentatives. Veuillez patienter avant de réessayer.');
      } else if (status >= 500) {
        setStep2ErrType('info');
        setStep2Err('Une erreur est survenue, notre équipe est sur le coup.');
      } else if (msg.toLowerCase().includes('code')) {
        setStep2ErrType('error');
        setStep2Err('Code invalide ou expiré.');
      } else {
        setStep2ErrType('error');
        setStep2Err('Une erreur est survenue. Réessayez.');
      }
    } finally {
      setStep2Loading(false);
    }
  }, [email, code, newPassword, navigation]);

  // ── Étape 2 : validation + vérification de force ──────────────────────────
  const handleReset = useCallback(() => {
    let ok = true;

    if (code.length < CODE_LENGTH) { setCodeErr('Code incomplet'); ok = false; }
    else setCodeErr('');

    if (!newPassword)                       { setPwdErr('Mot de passe requis');           ok = false; }
    else if (newPassword.length < MIN_PWD)  { setPwdErr(`${MIN_PWD} caractères minimum`); ok = false; }
    else setPwdErr('');

    if (!confirmPassword)                       { setConfirmErr('Confirmez le mot de passe');             ok = false; }
    else if (newPassword !== confirmPassword)   { setConfirmErr('Les mots de passe ne correspondent pas'); ok = false; }
    else setConfirmErr('');

    if (!ok) return;

    const strength = getStrength(newPassword);
    if (strength < 3) {
      setWeakModalVisible(true);
    } else {
      doReset();
    }
  }, [code, newPassword, confirmPassword, doReset]);

  // Formulaire valide dès 6 chars + code complet + passwords identiques
  const isStep2Valid =
    code.length === CODE_LENGTH &&
    newPassword.length >= MIN_PWD &&
    newPassword === confirmPassword;

  const goBack = () => step === 2 ? setStep(1) : navigation.goBack();

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDeep} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={s.backBtn} onPress={goBack}>
            <Ionicons name="arrow-back" size={22} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* ══════════════════════════════════════════════════
              ÉTAPE 1 — Saisie de l'email
          ══════════════════════════════════════════════════ */}
          {step === 1 && (
            <>
              <View style={s.iconWrap}>
                <Ionicons name="key-outline" size={30} color={Colors.primary} />
              </View>

              <View style={s.titleBlock}>
                <Text style={s.title}>Mot de passe oublié</Text>
                <Text style={s.tagline}>
                  Entrez votre email pour recevoir un code de réinitialisation.
                </Text>
              </View>

              <AuthInput
                label="Email"
                icon="mail-outline"
                placeholder="votre@email.com"
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailErr) setEmailErr(''); }}
                onBlur={() => {
                  if (email && !EMAIL_RE.test(email)) setEmailErr('Email invalide');
                }}
                error={emailErr}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={s.primaryBtn}
                onPress={handleSendCode}
                disabled={step1Loading}
                activeOpacity={0.82}
              >
                {step1Loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Envoyer le code</Text>
                }
              </TouchableOpacity>

              <Text style={s.spamHint}>
                Si vous ne recevez pas l'e-mail dans les 2 minutes, pensez à vérifier votre dossier{' '}
                <Text style={s.spamHintBold}>Courriers indésirables (Spams)</Text>.
              </Text>
            </>
          )}

          {/* ══════════════════════════════════════════════════
              ÉTAPE 2 — Code + Nouveau mot de passe
          ══════════════════════════════════════════════════ */}
          {step === 2 && (
            <>
              <View style={s.iconWrap}>
                <Ionicons name="shield-checkmark-outline" size={30} color={Colors.primary} />
              </View>

              <View style={s.titleBlock}>
                <Text style={s.title}>Nouveau mot de passe</Text>
                <Text style={s.tagline}>
                  Code envoyé à{' '}
                  <Text style={s.emailHighlight}>{email}</Text>
                </Text>
              </View>

              <Text style={s.spamHint}>
                Si vous ne recevez pas l'e-mail dans les 2 minutes, pensez à vérifier votre dossier{' '}
                <Text style={s.spamHintBold}>Courriers indésirables (Spams)</Text>.
              </Text>

              <Text style={s.codeLabel}>CODE DE VÉRIFICATION</Text>
              <OTPInput
                value={code}
                onChange={(v) => { setCode(v); if (codeErr) setCodeErr(''); }}
                disabled={step2Loading}
              />
              {codeErr ? <Text style={[s.errorText, { marginTop: -16 }]}>{codeErr}</Text> : null}

              <AuthInput
                label="Nouveau mot de passe"
                icon="lock-closed-outline"
                placeholder="••••••••"
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  if (pwdErr && v.length >= MIN_PWD) setPwdErr('');
                  if (confirmErr && confirmPassword) {
                    setConfirmErr(v !== confirmPassword ? 'Les mots de passe ne correspondent pas' : '');
                  }
                }}
                isPassword
                secureTextEntry={!showNewPwd}
                showPassword={showNewPwd}
                setShowPassword={setShowNewPwd}
                error={pwdErr}
              />
              <StrengthBar password={newPassword} />

              <AuthInput
                label="Confirmer le mot de passe"
                icon="shield-checkmark-outline"
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (confirmErr) {
                    setConfirmErr(v !== newPassword ? 'Les mots de passe ne correspondent pas' : '');
                  }
                }}
                isPassword
                secureTextEntry={!showConfirmPwd}
                showPassword={showConfirmPwd}
                setShowPassword={setShowConfirmPwd}
                error={confirmErr}
              />

              {step2Err ? <NotificationBanner message={step2Err} type={step2ErrType} /> : null}

              <TouchableOpacity
                style={[s.primaryBtn, !isStep2Valid && s.btnDisabled]}
                onPress={handleReset}
                disabled={step2Loading || !isStep2Valid}
                activeOpacity={0.82}
              >
                {step2Loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[s.btnText, !isStep2Valid && s.btnTextMuted]}>Réinitialiser</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={s.resendRow} onPress={() => setStep(1)}>
                <Text style={s.resendText}>Renvoyer le code</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Popup "Mot de passe simple" — rendue hors du ScrollView pour couvrir tout l'écran */}
      <WeakPasswordModal
        visible={weakModalVisible}
        onImprove={() => setWeakModalVisible(false)}
        onSave={doReset}
        loading={step2Loading}
      />
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
    letterSpacing: 0.8, textTransform: 'uppercase',
  },

  errorText: {
    color: Colors.error, fontSize: 13, textAlign: 'center',
    marginTop: 8, marginBottom: 4,
  },

  primaryBtn: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnDisabled:  { backgroundColor: 'rgba(255,255,255,0.08)', shadowOpacity: 0, elevation: 0 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },
  btnTextMuted: { color: Colors.textMuted },

  resendRow:  { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  resendText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },

  spamHint: {
    color: Colors.textMuted, fontSize: 12, lineHeight: 18,
    marginTop: 14, marginBottom: 8,
  },
  spamHintBold: { color: Colors.textSecondary, fontWeight: '600' },
});
