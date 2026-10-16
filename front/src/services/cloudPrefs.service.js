import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCloudCollection } from './cloudCollection';

// ─── Préférences sauvegardées dans le compte ──────────────────────────────────
// Préférences de compte qui n'existent que sur le téléphone. Le cadre, la
// vitrine et le tutoriel ont déjà leur équivalent côté serveur (equippedFrame,
// showcasedAchievements, hasCompletedOnboarding) : voir seedFromProfile.

const PREF_KEYS = {
  profileTheme: 'athly:pref:profileTheme:v1',
};

const FRAME_SHAPE_KEY = 'athly:avatarShape:v1';
const FRAME_COLOR_KEY = 'athly:avatarColor:v1';
const FEATURED_KEY = 'athly:pref:featuredTrophies:v1';

export const prefsCloud = createCloudCollection({
  kind: 'prefs',
  read: async () => {
    const names = Object.keys(PREF_KEYS);
    const pairs = await AsyncStorage.multiGet(names.map((n) => PREF_KEYS[n]));
    return pairs
      .map(([, value], i) => (value != null ? { id: names[i], value } : null))
      .filter(Boolean);
  },
  // N'efface jamais une préférence locale : écrit seulement celles reçues.
  write: async (items) => {
    const pairs = items
      .filter((it) => PREF_KEYS[it.id] && typeof it.value === 'string')
      .map((it) => [PREF_KEYS[it.id], it.value]);
    if (pairs.length) await AsyncStorage.multiSet(pairs);
  },
});

/** À appeler après avoir écrit une préférence localement. */
export function savePref(name, value) {
  if (!PREF_KEYS[name]) return Promise.resolve();
  return prefsCloud.markPut({ id: name, value: String(value) });
}

/**
 * Nouvel appareil : reprend le cadre et la vitrine connus du serveur quand le
 * téléphone n'en a pas encore (sinon le premier changement écraserait la
 * version du compte avec des valeurs vides).
 * @returns {Promise<{ frame: boolean, featured: boolean }>} ce qui a été repris
 */
export async function seedFromProfile(user) {
  const out = { frame: false, featured: false };
  if (!user) return out;
  try {
    const [[, shape], [, color], [, featured]] = await AsyncStorage.multiGet([FRAME_SHAPE_KEY, FRAME_COLOR_KEY, FEATURED_KEY]);
    const frame = user.equippedFrame;
    if (shape == null && color == null && frame && (frame.shapeId || frame.colorId)) {
      await AsyncStorage.multiSet([
        [FRAME_SHAPE_KEY, frame.shapeId || 'circle'],
        [FRAME_COLOR_KEY, frame.colorId || 'none'],
      ]);
      out.frame = true;
    }
    const showcase = user.showcasedAchievements;
    if (featured == null && Array.isArray(showcase) && showcase.length > 0) {
      await AsyncStorage.setItem(FEATURED_KEY, JSON.stringify(showcase.slice(0, 3)));
      out.featured = true;
    }
  } catch (_) {
    // best-effort
  }
  return out;
}
