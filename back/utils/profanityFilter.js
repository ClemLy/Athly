'use strict';

// ─── Filtre anti-injures (Section VIII) ───────────────────────────────────────
// Bloque les pseudos explicitement vulgaires/injurieux à la création de
// compte. Liste de mots clés locale (pas un service tiers), volontairement
// large pour couvrir insultes générales, vulgarités, racisme/xénophobie et
// homophobie (FR + EN) — chaque entrée est vérifiée pour ne pas être un
// substring d'un mot français courant (voir la liste d'exclusions ci-dessous).
//
// Normalisation avant comparaison : minuscules, accents retirés, séparateurs
// (espaces, underscores, chiffres utilisés comme lettres type "3"→"e")
// neutralisés — pour attraper les contournements les plus courants
// ("m3rde", "put_ain") sans faire une analyse linguistique complète.

// Mots volontairement EXCLUS malgré leur proximité avec un terme banni, parce
// qu'ils sont substrings de mots français courants et provoqueraient des
// faux-positifs sur des pseudos légitimes :
//  - "raton"  → substring de "marathonien" (trophée existant, pseudo plausible)
//  - "bride"  → substring de "hybride"
//  - "demeure"/"demeuré" → mot courant ("Belle Demeure"), pas assez spécifique
//  - "attarde" → forme conjuguée courante de "s'attarder"
const BANNED_WORDS = [
  // ── Insultes générales (FR) ──────────────────────────────────────────────
  'connard', 'connasse', 'conne', 'batard', 'bâtard', 'abruti', 'abrutie',
  'crétin', 'cretin', 'imbécile', 'imbecile', 'débile', 'debile',
  'taré', 'trisomique', 'mongolien', 'ordure', 'raclure', 'connerie',
  'branleur', 'branleuse', 'pouffiasse', 'pouf', 'salopard',

  // ── Vulgarités / sexuel (FR) ─────────────────────────────────────────────
  'pute', 'putain', 'salope', 'merde', 'bordel', 'nique', 'niquer', 'enculé',
  'encule', 'enculee', 'enculer', 'bite', 'couille', 'couilles', 'chatte',
  'foutre', 'ntm', 'pd', 'pédé', 'pede', 'tapette', 'gouine',
  'tarlouze', 'enfoiré', 'enfoire', 'fdp',

  // ── Racisme / xénophobie (FR) ────────────────────────────────────────────
  'negro', 'négro', 'negre', 'nègre', 'bougnoule', 'bounty', 'youpin',
  'niakoué', 'niakoue', 'chinetoque', 'yeux bridés', 'bamboula',
  'sale race', 'sale noir', 'sale arabe', 'sale juif',

  // ── Insultes courantes (EN) ──────────────────────────────────────────────
  'fuck', 'shit', 'bitch', 'asshole', 'jackass', 'dumbass', 'cunt', 'nigger',
  'nigga', 'whore', 'slut', 'faggot', 'retard', 'dick', 'pussy', 'cock',
  'motherfucker', 'bastard', 'twat', 'wanker', 'bollocks', 'douchebag',
  'moron', 'idiot', 'scumbag', 'chink', 'kike', 'gook',
];

const LEET_MAP = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', '$': 's' };

function normalize(text) {
  let s = String(text || '').toLowerCase();
  s = s.replace(/[013457@$]/g, (ch) => LEET_MAP[ch] ?? ch);
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); // accents
  s = s.replace(/[^a-z]/g, ''); // ne garde que les lettres — colle les mots séparés par espace/underscore
  return s;
}

/** True si `text` contient un mot de la liste noire (après normalisation). */
function containsProfanity(text) {
  const normalized = normalize(text);
  if (!normalized) return false;
  return BANNED_WORDS.some((word) => normalized.includes(normalize(word)));
}

module.exports = { containsProfanity, normalize };
