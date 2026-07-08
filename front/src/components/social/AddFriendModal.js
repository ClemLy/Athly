import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── AddFriendModal ────────────────────────────────────────────────────────────
// Point d'entrée unique pour ajouter un ami (Section III) : affiche d'abord
// TON PROPRE tag (à donner à un ami), puis deux champs séparés — pseudo et
// # à 4 chiffres — plutôt qu'un seul champ "Pseudo#1234" à taper à la main,
// pour éviter toute confusion de format.
//
// Sur "Rechercher", délègue à `onSearch(fullTag)` (SocialScreen gère déjà la
// recherche + la carte Preview) puis se ferme si un résultat est trouvé —
// géré par le parent via `closeOnFound`.
//
// Props :
//   visible      bool
//   myTag        string | null — "MonPseudo#1234", affiché en haut
//   searching    bool
//   error        string
//   onSearch     (fullTag: string) => void
//   onClose      () => void

export default function AddFriendModal({ visible, myTag, searching, error, onSearch, onClose }) {
  const [pseudo, setPseudo]     = useState('');
  const [tag4, setTag4]         = useState('');

  useEffect(() => {
    if (visible) { setPseudo(''); setTag4(''); }
  }, [visible]);

  const canSearch = pseudo.trim().length > 0 && /^\d{4}$/.test(tag4);

  const handleSearch = () => {
    if (!canSearch) return;
    onSearch(`${pseudo.trim()}#${tag4}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="person-add" size={26} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Ajouter un ami</Text>

          {!!myTag && (
            <View style={styles.myTagBox}>
              <Text style={styles.myTagLabel}>Ton tag (donne-le à un ami)</Text>
              <Text style={styles.myTagValue}>{myTag}</Text>
            </View>
          )}

          <Text style={styles.body}>
            Entre le pseudo et le # à 4 chiffres exacts de la personne à ajouter.
          </Text>

          <View style={styles.inputsRow}>
            <View style={styles.pseudoInputWrap}>
              <TextInput
                style={styles.input}
                value={pseudo}
                onChangeText={setPseudo}
                placeholder="Pseudo"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>
            <Text style={styles.hash}>#</Text>
            <View style={styles.tagInputWrap}>
              <TextInput
                style={styles.input}
                value={tag4}
                onChangeText={(t) => setTag4(t.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="0000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
            </View>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.searchBtn, !canSearch && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!canSearch || searching}
            activeOpacity={0.85}
          >
            {searching
              ? <ActivityIndicator size="small" color="#fff" />
              : (
                <>
                  <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.searchBtnTxt}>Rechercher</Text>
                </>
              )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 24,
  },
  card: {
    width:           '100%',
    backgroundColor: '#13131C',
    borderRadius:    22,
    borderWidth:     1,
    borderColor:     `${Colors.primary}38`,
    padding:         24,
    paddingTop:      36,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.65,
    shadowRadius:    32,
    elevation:       20,
  },
  closeIcon: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  iconWrap: {
    width:            56,
    height:           56,
    borderRadius:     16,
    backgroundColor:  `${Colors.primary}1A`,
    borderWidth:      1,
    borderColor:      `${Colors.primary}45`,
    justifyContent:   'center',
    alignItems:       'center',
    marginBottom:     14,
  },
  title: {
    color:          Colors.textPrimary,
    fontSize:       18,
    fontWeight:     '800',
    letterSpacing:  -0.3,
    marginBottom:   16,
    textAlign:      'center',
  },
  myTagBox: {
    width:            '100%',
    backgroundColor:  'rgba(255,255,255,0.05)',
    borderWidth:      1,
    borderColor:      Colors.borderSubtle,
    borderRadius:     12,
    paddingVertical:  10,
    alignItems:       'center',
    marginBottom:     16,
  },
  myTagLabel: { color: Colors.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },
  myTagValue: { color: Colors.primary, fontSize: 16, fontWeight: '800', marginTop: 3 },
  body: {
    color:        Colors.textSecondary,
    fontSize:     13,
    lineHeight:   19,
    textAlign:    'center',
    marginBottom: 18,
  },
  inputsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    width:         '100%',
    gap:           8,
  },
  pseudoInputWrap: {
    flex:              2,
    borderWidth:       1,
    borderColor:       Colors.borderSubtle,
    borderRadius:      13,
    backgroundColor:   'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    height:            50,
    justifyContent:    'center',
  },
  hash: { color: Colors.textMuted, fontSize: 20, fontWeight: '800' },
  tagInputWrap: {
    flex:              1,
    borderWidth:       1,
    borderColor:       Colors.borderSubtle,
    borderRadius:      13,
    backgroundColor:   'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    height:            50,
    justifyContent:    'center',
  },
  input: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  error: { color: Colors.error, fontSize: 12, marginTop: 10, alignSelf: 'flex-start' },
  searchBtn: {
    flexDirection:    'row',
    width:            '100%',
    height:           50,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    backgroundColor:  Colors.primary,
    marginTop:        20,
    shadowColor:      Colors.primary,
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
