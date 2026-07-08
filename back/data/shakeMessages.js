'use strict';

// Bouton "Secouer" (Section IV) : textes troll/passif-agressif façon Duolingo,
// tirés au sort à chaque secousse pour ne jamais être répétitifs. Partagé
// entre le vrai shakeMember (groupStreak.controller.js) et l'outil de test
// God Mode simulateShakeSelf (debug.controller.js) — un seul pool à faire
// évoluer, jamais deux copies qui divergent.
const SHAKE_TROLL_MESSAGES = [
  "Ah donc tu comptes nous abandonner comme ça ? Ok.",
  "Tu vas briser la streak de l'équipe... tout le monde attend après toi. 👁️",
  "On sait que tu es en ligne. On voit tout.",
  "Ta séance ne va pas se faire toute seule, curieusement.",
  "Le groupe compte sur toi. Ou pas, si tu préfères tout gâcher.",
  "Petit rappel amical : tu es le maillon faible aujourd'hui.",
  "5 personnes attendent. 1 personne glande. Devine qui.",
  "On ne dit rien, mais on pense tous la même chose.",
  "Ça sent le remplacement de coéquipier, cette histoire.",
  "Ton streak gel ne va pas se recharger tout seul, hein.",
  "Il paraît que tu regardais encore ton téléphone à cette heure-ci.",
  "Le groupe a un chat privé. Ton nom y revient beaucoup.",
  "On a mis un rappel. Puis deux. Voici le troisième.",
  "Une séance, ce n'est pas la mer à boire. Enfin, on croit.",
  "Si la streak meurt, on saura à qui la faute.",
];

module.exports = { SHAKE_TROLL_MESSAGES };
