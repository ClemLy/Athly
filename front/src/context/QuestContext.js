import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  loadTodayQuests,
  checkAndMarkQuests,
  getTemplateById,
  QUEST_XP,
  BONUS_XP,
} from '../services/quest.service';
import { useWorkoutLogs } from './WorkoutLogsContext';

const QuestContext = createContext(null);

export function QuestProvider({ children }) {
  const workoutLogs = useWorkoutLogs();
  const [questState, setQuestState] = useState({ date: null, quests: [], bonusClaimed: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const state = await loadTodayQuests();
    setQuestState(state);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-healing : si les quêtes sont vides après le chargement initial (ex: après
  // un clearAll lors d'une suppression de compte), on les régénère immédiatement.
  useEffect(() => {
    if (!loading && questState.quests.length === 0) {
      refresh();
    }
  }, [loading, questState.quests.length, refresh]);

  // Called after every workout finalisation.
  // Returns { completedQuests, bonusUnlocked, questXP }
  const checkAndUpdateQuests = useCallback(async (log, newPRs = []) => {
    const { completedIds, bonusUnlocked } = await checkAndMarkQuests(log, newPRs);

    if (completedIds.length === 0) return { completedQuests: [], bonusUnlocked: false, questXP: 0 };

    const completedQuests = completedIds.map(id => getTemplateById(id)).filter(Boolean);
    const questXP = completedIds.length * QUEST_XP + (bonusUnlocked ? BONUS_XP : 0);

    // Persist quest XP as a zero-volume pseudo-log so totalXP reflects it.
    // These logs are tagged type:'quest_reward' and excluded from session stats.
    try {
      await workoutLogs.create({
        id: `quest-${Date.now()}`,
        date: new Date().toISOString(),
        name: 'Récompenses Quêtes',
        xpEarned: questXP,
        totalVolume: 0,
        setsCompleted: 0,
        durationSeconds: 0,
        muscleDistribution: {},
        exercises: [],
        type: 'quest_reward',
      });
    } catch (_) {}

    await refresh();
    return { completedQuests, bonusUnlocked, questXP };
  }, [workoutLogs, refresh]);

  const enrichedQuests = useMemo(
    () => questState.quests.map(q => ({
      ...q,
      ...(getTemplateById(q.templateId) || {}),
    })),
    [questState.quests],
  );

  const clearAll = useCallback(() => {
    setQuestState({ date: null, quests: [], bonusClaimed: false });
  }, []);

  const value = useMemo(() => ({
    quests: enrichedQuests,
    bonusClaimed: questState.bonusClaimed,
    completedCount: enrichedQuests.filter(q => q.completed).length,
    loading,
    checkAndUpdateQuests,
    refresh,
    clearAll,
  }), [enrichedQuests, questState.bonusClaimed, loading, checkAndUpdateQuests, refresh, clearAll]);

  return <QuestContext.Provider value={value}>{children}</QuestContext.Provider>;
}

export function useQuests() {
  const ctx = useContext(QuestContext);
  if (!ctx) throw new Error('useQuests must be used inside <QuestProvider>');
  return ctx;
}
