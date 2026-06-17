import React, { useState, useCallback, useLayoutEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';

import { Colors } from '../../constants/theme';
import API from '../../api/api';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';

// ─── EditProfileScreen ────────────────────────────────────────────────────────
// Pas de header custom : on configure navigation.setOptions via useLayoutEffect.
// Style "réglages iOS" : groupes de lignes avec séparateurs, fond sombre.

const SELECTIONS = {
  sexe:     ['H', 'F', 'Autre'],
  niveau:   ['Débutant', 'Intermédiaire', 'Avancé'],
  objectif: ['Prise de masse', 'Perte de poids', 'Entretien', 'Force'],
};

// L'API stocke objectif en minuscules ("prise de masse"), les chips utilisent des majuscules.
// Cette fonction trouve la valeur affichable correspondante.
function normalizeObjectif(val) {
  if (!val) return '';
  return SELECTIONS.objectif.find((o) => o.toLowerCase() === val.toLowerCase()) || val;
}

export default function EditProfileScreen({ navigation }) {
  const { user, refetch: refetchUser } = useUser();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name:          user?.name          || '',
    bio:           user?.bio           || '',
    poids:         user?.poids?.toString()      || '',
    taille:        user?.taille?.toString()     || '',
    poidsCible:    user?.poidsCible?.toString() || '',
    sexe:          user?.sexe          || '',
    objectif:      normalizeObjectif(user?.objectif),
    niveauSportif: user?.niveauSportif || 'Débutant',
    rythme:        user?.rythme?.toString() || '',
  });

  // Synchronise le formulaire si le contexte user se met à jour (ex: premier chargement)
  React.useEffect(() => {
    if (!user) return;
    setFormData({
      name:          user.name          || '',
      bio:           user.bio           || '',
      poids:         user.poids?.toString()      || '',
      taille:        user.taille?.toString()     || '',
      poidsCible:    user.poidsCible?.toString() || '',
      sexe:          user.sexe          || 'H',
      objectif:      normalizeObjectif(user.objectif) || 'Entretien',
      niveauSportif: user.niveauSportif || 'Débutant',
      rythme:        user.rythme?.toString() || '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  const set = useCallback((key, val) => setFormData((p) => ({ ...p, [key]: val })), []);

  // Use a ref so the header button always calls the latest handleUpdate
  const handleUpdateRef = useRef(null);

  const handleUpdate = useCallback(async () => {
    // Frontend validation — only name is required, bio is always optional
    const nameVal = formData.name.trim();
    const errs = {};
    if (!nameVal) errs.name = 'Le pseudo est requis.';
    else if (nameVal.length < 2) errs.name = 'Le pseudo doit faire au moins 2 caractères.';

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
      name: nameVal,
      ...(formData.sexe          && { sexe:          formData.sexe }),
      ...(formData.niveauSportif && { niveauSportif: formData.niveauSportif }),
      ...(formData.objectif      && { objectif:      formData.objectif.toLowerCase() }),
      ...(parsedPoids      !== null && { poids:      parsedPoids }),
      ...(parsedTaille     !== null && { taille:     parsedTaille }),
      ...(parsedPoidsCible !== null && { poidsCible: parsedPoidsCible }),
      ...(parsedRythme     !== null && { rythme:     parsedRythme }),
    };
    try {
      const res = await API.put('/users/me', payload);
      if (res.data.success) {
        refetchUser(); // met à jour le UserContext → ProfileScreen + SettingsScreen sync instantané
        showToast('Profil mis à jour avec succès !', 'success');
        navigation.goBack();
      }
    } catch (error) {
      // La 401 (JWT expiré) est gérée par l'intercepteur Axios → pas de toast ici.
      if (error.isSessionExpired) return;

      if (error.status === 400 && error.data?.details) {
        const fieldErrors = {};
        const details = error.data.details;
        if (Array.isArray(details)) {
          details.forEach((d) => {
            const field = d.path?.[0] || d.context?.key;
            if (field) fieldErrors[field] = d.message || 'Champ invalide';
          });
        }
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          return;
        }
      }
      const msg = error.data?.message || error.message || 'Erreur réseau. Réessaie dans un instant.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, navigation]);

  handleUpdateRef.current = handleUpdate;

  // Configure native header with "Sauver" button — re-runs when loading changes
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => handleUpdateRef.current()}
          disabled={loading}
          style={[styles.headerSaveBtn, loading && { opacity: 0.45 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.headerSaveTxt}>{loading ? '…' : 'Sauver'}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, loading]);

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
          <SettingsRow label="Pseudo" last={false} error={errors.name}>
            <TextInput
              style={[styles.inlineInput, errors.name && styles.inlineInputError]}
              value={formData.name}
              onChangeText={(v) => { set('name', v); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
              placeholder="Ton pseudo"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              returnKeyType="done"
            />
          </SettingsRow>
          <SettingsRow label="Bio" last>
            <TextInput
              style={[styles.inlineInput, styles.inlineInputMulti]}
              value={formData.bio}
              onChangeText={(v) => set('bio', v)}
              placeholder="Quelques mots sur toi…"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              multiline
              returnKeyType="done"
              blurOnSubmit
            />
          </SettingsRow>
        </SettingsGroup>

        {/* ═══ PHYSIQUE ══════════════════════════════════════════════════════ */}
        <SectionLabel label="Physique" />
        <SettingsGroup>
          <SettingsRow label="Sexe" last={false}>
            <View style={styles.chipRow}>
              {SELECTIONS.sexe.map((s) => (
                <MiniChip key={s} label={s} selected={formData.sexe === s} onPress={() => set('sexe', s)} />
              ))}
            </View>
          </SettingsRow>
          <SettingsRow label="Poids actuel (kg)" last={false}>
            <TextInput
              style={styles.inlineInput}
              value={formData.poids}
              onChangeText={(v) => set('poids', v)}
              placeholder="—"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardType="decimal-pad"
            />
          </SettingsRow>
          <SettingsRow label="Poids cible (kg)" last={false}>
            <TextInput
              style={styles.inlineInput}
              value={formData.poidsCible}
              onChangeText={(v) => set('poidsCible', v)}
              placeholder="—"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardType="decimal-pad"
            />
          </SettingsRow>
          <SettingsRow label="Taille (cm)" last>
            <TextInput
              style={styles.inlineInput}
              value={formData.taille}
              onChangeText={(v) => set('taille', v)}
              placeholder="—"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardType="number-pad"
            />
          </SettingsRow>
        </SettingsGroup>

        {/* ═══ PROGRAMME ═════════════════════════════════════════════════════ */}
        <SectionLabel label="Programme" />
        <SettingsGroup>
          <SettingsRow label="Niveau sportif" last={false}>
            <View style={styles.chipRow}>
              {SELECTIONS.niveau.map((n) => (
                <MiniChip key={n} label={n} selected={formData.niveauSportif === n} onPress={() => set('niveauSportif', n)} />
              ))}
            </View>
          </SettingsRow>
          <SettingsRow label="Objectif" last={false}>
            <View style={styles.chipRow}>
              {SELECTIONS.objectif.map((o) => (
                <MiniChip key={o} label={o} selected={formData.objectif === o} onPress={() => set('objectif', o)} />
              ))}
            </View>
          </SettingsRow>
          <SettingsRow label="Séances / semaine" last>
            <TextInput
              style={styles.inlineInput}
              value={formData.rythme}
              onChangeText={(v) => set('rythme', v)}
              placeholder="ex : 4"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardType="number-pad"
            />
          </SettingsRow>
        </SettingsGroup>

        {/* ─── Save bottom button ─── */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.5 }]}
          onPress={handleUpdate}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{loading ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }) {
  return <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>;
}

function SettingsGroup({ children }) {
  return <View style={styles.group}>{children}</View>;
}

function SettingsRow({ label, children, last, error }) {
  return (
    <View style={[styles.row, !last && styles.rowSep, error && styles.rowError]}>
      <View style={styles.rowLabelWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {error ? <Text style={styles.rowErrMsg}>{error}</Text> : null}
      </View>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
}

function MiniChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSel]}
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
  root:   { flex: 1, backgroundColor: '#080910' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // ── Native header ────────────────────────────────────────────────────────────
  headerSaveBtn: { marginRight: 4 },
  headerSaveTxt: { color: Colors.primary, fontSize: 15, fontWeight: '800' },

  // ── Section labels (iOS style) ───────────────────────────────────────────────
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  rowRight: {
    flex: 1,
    alignItems: 'flex-end',
  },

  // ── Inline text inputs ───────────────────────────────────────────────────────
  inlineInput: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    padding: 0,
    minWidth: 80,
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GRP_BORDER,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipSel:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt:    { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
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
