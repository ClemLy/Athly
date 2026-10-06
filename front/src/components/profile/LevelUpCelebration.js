import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { markLevelCelebrated, wasLevelCelebrated } from '../../services/levelCelebration';
import LevelUpModal from './LevelUpModal';

// ─── LevelUpCelebration ───────────────────────────────────────────────────────
// À monter une fois dans l'arbre authentifié (AppNavigator). Surveille
// `user.level` (backend) via le UserContext GLOBAL — n'importe quel appel à
// refetch() depuis n'importe quel écran (consommation d'objet d'inventaire,
// bonus de streak de groupe, parrainage…) met à jour `user`, et ce composant
// détecte l'augmentation et célèbre, quelle que soit la source.
//
// Le premier chargement mémorise le niveau sans célébrer (évite un faux
// déclenchement au démarrage de l'app). Un niveau déjà fêté par le récap de
// séance n'est pas célébré une seconde fois (services/levelCelebration).

export default function LevelUpCelebration() {
  const { user } = useUser();
  const previousLevelRef = useRef(null);
  const [state, setState] = useState({ visible: false, prevLevel: null, level: null });

  useEffect(() => {
    if (!user || typeof user.level !== 'number') return;

    if (previousLevelRef.current === null) {
      previousLevelRef.current = user.level;
      return;
    }

    if (user.level > previousLevelRef.current && !wasLevelCelebrated(user.level)) {
      markLevelCelebrated(user.level);
      setState({ visible: true, prevLevel: previousLevelRef.current, level: user.level });
    }
    previousLevelRef.current = user.level;
  }, [user?.level]);

  const handleClose = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  if (!state.visible) return null;

  const initial = ((user && (user.name || user.pseudo)) || 'A').charAt(0).toUpperCase();

  return (
    <LevelUpModal
      visible={state.visible}
      prevLevel={state.prevLevel}
      level={state.level}
      userInitial={initial}
      onClose={handleClose}
    />
  );
}
