import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_NOTIF_ID_KEY = 'athly:notif:daily_id:v1';
const CHANNEL_ORANGE_ID  = 'streak-orange';
const CHANNEL_VIOLET_ID  = 'streak-purple';

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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;
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
  ]);
}

export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function fireTestNotification(type) {
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

export async function scheduleDailyReminder(hour = 18, minute = 0) {
  await cancelDailyReminder();
  const useOrange = Math.random() < 0.5;
  const msg = pickRandom(useOrange ? MESSAGES_ORANGE : MESSAGES_VIOLET);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title,
      body: msg.body,
      sound: true,
      ...(Platform.OS === 'android' && {
        channelId: useOrange ? CHANNEL_ORANGE_ID : CHANNEL_VIOLET_ID,
      }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  try { await AsyncStorage.setItem(DAILY_NOTIF_ID_KEY, id); } catch (_) {}
  return id;
}

export async function cancelDailyReminder() {
  try {
    const id = await AsyncStorage.getItem(DAILY_NOTIF_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(DAILY_NOTIF_ID_KEY);
    }
  } catch (_) {}
}
