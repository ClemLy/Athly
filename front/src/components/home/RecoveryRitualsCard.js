import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { RITUAL_TYPES } from '../../data/ritualTypes';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';

function pad(n) { return String(n).padStart(2, '0'); }
function formatTime(s) {
  const sec = Math.max(0, s);
  return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
}

// ─── Articles pour le rituel Focus ────────────────────────────────────────────

const FOCUS_ARTICLES = [
  {
    title: 'Le sommeil, l\'arme secrète du sportif',
    content: `C'est pendant le sommeil que ton corps libère 70% de son hormone de croissance quotidienne. Sans 7 à 9 heures de récupération nocturne, ton corps ne peut tout simplement pas synthétiser efficacement les protéines musculaires que tu as stimulées à l'entraînement.

Concrètement, une seule nuit à 6h de sommeil réduit ta force de 3 à 8%, ta puissance maximale de 10%, et augmente ton taux de cortisol (l'hormone du stress qui détruit le muscle) de 21%.

Comment optimiser ton sommeil :
• Couche-toi et lève-toi à heure fixe, même le week-end
• Maintiens ta chambre entre 17-19°C
• Évite les écrans 45 min avant de dormir (la lumière bleue bloque la mélatonine)
• Pas d'entraînement intense moins de 3h avant le coucher

Le secret des athlètes d'élite ? LeBron James dort 12h, Roger Federer 10h. Si tu veux progresser, dors autant que tu t'entraînes.`,
  },
  {
    title: 'Comment squatter correctement',
    content: `Le squat est le roi des exercices, mais mal exécuté il devient ton ennemi numéro 1 pour les genoux et le bas du dos.

Les 5 points clés d'un bon squat :

1. Pieds écartés à largeur d'épaules, légèrement ouverts (30-45°). Tes genoux suivent toujours la direction de tes orteils.

2. Descends jusqu'aux cuisses parallèles au sol minimum. Plus profond = plus de fessiers, moins de contrainte sur les genoux.

3. Garde le dos neutre — ni trop arqué, ni trop rond. Imagine une barre de fer sur ta colonne.

4. Pousse le sol vers le bas au retour, comme si tu voulais écarter le plancher avec tes pieds. Ça active les fessiers et stabilise les genoux.

5. Respiration : inspire en descente, expire fort en montée.

Erreur la plus commune : les genoux qui rentrent vers l'intérieur. Si c'est ton cas, travaille ta mobilité des hanches et renforce tes abducteurs.`,
  },
  {
    title: 'Manger après l\'effort : ce qui compte vraiment',
    content: `La "fenêtre anabolique" — cette idée qu'il faut absolument manger dans les 30 minutes après l'effort — est largement exagérée. Si tu as bien mangé 2-3h avant ta séance, cette fenêtre s'étend à 4-6h après l'entraînement.

Ce qui compte vraiment après l'effort :

Protéines : 20 à 40g pour relancer la synthèse protéique. Ton corps n'utilise pas plus de 40g à la fois — inutile d'en avaler 80g.

Glucides : après un effort intense, ton stock de glycogène est épuisé. 1 à 1.5g par kg de poids corporel aide à le reconstituer rapidement (riz, patate douce, fruits).

Hydratation : pour chaque heure d'effort intense, bois 500ml à 1L d'eau supplémentaire. La déshydratation réduit les performances de 5 à 10%.

Résumé : mange une vraie source de protéines + des glucides dans les 2h après ton entraînement. C'est tout.`,
  },
];

// ─── Carte de sélection des rituels ─────────────────────────────────────────

export default function RecoveryRitualsCard() {
  const { addRitual, items } = useWorkoutLogs();
  const [activeRitual, setActiveRitual] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ritualToday = useMemo(
    () => items.find((l) => l.type === 'ritual' && l.date && l.date.slice(0, 10) === todayKey),
    [items, todayKey],
  );

  const openRitual = useCallback((ritual) => {
    try { Haptics.selectionAsync(); } catch (e) {}
    setActiveRitual(ritual);
    setModalVisible(true);
  }, []);

  const onComplete = useCallback(async (ritual, durationSeconds) => {
    setModalVisible(false);
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    await addRitual(ritual.id, ritual.name, durationSeconds, ritual.xpEarned);
  }, [addRitual]);

  if (ritualToday) {
    const completedRitual = RITUAL_TYPES.find((r) => r.id === ritualToday.ritualId) || RITUAL_TYPES[0];
    return (
      <View style={[styles.doneCard, { borderColor: completedRitual.color + '40' }]}>
        <View style={[styles.doneIconWrap, { backgroundColor: completedRitual.color + '18' }]}>
          <Ionicons name={completedRitual.icon} size={20} color={completedRitual.color} />
        </View>
        <View style={styles.doneTextWrap}>
          <Text style={styles.doneName}>{completedRitual.name}</Text>
          <Text style={styles.doneSub}>Rituel du jour accompli · +{ritualToday.xpEarned || 20} XP</Text>
        </View>
        <View style={[styles.doneBadge, { backgroundColor: Colors.valid + '18', borderColor: Colors.valid + '40' }]}>
          <Ionicons name="checkmark" size={12} color={Colors.valid} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.subtitle}>
        Pas de séance aujourd'hui ? Prends soin de ton corps et maintiens ta streak.
      </Text>

      <View style={styles.ritualsGrid}>
        {RITUAL_TYPES.map((ritual) => (
          <TouchableOpacity
            key={ritual.id}
            style={[styles.ritualBtn, { borderColor: ritual.color + '35' }]}
            onPress={() => openRitual(ritual)}
            activeOpacity={0.78}
          >
            <View style={[styles.ritualIconWrap, { backgroundColor: ritual.color + '15' }]}>
              <Ionicons name={ritual.icon} size={22} color={ritual.color} />
            </View>
            <Text style={styles.ritualName} numberOfLines={2}>{ritual.name}</Text>
            <Text style={[styles.ritualTimer, { color: ritual.color }]}>{ritual.timerLabel}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.xpRow}>
        <Ionicons name="flash" size={12} color={Colors.primary} />
        <Text style={styles.xpText}>+20 XP · Compte pour la streak</Text>
      </View>

      <RitualModal
        visible={modalVisible}
        ritual={activeRitual}
        onComplete={onComplete}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ─── Modal rituel ─────────────────────────────────────────────────────────────

function RitualModal({ visible, ritual, onComplete, onClose }) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!ritual) return null;

  const renderTimer = () => {
    const cb = () => onComplete(ritual, ritual.durationSeconds);
    const xp = ritual.xpEarned || 20;
    if (ritual.id === 'breathing')    return <BreathingTimer   color={ritual.color} durationSeconds={ritual.durationSeconds} xpAmount={xp} onComplete={cb} />;
    if (ritual.id === 'foam_rolling') return <FoamRollingTimer color={ritual.color} durationSeconds={ritual.durationSeconds} xpAmount={xp} onComplete={cb} />;
    if (ritual.id === 'focus')        return <FocusReader       color={ritual.color} durationSeconds={ritual.durationSeconds} xpAmount={xp} onComplete={cb} />;
    return <CountdownTimer color={ritual.color} durationSeconds={ritual.durationSeconds} xpAmount={xp} onComplete={cb} />;
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.modalCard, { borderColor: ritual.color + '35', transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.modalIconWrap, { backgroundColor: ritual.color + '15', borderColor: ritual.color + '35' }]}>
            <Ionicons name={ritual.icon} size={34} color={ritual.color} />
          </View>

          <Text style={styles.modalTitle}>{ritual.name}</Text>
          <Text style={styles.modalSubtitle} numberOfLines={1}>{ritual.subtitle}</Text>
          <Text style={styles.modalDesc}>{ritual.description}</Text>

          {renderTimer()}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Timer compte à rebours standard (mobilité) ───────────────────────────────

function CountdownTimer({ color, durationSeconds, xpAmount = 20, onComplete }) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);

  const start = useCallback(() => {
    setRunning(true);
    try { Haptics.selectionAsync(); } catch (e) {}
  }, []);

  useEffect(() => {
    if (!running || done) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          setDone(true);
          setRunning(false);
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, done]);

  return (
    <View style={styles.timerWrap}>
      <View style={[styles.timerRing, { borderColor: color + '25' }]}>
        <View style={[styles.timerInner, { borderColor: done ? Colors.valid : color }]}>
          {done ? (
            <Ionicons name="checkmark-circle" size={36} color={Colors.valid} />
          ) : (
            <Text style={[styles.timerText, { color }]}>{formatTime(timeLeft)}</Text>
          )}
        </View>
      </View>

      {done ? (
        <TouchableOpacity style={[styles.validateBtn, { backgroundColor: Colors.valid }]} onPress={onComplete} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.validateBtnText}>Terminer · +{xpAmount} XP</Text>
        </TouchableOpacity>
      ) : running ? (
        <View style={[styles.runningBadge, { borderColor: color + '40' }]}>
          <View style={[styles.runningDot, { backgroundColor: color }]} />
          <Text style={[styles.runningText, { color }]}>En cours…</Text>
        </View>
      ) : (
        <TouchableOpacity style={[styles.startBtn, { backgroundColor: color + '18', borderColor: color + '50' }]} onPress={start} activeOpacity={0.82}>
          <Ionicons name="play" size={16} color={color} style={{ marginRight: 8 }} />
          <Text style={[styles.startBtnText, { color }]}>Démarrer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Timer respiration (inspire / expire) ─────────────────────────────────────

const BREATH_PHASES = [
  { label: 'Inspirez…', duration: 4, toScale: 1.0 },
  { label: 'Expirez…',  duration: 6, toScale: 0.55 },
];

function BreathingTimer({ color, durationSeconds, xpAmount = 20, onComplete }) {
  const [started, setStarted]       = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseLeft, setPhaseLeft]   = useState(BREATH_PHASES[0].duration);
  const [cycleCount, setCycleCount] = useState(0);
  const [done, setDone]             = useState(false);
  const scaleAnim    = useRef(new Animated.Value(0.55)).current;
  const intervalRef  = useRef(null);
  const stateRef     = useRef({ phase: 0, cycles: 0 });
  const totalCycles  = Math.floor(durationSeconds / 10); // 4+6=10s

  const animatePhase = useCallback((idx) => {
    Animated.timing(scaleAnim, {
      toValue: BREATH_PHASES[idx].toScale,
      duration: BREATH_PHASES[idx].duration * 1000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const start = useCallback(() => {
    setStarted(true);
    stateRef.current = { phase: 0, cycles: 0 };
    animatePhase(0);
    try { Haptics.selectionAsync(); } catch (e) {}
  }, [animatePhase]);

  useEffect(() => {
    if (!started || done) return;
    let t = BREATH_PHASES[0].duration;
    intervalRef.current = setInterval(() => {
      t -= 1;
      if (t <= 0) {
        const nextPhase = (stateRef.current.phase + 1) % 2;
        if (nextPhase === 0) {
          stateRef.current.cycles += 1;
          if (stateRef.current.cycles >= totalCycles) {
            clearInterval(intervalRef.current);
            setDone(true);
            setPhaseLeft(0);
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
            return;
          }
          setCycleCount(stateRef.current.cycles);
        }
        stateRef.current.phase = nextPhase;
        setPhaseIndex(nextPhase);
        t = BREATH_PHASES[nextPhase].duration;
        setPhaseLeft(t);
        animatePhase(nextPhase);
      } else {
        setPhaseLeft(t);
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [started, done, totalCycles, animatePhase]);

  const currentPhase = BREATH_PHASES[phaseIndex];

  return (
    <View style={styles.timerWrap}>
      <View style={styles.breathCenter}>
        <Animated.View style={[
          styles.breathCircle,
          {
            borderColor: done ? Colors.valid + '60' : color + '50',
            backgroundColor: done ? Colors.valid + '12' : color + '12',
            transform: [{ scale: scaleAnim }],
          },
        ]}>
          {done && <Ionicons name="checkmark-circle" size={32} color={Colors.valid} />}
        </Animated.View>

        {started && !done && (
          <View style={styles.breathLabelWrap}>
            <Text style={[styles.breathPhaseLabel, { color }]}>{currentPhase.label}</Text>
            <Text style={[styles.breathPhaseTimer, { color }]}>{phaseLeft}s</Text>
          </View>
        )}

        {started && !done && (
          <Text style={styles.breathCycles}>{cycleCount}/{totalCycles} cycles</Text>
        )}
      </View>

      {done ? (
        <TouchableOpacity style={[styles.validateBtn, { backgroundColor: Colors.valid }]} onPress={onComplete} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.validateBtnText}>Terminer · +{xpAmount} XP</Text>
        </TouchableOpacity>
      ) : !started ? (
        <TouchableOpacity style={[styles.startBtn, { backgroundColor: color + '18', borderColor: color + '50' }]} onPress={start} activeOpacity={0.82}>
          <Ionicons name="play" size={16} color={color} style={{ marginRight: 8 }} />
          <Text style={[styles.startBtnText, { color }]}>Démarrer</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Timer Foam Rolling : 5 zones × 1 min ────────────────────────────────────

const ZONES = ['Mollets', 'Quadriceps', 'Fessiers', 'Bas du dos', 'Épaules & trapèzes'];
const ZONE_DURATION = 60;

function FoamRollingTimer({ color, durationSeconds, xpAmount = 20, onComplete }) {
  const [started, setStarted]       = useState(false);
  const [zoneIndex, setZoneIndex]   = useState(0);
  const [zoneLeft, setZoneLeft]     = useState(ZONE_DURATION);
  const [done, setDone]             = useState(false);
  const intervalRef = useRef(null);

  const start = useCallback(() => {
    setStarted(true);
    try { Haptics.selectionAsync(); } catch (e) {}
  }, []);

  useEffect(() => {
    if (!started || done) return;
    intervalRef.current = setInterval(() => {
      setZoneLeft((t) => {
        if (t <= 1) {
          setZoneIndex((zi) => {
            const next = zi + 1;
            if (next >= ZONES.length) {
              clearInterval(intervalRef.current);
              setDone(true);
              try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
            } else {
              try { Haptics.selectionAsync(); } catch (e) {}
            }
            return next < ZONES.length ? next : ZONES.length - 1;
          });
          return ZONE_DURATION;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [started, done]);

  return (
    <View style={styles.timerWrap}>
      {started && !done && (
        <View style={styles.foamZoneInfo}>
          <Text style={[styles.foamZoneName, { color }]}>Zone {zoneIndex + 1}/{ZONES.length} : {ZONES[zoneIndex]}</Text>
          <Text style={[styles.foamZoneTimer, { color }]}>{formatTime(zoneLeft)}</Text>
          <View style={styles.foamDotsRow}>
            {ZONES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.foamDot,
                  {
                    backgroundColor: i < zoneIndex ? Colors.valid : i === zoneIndex ? color : color + '25',
                    borderColor: i === zoneIndex ? color : 'transparent',
                    borderWidth: i === zoneIndex ? 1.5 : 0,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {!started && (
        <View style={styles.foamZoneInfo}>
          <Text style={styles.foamPlanText}>
            {ZONES.map((z, i) => `${i + 1}. ${z}`).join('\n')}
          </Text>
        </View>
      )}

      {done ? (
        <TouchableOpacity style={[styles.validateBtn, { backgroundColor: Colors.valid }]} onPress={onComplete} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.validateBtnText}>Terminer · +{xpAmount} XP</Text>
        </TouchableOpacity>
      ) : !started ? (
        <TouchableOpacity style={[styles.startBtn, { backgroundColor: color + '18', borderColor: color + '50' }]} onPress={start} activeOpacity={0.82}>
          <Ionicons name="play" size={16} color={color} style={{ marginRight: 8 }} />
          <Text style={[styles.startBtnText, { color }]}>Démarrer</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Lecteur d'article (focus) ────────────────────────────────────────────────

function FocusReader({ color, durationSeconds, xpAmount = 20, onComplete }) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [done, setDone]         = useState(false);
  const intervalRef = useRef(null);
  const article = useRef(FOCUS_ARTICLES[Math.floor(Math.random() * FOCUS_ARTICLES.length)]).current;

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          setDone(true);
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <View style={[styles.timerWrap, { gap: 14 }]}>
      <View style={[styles.focusTimerBadge, { borderColor: done ? Colors.valid + '50' : color + '30', backgroundColor: done ? Colors.valid + '10' : color + '0D' }]}>
        <Ionicons name={done ? 'checkmark-circle' : 'time-outline'} size={13} color={done ? Colors.valid : color} />
        <Text style={[styles.focusTimerText, { color: done ? Colors.valid : color }]}>
          {done ? 'Lecture complète !' : `En lecture · ${formatTime(timeLeft)}`}
        </Text>
      </View>

      <View style={[styles.focusArticleWrap, { borderColor: color + '20' }]}>
        <Text style={[styles.focusArticleTitle, { color }]}>{article.title}</Text>
        <ScrollView style={styles.focusArticleScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <Text style={styles.focusArticleBody}>{article.content}</Text>
        </ScrollView>
      </View>

      {done ? (
        <TouchableOpacity style={[styles.validateBtn, { backgroundColor: Colors.valid }]} onPress={onComplete} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.validateBtnText}>Terminer · +{xpAmount} XP</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.validateBtn, { backgroundColor: 'rgba(255,255,255,0.05)', elevation: 0, shadowOpacity: 0 }]}>
          <Ionicons name="lock-closed-outline" size={15} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <Text style={[styles.validateBtnText, { color: Colors.textMuted }]}>Lisez l'article · {formatTime(timeLeft)}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Sélection ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  ritualsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  ritualBtn: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 8,
  },
  ritualIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ritualName: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  ritualTimer: {
    fontSize: 10,
    fontWeight: '600',
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
  },
  xpText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Done badge ────────────────────────────────────────────────────────────
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  doneIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTextWrap: { flex: 1 },
  doneName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  doneSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  doneBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#13131C',
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  modalHeader: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modalDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 22,
  },

  // ── Timer commun ─────────────────────────────────────────────────────────
  timerWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
  },
  timerRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  runningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  runningDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  runningText: {
    fontSize: 13,
    fontWeight: '700',
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 54,
    borderRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // ── Breathing ──────────────────────────────────────────────────────────────
  breathCenter: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  breathCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathLabelWrap: {
    alignItems: 'center',
    gap: 4,
  },
  breathPhaseLabel: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  breathPhaseTimer: {
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  breathCycles: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Foam Rolling ──────────────────────────────────────────────────────────
  foamZoneInfo: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  foamZoneName: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  foamZoneTimer: {
    fontSize: 38,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  foamDotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  foamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  foamPlanText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },

  // ── Focus / Article ────────────────────────────────────────────────────────
  focusTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
  },
  focusTimerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  focusArticleWrap: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  focusArticleTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  focusArticleScroll: {
    maxHeight: 170,
  },
  focusArticleBody: {
    color: Colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 19,
  },
});
