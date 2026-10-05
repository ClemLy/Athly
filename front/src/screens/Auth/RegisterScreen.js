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
import PasswordGuide, { isPasswordValid, PASSWORD_RULES_MESSAGE } from '../../components/inputs/PasswordGuide';
import { NotificationBanner } from '../../components/common';
import { register } from '../../services';
import { haptics } from '../../services';
import { getErrorMessage } from '../../utils/errorMessages';

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PSEUDO = 30;

// ─── Popup "Pseudo non autorisé" ──────────────────────────────────────────────
// Affichée quand la modération automatique du serveur refuse le pseudo
// (code PSEUDO_NOT_ALLOWED) : explique pourquoi et vide le champ.

function PseudoRejectedModal({ visible, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={pm.backdrop}>
        <View style={pm.card}>
          <View style={pm.iconWrap}>
            <Ionicons name="alert-circle" size={30} color={Colors.destructive} />
          </View>

          <Text style={pm.title}>Pseudo non autorisé</Text>
          <Text style={pm.body}>
            Ce pseudo contient un terme injurieux ou inapproprié. Tes amis le
            verront partout dans l'app : choisis-en un autre.
          </Text>

          <TouchableOpacity style={pm.closeBtn} onPress={onClose} activeOpacity={0.85} accessibilityRole="button">
            <Text style={pm.closeTxt}>Choisir un autre pseudo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.bgDeep2,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 20,
  },
  iconWrap: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  title: { color: Colors.textPrimary, fontSize: 19, fontWeight: '800', letterSpacing: -0.3, marginBottom: 12, textAlign: 'center' },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  closeBtn: {
    width: '100%', height: 50, borderRadius: 13,
    backgroundColor: Colors.destructive, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.destructive, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  closeTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const [pseudo,   setPseudo]   = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [pseudoErr,   setPseudoErr]   = useState('');
  const [emailErr,    setEmailErr]    = useState('');
  const [pwdErr,      setPwdErr]      = useState('');
  const [confirmErr,  setConfirmErr]  = useState('');
  const [referralErr, setReferralErr] = useState('');
  const [consentErr,  setConsentErr]  = useState('');
  const [globalErr,   setGlobalErr]   = useState('');
  const [errType,     setErrType]     = useState('error');
  const [emailTaken,  setEmailTaken]  = useState(false);

  const [pseudoRejectedVisible, setPseudoRejectedVisible] = useState(false);

  // ── Validation UI (erreurs champ par champ, au clic sur "Créer mon compte") ──
  const validate = useCallback(() => {
    let ok = true;
    const p = pseudo.trim();

    if (!p)                        { setPseudoErr('Choisis un pseudo.'); ok = false; }
    else if (p.length < 2)         { setPseudoErr('Ton pseudo doit faire au moins 2 caractères.'); ok = false; }
    else if (p.length > MAX_PSEUDO){ setPseudoErr(`Ton pseudo ne peut pas dépasser ${MAX_PSEUDO} caractères.`); ok = false; }
    else if (/[#<>]/.test(p))      { setPseudoErr('Ton pseudo ne peut pas contenir les caractères # < >.'); ok = false; }
    else setPseudoErr('');

    const e = email.trim();
    if (!e)                     { setEmailErr('Entre ton adresse email.'); ok = false; }
    else if (!EMAIL_RE.test(e)) { setEmailErr('Cette adresse email n\'est pas valide. Exemple : nom@exemple.fr'); ok = false; }
    else setEmailErr('');

    if (!password)                      { setPwdErr('Choisis un mot de passe.'); ok = false; }
    else if (!isPasswordValid(password)){ setPwdErr(PASSWORD_RULES_MESSAGE); ok = false; }
    else setPwdErr('');

    if (!confirm)                  { setConfirmErr('Retape ton mot de passe pour le confirmer.'); ok = false; }
    else if (confirm !== password) { setConfirmErr('Les deux mots de passe ne sont pas identiques.'); ok = false; }
    else setConfirmErr('');

    if (!accepted) { setConsentErr('Accepte les conditions pour créer ton compte.'); ok = false; }
    else setConsentErr('');

    return ok;
  }, [pseudo, email, password, confirm, accepted]);

  // ── Appel API ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setGlobalErr('');
    setEmailTaken(false);
    if (!validate()) {
      haptics.error();
      return;
    }
    try {
      setLoading(true);
      setReferralErr('');
      await register({
        pseudo: pseudo.trim(),
        email: email.trim(),
        password,
        referralCode: referralCode.trim(),
      });
      navigation.navigate('EmailVerification', { email: email.trim() });
    } catch (error) {
      const code = error?.data?.code;
      haptics.error();
      if (code === 'PSEUDO_NOT_ALLOWED') {
        setPseudoErr('Ce pseudo n\'est pas autorisé.');
        setPseudoRejectedVisible(true);
      } else if (code === 'EMAIL_TAKEN') {
        setEmailErr('Un compte existe déjà avec cette adresse.');
        setEmailTaken(true);
      } else if (code === 'REFERRAL_INVALID') {
        setReferralErr(getErrorMessage(error, 'Ce code de parrainage n\'existe pas.'));
      } else {
        setErrType(error?.status === 429 || error?.network ? 'warning' : 'error');
        setGlobalErr(getErrorMessage(error, 'La création du compte n\'a pas abouti. Réessaie dans un instant.'));
      }
    } finally {
      setLoading(false);
    }
  }, [validate, pseudo, email, password, referralCode, navigation]);

  const openLegal = (doc) => navigation.navigate('Legal', { doc });

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
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Retour à la connexion"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={s.titleBlock}>
            <Text style={s.title} accessibilityRole="header">Créer un compte</Text>
            <Text style={s.tagline}>Tes séances, ton XP et tes records, au même endroit.</Text>
          </View>

          <AuthInput
            label="Pseudo"
            icon="person-outline"
            placeholder="Ton nom d'athlète"
            value={pseudo}
            onChangeText={(v) => { setPseudo(v); if (pseudoErr) setPseudoErr(''); }}
            error={pseudoErr}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            maxLength={MAX_PSEUDO}
            enterKeyHint="next"
          />

          <AuthInput
            label="Email"
            icon="mail-outline"
            placeholder="nom@exemple.fr"
            value={email}
            onChangeText={(v) => { setEmail(v); if (emailErr) { setEmailErr(''); setEmailTaken(false); } }}
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
            enterKeyHint="next"
          />
          {emailTaken && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Auth')}
              style={s.inlineLink}
              accessibilityRole="link"
            >
              <Text style={s.inlineLinkTxt}>Se connecter avec cette adresse</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}

          <AuthInput
            label="Mot de passe"
            icon="lock-closed-outline"
            placeholder="8 caractères minimum"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (pwdErr && isPasswordValid(v)) setPwdErr('');
              if (confirmErr && confirm) {
                setConfirmErr(v !== confirm ? 'Les deux mots de passe ne sont pas identiques.' : '');
              }
            }}
            isPassword
            secureTextEntry={!showPwd}
            showPassword={showPwd}
            setShowPassword={setShowPwd}
            error={pwdErr}
            autoComplete="new-password"
            textContentType="newPassword"
            enterKeyHint="next"
          />
          <PasswordGuide password={password} />

          <AuthInput
            label="Confirmer le mot de passe"
            icon="shield-checkmark-outline"
            placeholder="Retape ton mot de passe"
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              if (confirmErr) {
                setConfirmErr(v !== password ? 'Les deux mots de passe ne sont pas identiques.' : '');
              }
            }}
            isPassword
            secureTextEntry={!showConfirm}
            showPassword={showConfirm}
            setShowPassword={setShowConfirm}
            error={confirmErr}
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <AuthInput
            label="Code de parrainage (facultatif)"
            icon="gift-outline"
            placeholder="ATH-XXXXX"
            value={referralCode}
            onChangeText={(v) => { setReferralCode(v.toUpperCase()); if (referralErr) setReferralErr(''); }}
            error={referralErr}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
          />

          {/* Consentement explicite (RGPD) : l'app traite poids, taille et date de naissance */}
          <TouchableOpacity
            style={s.consentRow}
            onPress={() => { setAccepted((v) => !v); if (consentErr) setConsentErr(''); }}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            accessibilityLabel="J'accepte les conditions d'utilisation et la politique de confidentialité"
          >
            <View style={[s.checkbox, accepted && s.checkboxActive, consentErr && !accepted && s.checkboxError]}>
              {accepted && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={s.consentTxt}>
              J'accepte les{' '}
              <Text style={s.consentLink} onPress={() => openLegal('conditions')} accessibilityRole="link">
                conditions d'utilisation
              </Text>
              {' '}et la{' '}
              <Text style={s.consentLink} onPress={() => openLegal('confidentialite')} accessibilityRole="link">
                politique de confidentialité
              </Text>
              .
            </Text>
          </TouchableOpacity>
          {consentErr ? (
            <Text style={s.consentErr} accessibilityRole="alert">{consentErr}</Text>
          ) : null}

          {globalErr ? <NotificationBanner message={globalErr} type={errType} /> : null}

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityState={{ busy: loading, disabled: loading }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Créer mon compte</Text>
            }
          </TouchableOpacity>

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Déjà inscrit ? </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="link"
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Text style={s.linkBold}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PseudoRejectedModal
        visible={pseudoRejectedVisible}
        onClose={() => { setPseudoRejectedVisible(false); setPseudo(''); }}
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

  inlineLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: -6, marginBottom: 14, paddingVertical: 4,
  },
  inlineLinkTxt: { color: Colors.primary, fontSize: 13.5, fontWeight: '700' },

  consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6, paddingVertical: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.textMuted,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12, marginTop: 1,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxError:  { borderColor: Colors.error },
  consentTxt:  { flex: 1, color: Colors.textSecondary, fontSize: 13.5, lineHeight: 20 },
  consentLink: { color: Colors.primary, fontWeight: '700' },
  consentErr:  { color: Colors.error, fontSize: 13, marginTop: 6, marginLeft: 34 },

  primaryBtn: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },

  switchRow:   { flexDirection: 'row', justifyContent: 'center', marginTop: 36 },
  switchLabel: { color: Colors.textMuted, fontSize: 14 },
  linkBold:    { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});
