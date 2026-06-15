import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY    = 'athly:pref:profileTheme:v1';
const GOD_KEY      = 'athly:dev:godMode:v1';
const OVERRIDES_KEY = 'athly:dev:trophyOverrides:v1';
const BYPASS_KEY        = '@athly_bypass_anticheat';
const FORCE_RITUALS_KEY = '@athly_force_show_rituals';

export function useDevSettings() {
  const [profileThemeId,   setProfileThemeIdState]   = useState('auto');
  const [godMode,          setGodModeState]           = useState(false);
  const [trophyOverrides,  setTrophyOverridesState]   = useState({});
  const [bypassAnticheat,  setBypassAnticheatState]   = useState(false);
  const [forceShowRituals, setForceShowRitualsState]  = useState(false);

  const reload = useCallback(async () => {
    try {
      const [t, g, to, ba, fr] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(GOD_KEY),
        AsyncStorage.getItem(OVERRIDES_KEY),
        AsyncStorage.getItem(BYPASS_KEY),
        AsyncStorage.getItem(FORCE_RITUALS_KEY),
      ]);
      if (t)  setProfileThemeIdState(t);
      if (g !== null) setGodModeState(g === 'true');
      if (to) {
        try { setTrophyOverridesState(JSON.parse(to)); } catch (_) {}
      }
      if (ba !== null) setBypassAnticheatState(ba === 'true');
      if (fr !== null) setForceShowRitualsState(fr === 'true');
    } catch (_) {}
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const setProfileThemeId = useCallback(async (id) => {
    setProfileThemeIdState(id);
    try { await AsyncStorage.setItem(THEME_KEY, id); } catch (_) {}
  }, []);

  const setGodMode = useCallback(async (val) => {
    setGodModeState(val);
    try { await AsyncStorage.setItem(GOD_KEY, val ? 'true' : 'false'); } catch (_) {}
  }, []);

  const setBypassAnticheat = useCallback(async (val) => {
    setBypassAnticheatState(val);
    try { await AsyncStorage.setItem(BYPASS_KEY, val ? 'true' : 'false'); } catch (_) {}
  }, []);

  const setForceShowRituals = useCallback(async (val) => {
    setForceShowRitualsState(val);
    try { await AsyncStorage.setItem(FORCE_RITUALS_KEY, val ? 'true' : 'false'); } catch (_) {}
  }, []);

  // val: true = force-unlock, false = force-lock, null = revert to natural state
  const setTrophyOverride = useCallback((id, val) => {
    setTrophyOverridesState((prev) => {
      const next = { ...prev };
      if (val === null || val === undefined) {
        delete next[id];
      } else {
        next[id] = val;
      }
      AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearTrophyOverrides = useCallback(() => {
    setTrophyOverridesState({});
    AsyncStorage.removeItem(OVERRIDES_KEY).catch(() => {});
  }, []);

  return {
    profileThemeId, setProfileThemeId,
    godMode, setGodMode,
    trophyOverrides, setTrophyOverride, clearTrophyOverrides,
    bypassAnticheat, setBypassAnticheat,
    forceShowRituals, setForceShowRituals,
    reload,
  };
}
