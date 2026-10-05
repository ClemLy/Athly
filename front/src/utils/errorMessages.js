// ─── Messages d'erreur lisibles ───────────────────────────────────────────────
// Point unique de traduction "erreur technique → phrase compréhensible".
// Règle : l'utilisateur ne voit JAMAIS un message brut ("Request failed with
// status code 500", "Network Error", "no_id"...). Il voit ce qui s'est passé
// et, quand c'est possible, quoi faire.

export const NETWORK_ERROR_MSG =
  'Impossible de joindre le serveur. Vérifie ta connexion internet puis réessaie.';

export const TIMEOUT_ERROR_MSG =
  'Le serveur met du temps à répondre. Il est peut-être en train de démarrer : réessaie dans quelques secondes.';

export const SESSION_EXPIRED_MSG =
  'Ta session a expiré. Reconnecte-toi pour continuer.';

export const GENERIC_ERROR_MSG =
  "Quelque chose s'est mal passé. Réessaie dans quelques instants.";

const MESSAGE_BY_STATUS = {
  400: 'Certaines informations ne sont pas valides. Vérifie ta saisie.',
  401: SESSION_EXPIRED_MSG,
  403: "Tu n'as pas accès à cette action.",
  404: "Cet élément n'existe plus ou a été supprimé.",
  409: 'Cette action a déjà été prise en compte.',
  413: 'Les données envoyées sont trop volumineuses.',
  422: "Cette action n'est pas possible pour le moment.",
  429: 'Trop de tentatives en peu de temps. Patiente quelques minutes avant de réessayer.',
  500: 'Le serveur a rencontré un problème. Réessaie dans quelques instants.',
  502: 'Le serveur est momentanément indisponible. Réessaie dans quelques minutes.',
  503: 'Le serveur est momentanément indisponible. Réessaie dans quelques minutes.',
  504: TIMEOUT_ERROR_MSG,
};

// Messages techniques que le serveur ou les librairies peuvent renvoyer et
// qui ne doivent jamais apparaître tels quels.
const TECHNICAL_PATTERN = /request failed|status code|network error|timeout of|econn|cast to|validation failed|path `|undefined|null|\[object|jwt|token|^[a-z_]+$/i;

/**
 * Construit le message lisible d'une erreur Axios (appelé par l'intercepteur).
 * Un message serveur explicite (status < 500, rédigé pour l'utilisateur) est
 * conservé ; sinon, message générique selon le statut.
 */
export function describeApiError(error) {
  if (!error) return GENERIC_ERROR_MSG;

  if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    return TIMEOUT_ERROR_MSG;
  }

  const status = error.response?.status ?? error.status;
  if (!status) return NETWORK_ERROR_MSG;

  const data = error.response?.data ?? error.data;
  const serverMessage = data?.message;
  const readable = typeof serverMessage === 'string' && serverMessage.trim() && !TECHNICAL_PATTERN.test(serverMessage);
  // Message serveur gardé pour une erreur métier (4xx, ou 5xx accompagné d'un
  // code explicite, ex. 501 "connexion Google pas encore disponible").
  if (readable && (status < 500 || typeof data?.code === 'string')) {
    return serverMessage.trim();
  }

  if (status >= 500) return MESSAGE_BY_STATUS[status] || MESSAGE_BY_STATUS[500];
  return MESSAGE_BY_STATUS[status] || GENERIC_ERROR_MSG;
}

/**
 * Message à afficher pour n'importe quelle erreur attrapée dans l'UI.
 * @param {unknown} error  erreur attrapée (API, JS, inconnue)
 * @param {string} fallback  message contextuel si l'erreur n'en porte pas de lisible
 *                           (ex : "Impossible d'enregistrer la séance.")
 */
export function getErrorMessage(error, fallback = GENERIC_ERROR_MSG) {
  if (error && typeof error.userMessage === 'string' && error.userMessage) {
    return error.userMessage;
  }
  return fallback;
}
