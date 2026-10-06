import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform,
  StatusBar, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import AuthInput from '../../components/inputs/AuthInput';
import PasswordGuide, { isPasswordValid, PASSWORD_RULES_MESSAGE } from '../../components/inputs/PasswordGuide';
import { NotificationBanner } from '../../components/common';
import { PrimaryButton, useEntrance, useShake } from '../../components/auth/AuthKit';
import AvatarFrame from '../../components/profile/AvatarFrame';
import { register, getRank } from '../../services';
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
  const [showReferral, setShowReferral] = useState(false);
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

  // Entrée échelonnée (en-tête → aperçu → formulaire → actions) et secousse
  // du formulaire quand la validation échoue.
  const enter = useEntrance(4);
  const [shakeStyle, shake] = useShake();

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
      shake();
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
      haptics.success();
      navigation.navigate('EmailVerification', { email: email.trim() });
    } catch (error) {
      const code = error?.data?.code;
      haptics.error();
      shake();
      if (code === 'PSEUDO_NOT_ALLOWED') {
        setPseudoErr('Ce pseudo n\'est pas autorisé.');
        setPseudoRejectedVisible(true);
      } else if (code === 'EMAIL_TAKEN') {
        setEmailErr('Un compte existe déjà avec cette adresse.');
        setEmailTaken(true);
      } else if (code === 'REFERRAL_INVALID') {
        setShowReferral(true);
        setReferralErr(getErrorMessage(error, 'Ce code de parrainage n\'existe pas.'));
      } else {
        setErrType(error?.status === 429 || error?.network ? 'warning' : 'error');
        setGlobalErr(getErrorMessage(error, 'La création du compte n\'a pas abouti. Réessaie dans un instant.'));
      }
    } finally {
      setLoading(false);
    }
  }, [validate, pseudo, email, password, referralCode, navigation, shake]);

  const openLegal = (doc) => navigation.navigate('Legal', { doc });
  const initial = (pseudo.trim()[0] || '?').toUpperCase();

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDeep} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={enter[0]}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Retour à la connexion"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>

            <Text style={s.title} accessibilityRole="header">Crée ton athlète</Text>
            <Text style={s.tagline}>Niveau 1, cadre Acier. Tout le reste se mérite.</Text>
          </Animated.View>

          {/* Aperçu en direct : l'initiale suit le pseudo tapé. */}
          <Animated.View style={[s.preview, enter[1]]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <AvatarFrame shapeId="circle" colorId="iron" size={52} userInitial={initial} />
            <View style={s.previewInfo}>
              <Text style={[s.previewName, !pseudo.trim() && s.previewPlaceholder]} numberOfLines={1}>
                {pseudo.trim() || 'Ton pseudo'}
              </Text>
              <Text style={s.previewMeta}>Niv. 1 · {getRank(1).name}</Text>
            </View>
            <View style={s.previewXp}>
              <View style={s.previewXpFill} />
            </View>
          </Animated.View>

          <Animated.View style={[enter[2], shakeStyle]}>
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

            {/* Parrainage replié : la plupart des inscrits n'en ont pas. */}
            {showReferral ? (
              <AuthInput
                label="Code de parrainage"
                icon="gift-outline"
                placeholder="ATH-XXXXX"
                value={referralCode}
                onChangeText={(v) => { setReferralCode(v.toUpperCase()); if (referralErr) setReferralErr(''); }}
                error={referralErr}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
                autoFocus
              />
            ) : (
              <TouchableOpacity
                style={s.referralToggle}
                onPress={() => { haptics.selection(); setShowReferral(true); }}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons name="gift-outline" size={16} color={Colors.textSecondary} />
                <Text style={s.referralToggleTxt}>J'ai un code de parrainage</Text>
              </TouchableOpacity>
            )}

            {/* Consentement explicite (RGPD) : l'app traite poids, taille et date de naissance */}
            <TouchableOpacity
              style={s.consentRow}
              onPress={() => { haptics.selection(); setAccepted((v) => !v); if (consentErr) setConsentErr(''); }}
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
          </Animated.View>

          <Animated.View style={enter[3]}>
            <PrimaryButton label="Créer mon compte" onPress={handleSubmit} loading={loading} style={s.primaryBtn} />

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
          </Animated.View>
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
  content:  { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },

  backBtn: {
    width: 40, height: 40, borderRadius: 12, marginBottom: 18, marginLeft: -6,
    justifyContent: 'center', alignItems: 'center',
  },

  title: {
    color: Colors.textPrimary, fontSize: 30, fontWeight: '800',
    letterSpacing: -0.8, marginBottom: 6,
  },
  tagline: { color: Colors.textSecondary, fontSize: 15, lineHeight: 21 },

  preview: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 22, marginBottom: 24,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  previewInfo: { flex: 1, marginLeft: 14 },
  previewName: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  previewPlaceholder: { color: Colors.textMuted },
  previewMeta: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '600', marginTop: 3 },
  previewXp: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  previewXpFill: { width: '6%', height: '100%', backgroundColor: Colors.primary },

  inlineLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: -6, marginBottom: 14, paddingVertical: 4,
  },
  inlineLinkTxt: { color: Colors.primary, fontSize: 13.5, fontWeight: '700' },

  referralToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 10,
  },
  referralToggleTxt: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },

  consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6, paddingVertical: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 1.5, borderColor: Colors.borderDim,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12, marginTop: 1,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxError:  { borderColor: Colors.error },
  consentTxt:  { flex: 1, color: Colors.textSecondary, fontSize: 13.5, lineHeight: 20 },
  consentLink: { color: Colors.textPrimary, fontWeight: '700', textDecorationLine: 'underline' },
  consentErr:  { color: Colors.error, fontSize: 13, marginTop: 6, marginLeft: 34 },

  primaryBtn: { marginTop: 22 },

  switchRow:   { flexDirection: 'row', justifyContent: 'center', marginTop: 26 },
  switchLabel: { color: Colors.textMuted, fontSize: 14 },
  linkBold:    { color: Colors.primary, fontWeight: '800', fontSize: 14 },
});
