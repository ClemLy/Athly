import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getActivityFeed, reactToActivityEvent } from '../../services';

// ─── ActivityFeedModal ─────────────────────────────────────────────────────────
// Flux d'activité « Taquineries & High-Fives » (Section IV) : au lancement de
// l'app, annonce les événements notables survenus dans le groupe de streak
// depuis la dernière consultation (PR battu, coffre Légendaire ouvert...),
// avec des boutons de réaction à punchlines. Se charge elle-même — il suffit
// de la monter une fois (voir navigation/index.js), au même niveau que
// BirthdayCelebration / LevelUpCelebration.
//
// Modale custom (jamais Alert.alert), cohérente avec ConfirmModal.js.

const REACTION_META = {
  bravo:   { icon: 'barbell',      label: 'Bien joué mec !' },
  respect: { icon: 'flame',        label: 'Respect !' },
  boo:     { icon: 'thumbs-down',  label: 'Bouuuuuh !' },
  jealous: { icon: 'eye',          label: 'Jalouser' },
};

// Titres piochés au hasard à chaque ouverture — un seul nom fixe finit par
// lasser, façon rubrique people plutôt qu'écran technique.
const FEED_TITLES = [
  'Radio Vestiaire',
  'Le Ragot du Jour',
  'Commérages de la Fonte',
  'Ça jase au vestiaire',
  'Le Bureau des Rumeurs',
  "Les Nouvelles Fraîches (et un peu piquantes)",
];

export default function ActivityFeedModal() {
  const { userToken } = useAuth();
  const [events, setEvents]   = useState([]);
  const [visible, setVisible] = useState(false);
  const [reactedIds, setReactedIds] = useState({});
  const [title] = useState(() => FEED_TITLES[Math.floor(Math.random() * FEED_TITLES.length)]);

  useEffect(() => {
    if (!userToken) return;
    (async () => {
      try {
        const data = await getActivityFeed();
        if (Array.isArray(data.events) && data.events.length > 0) {
          setEvents(data.events);
          setVisible(true);
        }
      } catch (_) {
        // Best-effort — un flux d'activité manquant ne doit jamais bloquer l'app.
      }
    })();
  }, [userToken]);

  const handleReact = useCallback(async (eventId, emoji) => {
    setReactedIds((prev) => ({ ...prev, [eventId]: emoji }));
    try {
      await reactToActivityEvent(eventId, emoji);
    } catch (_) {
      setReactedIds((prev) => ({ ...prev, [eventId]: null }));
    }
  }, []);

  const handleClose = useCallback(() => setVisible(false), []);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>QUOI DE NEUF ?</Text>
          <View style={styles.titleRow}>
            <Ionicons name="flame" size={18} color={Colors.primary} />
            <Text style={styles.title}>{title}</Text>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {events.map((event) => (
              <ActivityEventRow
                key={event._id}
                event={event}
                reacted={reactedIds[event._id]}
                onReact={(emoji) => handleReact(event._id, emoji)}
              />
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.85}>
            <Text style={styles.closeBtnTxt}>C'est noté</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ActivityEventRow({ event, reacted, onReact }) {
  return (
    <View style={styles.eventRow}>
      <Text style={styles.eventMessage}>{event.message}</Text>
      <View style={styles.reactionsRow}>
        {Object.entries(REACTION_META).map(([key, meta]) => {
          const isActive = reacted === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.reactionBtn, isActive && styles.reactionBtnActive]}
              onPress={() => onReact(key)}
              disabled={Boolean(reacted)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={meta.icon}
                size={13}
                color={isActive ? Colors.primary : Colors.textSecondary}
              />
              <Text style={styles.reactionLabel}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 24,
  },
  card: {
    width:           '100%',
    maxHeight:       '78%',
    backgroundColor: Colors.bgDeep2,
    borderRadius:    22,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.08)',
    padding:         24,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.65,
    shadowRadius:    32,
    elevation:       20,
  },
  eyebrow: {
    color:         Colors.textMuted,
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 2,
    marginBottom:  4,
    textAlign:     'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
    gap:           7,
    marginBottom:  18,
  },
  title: {
    color:         Colors.textPrimary,
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.3,
    textAlign:     'center',
  },
  list: { maxHeight: 340 },
  eventRow: {
    backgroundColor: Colors.cardDeep,
    borderWidth:     1,
    borderColor:     Colors.borderSubtle,
    borderRadius:    14,
    padding:         14,
    marginBottom:    12,
  },
  eventMessage: {
    color:        Colors.textPrimary,
    fontSize:     14,
    fontWeight:   '600',
    lineHeight:   20,
    marginBottom: 10,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  reactionBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth:     1,
    borderColor:     Colors.borderSubtle,
    borderRadius:    10,
    paddingVertical:   6,
    paddingHorizontal: 9,
    gap:               5,
  },
  reactionBtnActive: {
    backgroundColor: `${Colors.primary}22`,
    borderColor:     Colors.primary,
  },
  reactionLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  closeBtn: {
    width:            '100%',
    height:           48,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    backgroundColor:  Colors.primary,
    marginTop:        6,
    shadowColor:      Colors.primary,
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  closeBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
