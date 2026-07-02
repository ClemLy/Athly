import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import LevelUpModal from './LevelUpModal';

// ─── LevelUpCelebration ───────────────────────────────────────────────────────
// À monter une fois dans l'arbre authentifié (AppNavigator). Surveille
// `user.level` (backend) via le UserContext GLOBAL — n'importe quel appel à
// refetch() depuis n'importe quel écran (fin de séance, consommation d'objet
// d'inventaire, bonus de streak de groupe, parrainage…) met à jour `user`, et
// ce composant détecte l'augmentation et célèbre, quelle que soit la source.
//
// Le premier chargement mémorise le niveau sans célébrer (évite un faux
// déclenchement au démarrage de l'app).

export default function LevelUpCelebration() {
  const { user } = useUser();
  const previousLevelRef = useRef(null);
  const [state, setState] = useState({ visible: false, level: null, rank: null });

  useEffect(() => {
    if (!user || typeof user.level !== 'number') return;

    if (previousLevelRef.current === null) {
      previousLevelRef.current = user.level;
      return;
    }

    if (user.level > previousLevelRef.current) {
      setState({ visible: true, level: user.level, rank: user.rank });
    }
    previousLevelRef.current = user.level;
  }, [user?.level, user?.rank]);

  const handleClose = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  if (!state.visible) return null;

  return (
    <LevelUpModal
      visible={state.visible}
      level={state.level}
      rank={state.rank}
      onClose={handleClose}
    />
  );
}
