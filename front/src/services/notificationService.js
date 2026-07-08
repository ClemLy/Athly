import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_NOTIF_IDS_KEY = 'athly:notif:daily_ids:v2';
const CHANNEL_ORANGE_ID   = 'streak-orange';
const CHANNEL_VIOLET_ID   = 'streak-purple';
const CHANNEL_BIRTHDAY_ID = 'athly-birthday';
const CHANNEL_EVENTS_ID   = 'athly-events';

// Nombre de jours pour lesquels on pré-planifie un rappel quotidien.
// Chaque jour a son propre trigger DATE avec un contenu tiré indépendamment
// (contrairement à un trigger DAILY qui réutilise le même contenu figé à l'infini).
// iOS plafonne à 64 notifications locales en attente : on garde une marge pour
// les notifications contextuelles (anniversaire, coffre, ami, secousse).
const DAILY_BATCH_SIZE = 21;
// Seuil sous lequel on considère qu'il faut reconstituer le stock de rappels.
const REFILL_THRESHOLD = 5;

const MESSAGES_ORANGE = [
  { title: "La streak t'attend 🔥", body: "Tu es à une séance d'une meilleure version de toi. Allez, lance-toi !" },
  { title: "Tes muscles ont faim 💪", body: "Une séance. C'est tout ce qu'il faut. Tu peux le faire." },
  { title: "L'heure d'Athly a sonné ⚡", body: "Les champions s'entraînent même quand ils n'en ont pas envie. Toi aussi." },
  { title: "Ta streak te parle 🏆", body: "Tu te souviens de ta fierté d'hier ? Refais ça aujourd'hui." },
  { title: "Go, champion 🚀", body: "La douleur d'aujourd'hui, c'est la force de demain. Lance une séance !" },
  { title: "Niveau suivant en vue 🎯", body: "Une séance = de l'XP = un rang de plus. L'équation est simple." },
  { title: "On t'attend en salle 🏋️", body: "Chaque jour d'entraînement est une promesse tenue à toi-même." },
];

const MESSAGES_VIOLET = [
  { title: "Tu dors encore ? 👀", body: "Ton streak meurt dans quelques heures. Juste pour info." },
  { title: "Intéressant...", body: "Tu avais le temps de scroller, mais pas de squatter. Logique." },
  { title: "Tes muscles ont appelé 😤", body: "Ils ont raccroché. Déçus. C'était ton moment." },
  { title: "La streak de tes rivaux...", body: "Elle, elle n'a pas pris de jour de repos. Coïncidence ?" },
  { title: "On dirait quelqu'un qui abandonne", body: "Athly ne juge pas. Athly observe. Athly se souvient. 🙄" },
  { title: "Statistiquement parlant...", body: "Tu regretteras de ne pas t'être entraîné aujourd'hui. Simple constat." },
  { title: "Le canapé a gagné ? 🛋️", body: "Demain, revanche. Mais il reste ce soir." },
];

// expo-notifications n'existe pas sur web — on n'enregistre le handler que sur mobile
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function setupNotificationChannels() {
  if (Platform.OS === 'web' || Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNEL_ORANGE_ID, {
      name: 'Rappels Motivation',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#FF6B00',
      vibrationPattern: [0, 250, 250, 250],
    }),
    Notifications.setNotificationChannelAsync(CHANNEL_VIOLET_ID, {
      name: 'Rappels Streak',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#8B5CF6',
      vibrationPattern: [0, 400, 200, 400],
    }),
    Notifications.setNotificationChannelAsync(CHANNEL_BIRTHDAY_ID, {
      name: 'Anniversaire',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#FFD700',
      vibrationPattern: [0, 300, 150, 300, 150, 300],
    }),
    Notifications.setNotificationChannelAsync(CHANNEL_EVENTS_ID, {
      name: 'Événements Athly',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#22D3EE',
      vibrationPattern: [0, 250, 250, 250],
    }),
  ]);
}

export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Récupère le token Expo Push de l'appareil courant, en demandant la
 * permission si besoin. Retourne null sur web (non supporté), en cas de
 * permission refusée, ou si l'obtention échoue (jamais d'exception qui
 * remonterait — un push cross-device est un bonus UX, pas une dépendance
 * bloquante pour le reste de l'app).
 */
export async function getExpoPushToken() {
  if (Platform.OS === 'web') return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data ?? null;
  } catch (_) {
    return null;
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Tire un {channel, msg} au hasard (50/50 sur le canal) en évitant de reproduire
// le même titre que `previous`, pour ne jamais avoir deux jours consécutifs identiques.
function pickDailyOccurrence(previous) {
  let attempt;
  for (let i = 0; i < 5; i++) {
    const useOrange = Math.random() < 0.5;
    const msg = pickRandom(useOrange ? MESSAGES_ORANGE : MESSAGES_VIOLET);
    attempt = { channelId: useOrange ? CHANNEL_ORANGE_ID : CHANNEL_VIOLET_ID, msg };
    if (!previous || attempt.msg.title !== previous.msg.title) return attempt;
  }
  return attempt;
}

export async function fireTestNotification(type) {
  if (Platform.OS === 'web') return;
  const isOrange = type === 'orange';
  const msg = pickRandom(isOrange ? MESSAGES_ORANGE : MESSAGES_VIOLET);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title,
      body: msg.body,
      sound: true,
      ...(Platform.OS === 'android' && {
        channelId: isOrange ? CHANNEL_ORANGE_ID : CHANNEL_VIOLET_ID,
      }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    },
  });
}

/**
 * Planifie une série de rappels quotidiens (un par jour, `count` jours),
 * chacun avec un canal et un message tirés indépendamment. Contrairement à un
 * trigger DAILY unique (contenu figé pour toujours), chaque occurrence a son
 * propre contenu -> plus d'effet "perroquet".
 */
export async function scheduleDailyReminder(hour = 18, minute = 0, count = DAILY_BATCH_SIZE) {
  if (Platform.OS === 'web') return null;

  // Nettoie systématiquement toute planification précédente avant d'en créer
  // une nouvelle, pour éviter l'accumulation de rappels dupliqués en arrière-plan.
  await cancelDailyReminder();

  const now = new Date();
  const ids = [];
  let previous = null;

  for (let dayOffset = 0; dayOffset < count; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    // Si l'heure du jour 0 est déjà passée, on démarre à demain.
    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }

    const occurrence = pickDailyOccurrence(previous);
    previous = occurrence;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: occurrence.msg.title,
        body: occurrence.msg.body,
        sound: true,
        data: { type: 'daily_reminder' },
        ...(Platform.OS === 'android' && { channelId: occurrence.channelId }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    ids.push(id);
  }

  try {
    await AsyncStorage.setItem(DAILY_NOTIF_IDS_KEY, JSON.stringify({ hour, minute, ids }));
  } catch (_) {}

  return ids;
}

/**
 * À appeler au lancement de l'app (ou au retour au premier plan) : si le stock
 * de rappels pré-planifiés commence à manquer, on le reconstitue. Le
 * cancel-puis-replanifie de `scheduleDailyReminder` garantit qu'on ne double
 * jamais les notifications en attente.
 */
export async function ensureDailyRemindersScheduled(hour = 18, minute = 0) {
  if (Platform.OS === 'web') return;
  try {
    const raw = await AsyncStorage.getItem(DAILY_NOTIF_IDS_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    const remaining = stored?.ids?.length ?? 0;
    const sameSlot = stored && stored.hour === hour && stored.minute === minute;

    if (!sameSlot || remaining < REFILL_THRESHOLD) {
      await scheduleDailyReminder(hour, minute);
    }
  } catch (_) {
    await scheduleDailyReminder(hour, minute);
  }
}

export async function cancelDailyReminder() {
  if (Platform.OS === 'web') return;
  try {
    const raw = await AsyncStorage.getItem(DAILY_NOTIF_IDS_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    const ids = stored?.ids ?? [];
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    await AsyncStorage.removeItem(DAILY_NOTIF_IDS_KEY);
  } catch (_) {}
}

// ─── Notifications contextuelles V2 ───────────────────────────────────────
// Déclenchées ponctuellement par l'app quand elle détecte l'événement
// correspondant (réponse API, websocket, etc.) — elles ne touchent pas au
// stock des rappels quotidiens gérés ci-dessus.

async function fireImmediate({ title, body, channelId, data }) {
  if (Platform.OS === 'web') return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data,
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: null, // délivrance immédiate
  });
}

export async function notifyBirthday(firstName) {
  return fireImmediate({
    title: `🎂 Joyeux Anniversaire ${firstName} !`,
    body: 'Ton coffre et ton trophée t\'attendent !',
    channelId: CHANNEL_BIRTHDAY_ID,
    data: { type: 'birthday' },
  });
}

export async function notifyChestAvailable() {
  return fireImmediate({
    title: '📦 Nouvel effort récompensé !',
    body: 'Un coffre est prêt à être ouvert.',
    channelId: CHANNEL_EVENTS_ID,
    data: { type: 'chest_available' },
  });
}

export async function notifyFriendInvite(pseudo) {
  return fireImmediate({
    title: '⚡ Nouvelle invitation',
    body: `${pseudo} veut devenir ton ami sur Athly. Accepte l'invitation !`,
    channelId: CHANNEL_EVENTS_ID,
    data: { type: 'friend_invite', pseudo },
  });
}

export async function notifyShake(pseudo) {
  return fireImmediate({
    title: '🚨 BOUGE-TOI !',
    body: `${pseudo} t'a secoué. Ne casse pas la Streak du groupe !`,
    channelId: CHANNEL_EVENTS_ID,
    data: { type: 'shake', pseudo },
  });
}
