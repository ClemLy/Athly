import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUEST_XP   = 500;
export const BONUS_XP   = 1000;
const STORAGE_KEY        = '@athly_daily_quests';

// ─── 20 Quest templates ────────────────────────────────────────────────────────

export const QUEST_TEMPLATES = [
  // Volume
  { id: 'vol_800',    icon: 'barbell-outline',        label: 'Le Forgeron',          desc: 'Volume total > 800 kg',           check: (l)       => (l.totalVolume || 0) >= 800   },
  { id: 'vol_1500',   icon: 'barbell',                label: 'Titan de l\'Acier',    desc: 'Volume total > 1 500 kg',         check: (l)       => (l.totalVolume || 0) >= 1500  },
  { id: 'vol_2500',   icon: 'nuclear-outline',        label: 'Le Colosse',           desc: 'Volume total > 2 500 kg',         check: (l)       => (l.totalVolume || 0) >= 2500  },
  // Durée
  { id: 'dur_30',     icon: 'timer-outline',          label: 'Le Solide',            desc: 'Séance ≥ 30 minutes',             check: (l)       => (l.durationSeconds || 0) >= 1800  },
  { id: 'dur_45',     icon: 'time-outline',           label: 'L\'Endurant',          desc: 'Séance ≥ 45 minutes',             check: (l)       => (l.durationSeconds || 0) >= 2700  },
  { id: 'dur_60',     icon: 'time',                   label: 'Le Marathonien',       desc: 'Séance ≥ 60 minutes',             check: (l)       => (l.durationSeconds || 0) >= 3600  },
  // Sets
  { id: 'sets_12',    icon: 'checkmark-done-outline', label: 'La Dynamo',            desc: '12 sets ou plus',                 check: (l)       => (l.totalSets != null ? l.totalSets : (l.setsCompleted || 0)) >= 12  },
  { id: 'sets_18',    icon: 'flash-outline',          label: 'La Machine',           desc: '18 sets ou plus',                 check: (l)       => (l.totalSets != null ? l.totalSets : (l.setsCompleted || 0)) >= 18  },
  { id: 'sets_25',    icon: 'flash',                  label: 'L\'Infatigable',       desc: '25 sets ou plus',                 check: (l)       => (l.totalSets != null ? l.totalSets : (l.setsCompleted || 0)) >= 25  },
  // Diversité musculaire
  { id: 'mus_2',      icon: 'body-outline',           label: 'Travail d\'Équipe',    desc: '2 groupes musculaires différents',check: (l)       => Object.keys(l.muscleDistribution || {}).length >= 2  },
  { id: 'mus_3',      icon: 'body',                   label: 'Polymuscle',           desc: '3 groupes musculaires différents',check: (l)       => Object.keys(l.muscleDistribution || {}).length >= 3  },
  // Horaire
  { id: 'morning',    icon: 'sunny-outline',          label: 'Guerrier de l\'Aube',  desc: 'Séance avant 9h du matin',        check: (l)       => { try { return new Date(l.date).getHours() < 9; } catch { return false; } }  },
  { id: 'evening',    icon: 'moon-outline',           label: 'Guerrier du Soir',     desc: 'Séance après 18h',                check: (l)       => { try { return new Date(l.date).getHours() >= 18; } catch { return false; } }  },
  // Muscles spécifiques
  { id: 'pecs',       icon: 'fitness',                label: 'Pecs de Titan',        desc: 'Travailler les Pectoraux',        check: (l)       => !!(l.muscleDistribution || {})['pectoraux']  },
  { id: 'back',       icon: 'arrow-undo-circle',      label: 'Dos de Fer',           desc: 'Travailler le Dos',               check: (l)       => !!(l.muscleDistribution || {})['dos']  },
  { id: 'legs',       icon: 'walk',                   label: 'Roi des Jambes',       desc: 'Travailler les Jambes',           check: (l)       => !!(l.muscleDistribution || {})['jambes']  },
  { id: 'shoulders',  icon: 'person',                 label: 'Épaules de Titan',     desc: 'Travailler les Épaules',          check: (l)       => !!(l.muscleDistribution || {})['epaules']  },
  // Spécial
  { id: 'any_pr',     icon: 'medal-outline',          label: 'Record Pulvérisé',     desc: 'Battre un record personnel',      check: (l, prs)  => Array.isArray(prs) && prs.length > 0  },
  { id: 'any_session',icon: 'flame-outline',          label: 'Le Guerrier',          desc: 'Compléter une séance',            check: (l)       => (l.setsCompleted || 0) >= 1  },
  { id: 'speed_run',  icon: 'speedometer',            label: 'Speed Run',            desc: 'Séance ≤ 25 min avec 5+ sets',   check: (l)       => { const dur = l.durationSeconds || 0; const sets = l.totalSets != null ? l.totalSets : (l.setsCompleted || 0); return dur > 0 && dur <= 1500 && sets >= 5; }  },
];

export function getTemplateById(id) {
  return QUEST_TEMPLATES.find(t => t.id === id) || null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Deterministic seed from date string so same 3 quests appear all day
function dateToSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 42;
}

function lcgRand(seedIn) {
  // Returns [randomFn, nextSeed]
  let s = ((seedIn * 1664525 + 1013904223) >>> 0);
  return [s / 4294967296, s];
}

function pickTemplatesForDate(dateStr) {
  let seed = dateToSeed(dateStr);
  const pool = [...QUEST_TEMPLATES];
  const picked = [];
  for (let i = 0; i < 3; i++) {
    let r;
    [r, seed] = lcgRand(seed);
    const idx = Math.floor(r * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

// ─── AsyncStorage persistence ─────────────────────────────────────────────────

export async function saveTodayQuests(state) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

export async function loadTodayQuests() {
  const today = getTodayString();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) return parsed;
    }
  } catch (_) {}

  // Generate fresh quests for today
  const templates = pickTemplatesForDate(today);
  const fresh = {
    date: today,
    quests: templates.map(t => ({ templateId: t.id, completed: false })),
    bonusClaimed: false,
  };
  await saveTodayQuests(fresh);
  return fresh;
}

// ─── Check & mark quests ──────────────────────────────────────────────────────
// Returns { completedIds: string[], bonusUnlocked: bool }

export async function checkAndMarkQuests(log, newPRs = []) {
  const state = await loadTodayQuests();
  const newly = [];

  const updatedQuests = state.quests.map(q => {
    if (q.completed) return q;
    const tpl = QUEST_TEMPLATES.find(t => t.id === q.templateId);
    if (tpl && tpl.check(log, newPRs)) {
      newly.push(q.templateId);
      return { ...q, completed: true };
    }
    return q;
  });

  if (newly.length === 0) return { completedIds: [], bonusUnlocked: false };

  const allDone = updatedQuests.every(q => q.completed);
  const bonusUnlocked = allDone && !state.bonusClaimed;

  await saveTodayQuests({
    ...state,
    quests: updatedQuests,
    bonusClaimed: allDone ? true : state.bonusClaimed,
  });

  return { completedIds: newly, bonusUnlocked };
}
