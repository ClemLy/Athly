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

// Termes sans ambiguïté : détectés même collés à d'autres lettres
// ("SuperConnard69", "fuckyou").
const ALWAYS_SUBSTRING = new Set([
  'fuck', 'merde', 'putain', 'salope', 'connard', 'connasse', 'encule', 'enculer',
  'enculee', 'nigger', 'nigga', 'batard', 'motherfucker',
]);

// Termes courts ou contenus dans des mots/prénoms courants : détectés
// UNIQUEMENT comme mot isolé, sinon "Dominique"/"Véronique" (nique),
// "Conner" (conne), "Computer" (pute), "Tarek" (taré) ou "AliceRgpd" (pd)
// seraient refusés à tort.
const TOKEN_ONLY = new Set(['chatte', 'retard', 'bounty', 'debile', 'ordure']);

function stripAccentsAndLeet(text) {
  let s = String(text || '');
  s = s.replace(/[013457@$]/g, (ch) => LEET_MAP[ch] ?? ch);
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // accents
  return s;
}

function normalize(text) {
  // ne garde que les lettres : colle les mots séparés par espace/underscore
  return stripAccentsAndLeet(text).toLowerCase().replace(/[^a-z]/g, '');
}

// Découpe en mots : séparateurs non-lettres ET frontières camelCase ("SuperConnard" → super, connard)
function tokenize(text) {
  return stripAccentsAndLeet(text)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

const NORMALIZED_WORDS = [...new Set(BANNED_WORDS.map(normalize))].filter(Boolean);

/** True si `text` contient un mot de la liste noire (après normalisation). */
function containsProfanity(text) {
  const collapsed = normalize(text);
  if (!collapsed) return false;
  const tokens = new Set(tokenize(text));

  return NORMALIZED_WORDS.some((word) => {
    const substringAllowed = ALWAYS_SUBSTRING.has(word) || (word.length >= 6 && !TOKEN_ONLY.has(word));
    if (substringAllowed) return collapsed.includes(word);
    return tokens.has(word);
  });
}

module.exports = { containsProfanity, normalize };
