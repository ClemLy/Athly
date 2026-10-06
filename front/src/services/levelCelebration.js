// Niveaux déjà célébrés pendant la session.
//
// Le récap de fin de séance célèbre la montée de niveau tout de suite (calcul
// local). Le profil serveur est rechargé plus tard (écran Profil…) et
// LevelUpCelebration verrait alors la même hausse : sans ce registre, la même
// montée de niveau serait fêtée deux fois.

let highestCelebrated = 0;

export function markLevelCelebrated(level) {
  const n = Number(level) || 0;
  if (n > highestCelebrated) highestCelebrated = n;
}

export function wasLevelCelebrated(level) {
  return (Number(level) || 0) <= highestCelebrated;
}
