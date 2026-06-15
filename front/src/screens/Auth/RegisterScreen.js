import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import AuthInput from '../../components/inputs/AuthInput';
import NotificationBanner from '../../components/common/NotificationBanner';
import { register } from '../../services/auth.service';

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /[0-9]/;
const MIN_PWD   = 6;  // seuil minimal — la force est guidée par la StrengthBar + popup

// ─── Calcul de force du mot de passe (0 = absent, 1 = faible, 2 = moyen, 3 = fort) ──
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

// ─── Popup "Mot de passe simple" ─────────────────────────────────────────────

function WeakPasswordModal({ visible, onImprove, onCreate, loading }) {
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

          {/* Icône */}
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

          {/* Bouton secondaire : Créer quand même */}
          <TouchableOpacity
            style={wm.createBtn}
            onPress={onCreate}
            disabled={loading}
            activeOpacity={0.75}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.textMuted} />
              : <Text style={wm.createTxt}>Créer quand même</Text>
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

  // Bouton principal — Améliorer (lumineux, Colors.primary)
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

  // Bouton secondaire — Créer quand même (discret)
  createBtn: {
    width: '100%',
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createTxt: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const [pseudo,   setPseudo]   = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [pseudoErr,  setPseudoErr]  = useState('');
  const [emailErr,   setEmailErr]   = useState('');
  const [pwdErr,     setPwdErr]     = useState('');
  const [confirmErr, setConfirmErr] = useState('');
  const [globalErr,  setGlobalErr]  = useState('');
  const [errType,    setErrType]    = useState('error');

  const [weakModalVisible, setWeakModalVisible] = useState(false);

  // ── Règles allégées : seul le minimum absolu bloque le bouton ────────────────
  const isPwdMinimal = password.length >= MIN_PWD;
  const isFormValid  =
    pseudo.trim().length >= 2 &&
    EMAIL_RE.test(email) &&
    isPwdMinimal &&
    confirm.length > 0 &&
    confirm === password;

  // ── Validation UI (erreurs champ par champ) ───────────────────────────────
  const validate = useCallback(() => {
    let ok = true;

    if (!pseudo.trim()) { setPseudoErr('Pseudo requis'); ok = false; }
    else setPseudoErr('');

    if (!email)                     { setEmailErr('Email requis');   ok = false; }
    else if (!EMAIL_RE.test(email)) { setEmailErr('Email invalide'); ok = false; }
    else setEmailErr('');

    // Seul le minimum de 6 caractères est bloquant côté formulaire.
    // La popup se charge de guider vers un mot de passe plus fort.
    if (!password)                     { setPwdErr('Mot de passe requis');    ok = false; }
    else if (password.length < MIN_PWD){ setPwdErr(`${MIN_PWD} caractères minimum`); ok = false; }
    else setPwdErr('');

    if (!confirm)                  { setConfirmErr('Confirmez le mot de passe');               ok = false; }
    else if (confirm !== password) { setConfirmErr('Les mots de passe ne correspondent pas');  ok = false; }
    else setConfirmErr('');

    return ok;
  }, [pseudo, email, password, confirm]);

  // ── Appel API réel ────────────────────────────────────────────────────────
  const doRegister = useCallback(async () => {
    setWeakModalVisible(false);
    try {
      setLoading(true);
      setGlobalErr('');
      await register({ pseudo, email, password });
      navigation.navigate('EmailVerification', { email });
    } catch (error) {
      const status = error?.status;
      const msg    = error?.data?.message ?? '';
      if (status === 429) {
        setErrType('warning');
        setGlobalErr('Trop de tentatives. Veuillez patienter avant de réessayer.');
      } else if (status >= 500) {
        setErrType('info');
        setGlobalErr('Une erreur est survenue, notre équipe est sur le coup.');
      } else if (msg.toLowerCase().includes('email')) {
        setErrType('error');
        setGlobalErr('Cet email est déjà utilisé.');
      } else {
        setErrType('error');
        setGlobalErr("Erreur lors de l'inscription. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }, [pseudo, email, password, navigation]);

  // ── Soumission : validation + vérification de force ───────────────────────
  const handleSubmit = useCallback(() => {
    if (!validate()) return;

    const strength = getStrength(password);
    if (strength < 3) {
      // Mot de passe faible ou moyen → popup pédagogique
      setWeakModalVisible(true);
    } else {
      // Fort → inscription directe
      doRegister();
    }
  }, [validate, password, doRegister]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDeep} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={s.titleBlock}>
            <Text style={s.title}>Créer un compte</Text>
            <Text style={s.tagline}>Rejoignez la communauté Athly</Text>
          </View>

          <AuthInput
            label="Pseudo"
            icon="person-outline"
            placeholder="VotreAlias"
            value={pseudo}
            onChangeText={(v) => { setPseudo(v); if (pseudoErr) setPseudoErr(''); }}
            error={pseudoErr}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <AuthInput
            label="Email"
            icon="mail-outline"
            placeholder="votre@email.com"
            value={email}
            onChangeText={(v) => { setEmail(v); if (emailErr) setEmailErr(''); }}
            onBlur={() => {
              if (!email) setEmailErr('Email requis');
              else if (!EMAIL_RE.test(email)) setEmailErr('Email invalide');
              else setEmailErr('');
            }}
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
            onChangeText={(v) => {
              setPassword(v);
              if (pwdErr && v.length >= MIN_PWD) setPwdErr('');
              if (confirmErr && confirm) {
                setConfirmErr(v !== confirm ? 'Les mots de passe ne correspondent pas' : '');
              }
            }}
            isPassword
            secureTextEntry={!showPwd}
            showPassword={showPwd}
            setShowPassword={setShowPwd}
            error={pwdErr}
          />
          <StrengthBar password={password} />

          <AuthInput
            label="Confirmer le mot de passe"
            icon="shield-checkmark-outline"
            placeholder="••••••••"
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              if (confirmErr) {
                setConfirmErr(v !== password ? 'Les mots de passe ne correspondent pas' : '');
              }
            }}
            isPassword
            secureTextEntry={!showConfirm}
            showPassword={showConfirm}
            setShowPassword={setShowConfirm}
            error={confirmErr}
          />

          {globalErr ? <NotificationBanner message={globalErr} type={errType} /> : null}

          <TouchableOpacity
            style={[s.primaryBtn, !isFormValid && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading || !isFormValid}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.btnText, !isFormValid && s.btnTextMuted]}>S'inscrire</Text>
            }
          </TouchableOpacity>

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Déjà inscrit ? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={s.linkBold}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Popup "Mot de passe simple" — rendue hors du ScrollView pour couvrir tout l'écran */}
      <WeakPasswordModal
        visible={weakModalVisible}
        onImprove={() => setWeakModalVisible(false)}
        onCreate={doRegister}
        loading={loading}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.backgroundDeep },
  content:  { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 56 },

  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 16 },

  titleBlock: { marginBottom: 32 },
  title: {
    color: Colors.textPrimary, fontSize: 30, fontWeight: '700',
    letterSpacing: -0.5, marginBottom: 6,
  },
  tagline: { color: Colors.textMuted, fontSize: 14, letterSpacing: 0.2 },

  primaryBtn: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnDisabled:  { backgroundColor: 'rgba(255,255,255,0.08)', shadowOpacity: 0, elevation: 0 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },
  btnTextMuted: { color: Colors.textMuted },

  switchRow:   { flexDirection: 'row', justifyContent: 'center', marginTop: 36 },
  switchLabel: { color: Colors.textMuted, fontSize: 14 },
  linkBold:    { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});
