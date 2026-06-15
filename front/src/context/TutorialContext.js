import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TUTORIAL_CHAPTERS, CHAPTER_MAP, CHAPTER_IDS } from '../data/tutorialChapters';

const DONE_KEY    = 'athly:tutorial:completed:v1';
const PENDING_KEY = 'athly:tutorial:pendingChapter:v1';

const TutorialContext = createContext(null);

export function TutorialProvider({ children }) {
  const [isActive,         setIsActive]         = useState(false);
  const [activeChapterId,  setActiveChapterId]  = useState(null);
  const [stepIndex,        setStepIndex]        = useState(0);
  const [hasCompleted,     setHasCompleted]     = useState(true);
  const [pendingChapterId, setPendingChapterId] = useState(null);
  const [targets,          setTargets]          = useState({});
  const [bootstrapped,     setBootstrapped]     = useState(false);
  const [justCompleted,    setJustCompleted]    = useState(false);
  // { [chapterId]: scrollRef } — scroll ref enregistré par chaque écran participant
  const scrollRefs     = useRef({});
  // { [chapterId]: fn() } — callback de re-mesure des cibles
  const remeasureFns   = useRef({});

  // ─── Persistance ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [done, pending] = await Promise.all([
          AsyncStorage.getItem(DONE_KEY),
          AsyncStorage.getItem(PENDING_KEY),
        ]);
        setHasCompleted(done === 'true');
        if (pending) setPendingChapterId(pending);
      } catch (_) {}
      finally { setBootstrapped(true); }
    })();
  }, []);

  // ─── Target registry ───────────────────────────────────────────────────────
  const registerTarget = useCallback((key, rect) => {
    setTargets((prev) => ({ ...prev, [key]: rect }));
  }, []);

  const clearTargets = useCallback(() => setTargets({}), []);

  // ─── Scroll registry ───────────────────────────────────────────────────────
  // Chaque écran appelle registerScrollRef(chapterId, ref) et optionnellement
  // registerRemeasure(chapterId, fn) pour que le contexte puisse re-mesurer
  // les cibles après un scroll automatique.
  const registerScrollRef = useCallback((chapterId, scrollRef) => {
    scrollRefs.current[chapterId] = scrollRef;
  }, []);

  const registerRemeasure = useCallback((chapterId, fn) => {
    remeasureFns.current[chapterId] = fn;
  }, []);

  // Déclenche le scroll pour l'étape courante d'un chapitre, puis re-mesure les cibles.
  const scrollToStep = useCallback((chapterId, y) => {
    if (y == null) return;
    const scrollRef = scrollRefs.current[chapterId];
    if (!scrollRef?.current) return;
    scrollRef.current.scrollTo({ y, animated: true });
    // Re-mesure des cibles après la fin de l'animation (~300 ms)
    setTimeout(() => {
      const remeasure = remeasureFns.current[chapterId];
      if (remeasure) remeasure();
    }, 350);
  }, []);

  // ─── Chapter / step control ─────────────────────────────────────────────────
  const startChapter = useCallback(async (chapterId, fromStep = 0) => {
    if (!CHAPTER_MAP[chapterId]) return;
    setActiveChapterId(chapterId);
    setStepIndex(fromStep);
    setIsActive(true);
    setPendingChapterId(null);
    await AsyncStorage.removeItem(PENDING_KEY);
  }, []);

  const _advanceOrTransition = useCallback(async (navigation, chapterId, currentStepIndex) => {
    const chapter = CHAPTER_MAP[chapterId];
    if (!chapter) return;

    const isLastStep = currentStepIndex >= chapter.steps.length - 1;

    if (!isLastStep) {
      const nextIdx = currentStepIndex + 1;
      setStepIndex(nextIdx);
      // Auto-scroll pour la nouvelle étape
      const nextStepData = chapter.steps[nextIdx];
      if (nextStepData?.scrollY != null) {
        setTimeout(() => scrollToStep(chapterId, nextStepData.scrollY), 80);
      }
      return;
    }

    // Fin du chapitre → chapitre suivant
    const currentIdx  = CHAPTER_IDS.indexOf(chapterId);
    const nextChapterId = CHAPTER_IDS[currentIdx + 1];

    if (!nextChapterId) {
      // Dernier chapitre terminé
      setIsActive(false);
      setActiveChapterId(null);
      setStepIndex(0);
      setHasCompleted(true);
      setJustCompleted(true);
      await Promise.all([
        AsyncStorage.setItem(DONE_KEY, 'true'),
        AsyncStorage.removeItem(PENDING_KEY),
      ]);
      return;
    }

    const nextChapter = CHAPTER_MAP[nextChapterId];
    setIsActive(false);
    setActiveChapterId(null);
    setPendingChapterId(nextChapterId);
    await AsyncStorage.setItem(PENDING_KEY, nextChapterId);

    if (navigation) {
      if (nextChapter.stackScreen) {
        navigation.navigate(nextChapter.tabName, { screen: nextChapter.stackScreen });
      } else {
        navigation.navigate(nextChapter.tabName);
      }
    }
  }, [scrollToStep]);

  const nextStep = useCallback((navigation) => {
    _advanceOrTransition(navigation, activeChapterId, stepIndex);
  }, [_advanceOrTransition, activeChapterId, stepIndex]);

  // Appelé par les écrans quand l'utilisateur a effectué l'action d'une step actionRequired
  const completeActionStep = useCallback((navigation) => {
    const chapter = CHAPTER_MAP[activeChapterId];
    const step    = chapter?.steps[stepIndex];
    if (!step?.actionRequired) return;
    _advanceOrTransition(navigation, activeChapterId, stepIndex);
  }, [_advanceOrTransition, activeChapterId, stepIndex]);

  const prevStep = useCallback(() => {
    if (stepIndex > 0) setStepIndex((s) => s - 1);
  }, [stepIndex]);

  const dismiss = useCallback(async () => {
    setIsActive(false); setActiveChapterId(null); setStepIndex(0);
    setPendingChapterId(null); setHasCompleted(true);
    await Promise.all([
      AsyncStorage.setItem(DONE_KEY, 'true'),
      AsyncStorage.removeItem(PENDING_KEY),
    ]);
  }, []);

  const clearJustCompleted = useCallback(() => setJustCompleted(false), []);

  const resetTutorial = useCallback(async () => {
    setHasCompleted(false); setIsActive(false); setActiveChapterId(null);
    setStepIndex(0); setPendingChapterId(null); setJustCompleted(false);
    await Promise.all([
      AsyncStorage.setItem(DONE_KEY, 'false'),
      AsyncStorage.removeItem(PENDING_KEY),
    ]);
  }, []);

  // ─── Derived ──────────────────────────────────────────────────────────────
  const activeChapter = CHAPTER_MAP[activeChapterId] || null;
  const activeStep    = activeChapter ? activeChapter.steps[stepIndex] : null;
  const isLastChapter = activeChapterId === CHAPTER_IDS[CHAPTER_IDS.length - 1];
  const isLastStep    = activeChapter ? stepIndex >= activeChapter.steps.length - 1 : false;

  return (
    <TutorialContext.Provider value={{
      isActive, activeChapterId, activeChapter, activeStep,
      stepIndex, isLastStep, isLastChapter,
      hasCompleted, pendingChapterId, targets,
      bootstrapped,
      justCompleted, clearJustCompleted,
      registerTarget, clearTargets,
      registerScrollRef, registerRemeasure, scrollToStep,
      startChapter, nextStep, prevStep, completeActionStep,
      dismiss, resetTutorial,
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be inside <TutorialProvider>');
  return ctx;
}

// Enregistre une cible de spotlight avec mesure automatique via onLayout
export function useTutorialTarget(key) {
  const { registerTarget } = useTutorial();
  const ref = useRef(null);

  const measure = useCallback(() => {
    if (!ref.current) return;
    // pageX / pageY de measure() donnent la position absolue par rapport à la
    // racine de l'application — c'est la seule valeur fiable sur iOS et Android
    // (StatusBar translucide incluse) pour placer l'overlay correctement.
    ref.current.measure((_x, _y, width, height, pageX, pageY) => {
      if (width === 0 && height === 0) return; // composant pas encore rendu
      registerTarget(key, { x: pageX, y: pageY, width, height });
    });
  }, [key, registerTarget]);

  const onLayout = useCallback(() => {
    setTimeout(measure, 80);
  }, [measure]);

  return { ref, onLayout, remeasure: measure };
}
