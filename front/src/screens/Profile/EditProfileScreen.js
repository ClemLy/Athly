import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  useWindowDimensions,
} from 'react-native';

import { Colors } from '../../constants/theme';
import { updateMyProfile } from '../../services';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import { setBirthdate } from '../../services';
import BirthdatePicker from '../../components/profile/BirthdatePicker';
import { ConfirmModal } from '../../components/common';
import { getErrorMessage } from '../../utils/errorMessages';

// ─── EditProfileScreen ────────────────────────────────────────────────────────
// Pas de header custom : on configure navigation.setOptions via useLayoutEffect.
// Style "réglages iOS" : groupes de lignes avec séparateurs, fond sombre.

const SELECTIONS = {
  sexe:     [{ value: 'H', label: 'Homme' }, { value: 'F', label: 'Femme' }, { value: 'Autre', label: 'Autre' }],
  niveau:   ['Débutant', 'Intermédiaire', 'Avancé'],
  objectif: ['Prise de masse', 'Perte de poids', 'Entretien', 'Force'],
  rythme:   ['1', '2', '3', '4', '5', '6', '7'],
};

// L'API stocke objectif en minuscules ("prise de masse"), les chips utilisent des majuscules.
// Cette fonction trouve la valeur affichable correspondante.
function normalizeObjectif(val) {
  if (!val) return '';
  return SELECTIONS.objectif.find((o) => o.toLowerCase() === val.toLowerCase()) || val;
}

// Valeurs du formulaire à partir du profil. Un champ jamais renseigné reste
// vide : on n'invente pas de sexe ou d'objectif à la place de l'utilisateur.
function formFromUser(user) {
  return {
    pseudo:        user?.pseudo || user?.name || '',
    poids:         user?.poids?.toString() || '',
    taille:        user?.taille?.toString() || '',
    poidsCible:    user?.poidsCible?.toString() || '',
    sexe:          user?.sexe || '',
    objectif:      normalizeObjectif(user?.objectif),
    niveauSportif: user?.niveauSportif || '',
    rythme:        user?.rythme?.toString() || '',
  };
}

export default function EditProfileScreen({ navigation }) {
  const { user, refetch: refetchUser } = useUser();
  const { showToast } = useToast();
  const [formData, setFormData] = useState(() => formFromUser(user));
  const initialRef = useRef(JSON.stringify(formFromUser(user)));
  const savedRef = useRef(false);
  const [leaveAction, setLeaveAction] = useState(null);

  // Ouvert directement (lien, rechargement de la page) : le profil n'est pas
  // encore chargé, on le demande pour ne pas afficher un formulaire vide.
  useEffect(() => {
    if (!user) refetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronise le formulaire si le contexte user se met à jour (ex: premier chargement)
  useEffect(() => {
    if (!user) return;
    const next = formFromUser(user);
    initialRef.current = JSON.stringify(next);
    setFormData(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.pseudo]);

  // Quitter avec des modifications non enregistrées demande confirmation.
  const dirty = JSON.stringify(formData) !== initialRef.current;
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (!dirty || savedRef.current) return;
    e.preventDefault();
    setLeaveAction(e.data.action);
  }), [navigation, dirty]);

  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  const set = useCallback((key, val) => {
    setFormData((p) => ({ ...p, [key]: val }));
    // L'erreur d'un champ disparaît dès qu'on le corrige
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  // Use a ref so the header button always calls the latest handleUpdate
  const handleUpdateRef = useRef(null);

  const handleUpdate = useCallback(async () => {
    // Validation locale (mêmes règles que le serveur) avant envoi
    const nameVal = formData.pseudo.trim();
    const errs = {};
    if (!nameVal) errs.pseudo = 'Le pseudo est obligatoire.';
    else if (nameVal.length < 2) errs.pseudo = 'Le pseudo doit faire au moins 2 caractères.';
    else if (nameVal.length > 30) errs.pseudo = 'Le pseudo ne peut pas dépasser 30 caractères.';
    else if (/[#<>]/.test(nameVal)) errs.pseudo = 'Le pseudo ne peut pas contenir les caractères # < >.';

    // Bornes identiques au serveur (back/validators/user.validator.js)
    const num = (v) => parseFloat(String(v || '').replace(',', '.'));
    const checkRange = (key, label, min, max) => {
      if (!formData[key]) return;
      const n = num(formData[key]);
      if (Number.isNaN(n)) errs[key] = `${label} doit être un nombre.`;
      else if (n < min || n > max) errs[key] = `${label} doit être compris entre ${min} et ${max}.`;
    };
    checkRange('poids', 'Le poids', 30, 250);
    checkRange('poidsCible', 'Le poids cible', 30, 250);
    checkRange('taille', 'La taille', 100, 250);
    checkRange('rythme', 'Le nombre de séances', 1, 7);

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    // On ne transmet que les champs renseignés : poids/taille/rythme n'ont pas
    // .allow(null) dans le schema Joi → les envoyer à null déclenche une 400.
    // objectif : le backend attend les minuscules ("prise de masse"), le front
    // affiche des majuscules → on normalise avant envoi.
    const parsedPoids      = parseFloat(formData.poids?.replace(',', '.'))      || null;
    const parsedTaille     = parseInt(formData.taille, 10)                       || null;
    const parsedPoidsCible = parseFloat(formData.poidsCible?.replace(',', '.')) || null;
    const parsedRythme     = parseInt(formData.rythme, 10)                       || null;

    const payload = {
      pseudo: nameVal,
      ...(formData.sexe          && { sexe:          formData.sexe }),
      ...(formData.niveauSportif && { niveauSportif: formData.niveauSportif }),
      ...(formData.objectif      && { objectif:      formData.objectif.toLowerCase() }),
      ...(parsedPoids      !== null && { poids:      parsedPoids }),
      ...(parsedTaille     !== null && { taille:     parsedTaille }),
      ...(parsedPoidsCible !== null && { poidsCible: parsedPoidsCible }),
      ...(parsedRythme     !== null && { rythme:     parsedRythme }),
    };
    try {
      const res = await updateMyProfile(payload);
      if (res.success) {
        refetchUser(); // met à jour le UserContext → ProfileScreen + SettingsScreen sync instantané
        showToast('Profil mis à jour.', 'success');
        savedRef.current = true;
        navigation.goBack();
      }
    } catch (error) {
      // La 401 (JWT expiré) est gérée par l'intercepteur Axios → pas de toast ici.
      if (error.isSessionExpired) return;

      // Erreurs de validation rattachées à leur champ (voir back/middleware/validate.middleware.js)
      const fields = error.data?.fields;
      if (error.status === 400 && fields && Object.keys(fields).length > 0) {
        setErrors(fields);
        showToast('Corrige les champs signalés en rouge.', 'error');
        return;
      }
      showToast(getErrorMessage(error, 'La mise à jour du profil n\'a pas abouti. Réessaie dans un instant.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, navigation]);

  handleUpdateRef.current = handleUpdate;

  // Anti-triche : setBirthdate est un endpoint dédié (pas /users/me), verrouillé
  // côté backend dès la première saisie. On re-throw en cas d'échec pour que
  // BirthdatePicker garde sa modale ouverte et permette un nouvel essai.
  const handleBirthdateConfirm = useCallback(async (dateObj) => {
    try {
      await setBirthdate(dateObj.toISOString());
      await refetchUser();
      showToast('Date de naissance enregistrée. Un coffre t\'attend dans ton inventaire.', 'success');
    } catch (error) {
      if (error.isSessionExpired) throw error;
      showToast(getErrorMessage(error, 'La date n\'a pas pu être enregistrée. Réessaie dans un instant.'), 'error');
      throw error;
    }
  }, [refetchUser, showToast]);

  // Bouton "Enregistrer" dans l'en-tête, recréé quand l'état de chargement change.
  // Sur un petit écran (iPhone SE), il déborderait à côté du titre : le bouton
  // du bas du formulaire suffit.
  const { width } = useWindowDimensions();
  const compactHeader = width < 360;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: compactHeader ? () => null : () => (
        <TouchableOpacity accessibilityRole="button"
          accessibilityLabel="Enregistrer le profil"
          onPress={() => handleUpdateRef.current()}
          disabled={loading}
          style={[styles.headerSaveBtn, loading && { opacity: 0.45 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.headerSaveTxt}>{loading ? 'Envoi…' : 'Enregistrer'}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, loading, compactHeader]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        {/* ═══ IDENTITÉ ══════════════════════════════════════════════════════ */}
        <SectionLabel label="Identité" />
        <SettingsGroup>
          <SettingsRow label="Pseudo" last error={errors.pseudo}>
            <TextInput
              style={[styles.inlineInput, errors.pseudo && styles.inlineInputError]}
              value={formData.pseudo}
              onChangeText={(v) => set('pseudo', v)}
              accessibilityLabel="Pseudo"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              placeholder="Ton pseudo"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              returnKeyType="done"
            />
          </SettingsRow>
        </SettingsGroup>

        {/* ═══ PHYSIQUE ══════════════════════════════════════════════════════ */}
        <SectionLabel label="Physique" />
        <SettingsGroup>
          <SettingsRow label="Sexe" last={false} stacked>
            <View style={styles.chipRow}>
              {SELECTIONS.sexe.map((o) => (
                <MiniChip key={o.value} label={o.label} selected={formData.sexe === o.value} onPress={() => set('sexe', o.value)} />
              ))}
            </View>
          </SettingsRow>
          <SettingsRow label="Poids actuel (kg)" last={false} error={errors.poids}>
            <TextInput
              style={styles.inlineInput}
              value={formData.poids}
              onChangeText={(v) => set('poids', v)}
              accessibilityLabel="Poids actuel en kilos"
              placeholder="ex : 72"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardType="decimal-pad"
            />
          </SettingsRow>
          <SettingsRow label="Poids cible (kg)" last={false} error={errors.poidsCible}>
            <TextInput
              style={styles.inlineInput}
              value={formData.poidsCible}
              onChangeText={(v) => set('poidsCible', v)}
              accessibilityLabel="Poids cible en kilos"
              placeholder="ex : 75"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardType="decimal-pad"
            />
          </SettingsRow>
          <SettingsRow label="Taille (cm)" last={false} error={errors.taille}>
            <TextInput
              style={styles.inlineInput}
              value={formData.taille}
              onChangeText={(v) => set('taille', v)}
              accessibilityLabel="Taille en centimètres"
              placeholder="ex : 178"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardType="number-pad"
            />
          </SettingsRow>
          <SettingsRow label="Date de naissance" last>
            <BirthdatePicker
              value={user?.isBirthdateSet && user?.birthdate ? new Date(user.birthdate) : null}
              onConfirm={handleBirthdateConfirm}
            />
          </SettingsRow>
        </SettingsGroup>

        {/* ═══ PROGRAMME ═════════════════════════════════════════════════════ */}
        <SectionLabel label="Programme" />
        <SettingsGroup>
          <SettingsRow label="Niveau sportif" last={false} stacked>
            <View style={styles.chipRow}>
              {SELECTIONS.niveau.map((n) => (
                <MiniChip key={n} label={n} selected={formData.niveauSportif === n} onPress={() => set('niveauSportif', n)} />
              ))}
            </View>
          </SettingsRow>
          <SettingsRow label="Objectif" last={false} stacked>
            <View style={styles.chipRow}>
              {SELECTIONS.objectif.map((o) => (
                <MiniChip key={o} label={o} selected={formData.objectif === o} onPress={() => set('objectif', o)} />
              ))}
            </View>
          </SettingsRow>
          <SettingsRow label="Séances par semaine" last stacked error={errors.rythme}>
            <View style={styles.chipRow}>
              {SELECTIONS.rythme.map((n) => (
                <MiniChip key={n} label={n} selected={formData.rythme === n} onPress={() => set('rythme', n)} square />
              ))}
            </View>
          </SettingsRow>
        </SettingsGroup>

        {/* ─── Save bottom button ─── */}
        <TouchableOpacity accessibilityRole="button"
          style={[styles.saveBtn, loading && { opacity: 0.5 }]}
          onPress={handleUpdate}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{loading ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>

      <ConfirmModal
        visible={!!leaveAction}
        icon="create-outline"
        title="Quitter sans enregistrer ?"
        body="Tes modifications seront perdues."
        confirmLabel="Quitter"
        cancelLabel="Rester"
        destructive
        onConfirm={() => { const a = leaveAction; setLeaveAction(null); savedRef.current = true; navigation.dispatch(a); }}
        onCancel={() => setLeaveAction(null)}
      />
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }) {
  return <Text style={styles.sectionLabel} accessibilityRole="header">{label}</Text>;
}

function SettingsGroup({ children }) {
  return <View style={styles.group}>{children}</View>;
}

// stacked : libellé au-dessus, choix en dessous (pour les listes de puces,
// qui ne tiennent pas à côté du libellé sur un petit écran)
function SettingsRow({ label, children, last, error, stacked }) {
  return (
    <View style={[styles.row, stacked && styles.rowStacked, !last && styles.rowSep, error && styles.rowError]}>
      <View style={[styles.rowLabelWrap, stacked && styles.rowLabelStacked]}>
        <Text style={styles.rowLabel}>{label}</Text>
        {error ? <Text style={styles.rowErrMsg} accessibilityRole="alert">{error}</Text> : null}
      </View>
      <View style={stacked ? styles.rowBelow : styles.rowRight}>{children}</View>
    </View>
  );
}

function MiniChip({ label, selected, onPress, square }) {
  return (
    <TouchableOpacity accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={[styles.chip, square && styles.chipSquare, selected && styles.chipSel]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipTxt, selected && styles.chipTxtSel]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GRP_BG     = 'rgba(255,255,255,0.05)';
const GRP_BORDER = 'rgba(255,255,255,0.09)';
const SEP        = 'rgba(255,255,255,0.07)';

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgAbyss },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // ── Native header ────────────────────────────────────────────────────────────
  headerSaveBtn: { marginRight: 16 },
  headerSaveTxt: { color: Colors.primary, fontSize: 15, fontWeight: '800' },

  // ── Section labels (iOS style) ───────────────────────────────────────────────
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },

  // ── Settings group (rounded card of rows) ────────────────────────────────────
  group: {
    backgroundColor: GRP_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GRP_BORDER,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowSep: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEP,
  },
  rowLabelWrap: { flex: 1, marginRight: 12 },
  rowLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  rowError: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.error,
    paddingLeft: 12,
  },
  rowErrMsg: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 3,
  },
  rowStacked: { flexDirection: 'column', alignItems: 'stretch' },
  rowLabelStacked: { marginRight: 0, marginBottom: 10 },
  rowBelow: { alignSelf: 'stretch' },
  rowRight: {
    flex: 1,
    alignItems: 'flex-end',
  },

  // ── Inline text inputs ───────────────────────────────────────────────────────
  inlineInput: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'right',
    paddingVertical: 8,
    paddingHorizontal: 0,
    minWidth: 80,
    alignSelf: 'stretch',
  },
  inlineInputError: {
    color: Colors.error,
  },
  inlineInputMulti: {
    textAlign: 'left',
    textAlignVertical: 'top',
    minHeight: 52,
  },

  // ── Mini chips ───────────────────────────────────────────────────────────────
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GRP_BORDER,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipSquare: { minWidth: 40, alignItems: 'center', paddingHorizontal: 0 },
  chipSel:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt:    { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTxtSel: { color: '#fff' },

  // ── Bottom save button ───────────────────────────────────────────────────────
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
