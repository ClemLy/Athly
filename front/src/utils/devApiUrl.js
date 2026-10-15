// Remplace l'hôte d'une URL d'API locale (localhost, IP du Wi-Fi) par l'hôte
// réellement utilisé pour ouvrir l'app en développement. Une URL distante
// (staging, production) est laissée telle quelle.
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export function resolveDevApiUrl(envUrl, devHost) {
  const m = /^(https?):\/\/([^/:]+)(?::(\d+))?(\/.*)?$/.exec(envUrl || '');
  if (!m || !devHost || !LOCAL_HOST_PATTERN.test(m[2])) return envUrl;
  return `${m[1]}://${devHost}${m[3] ? `:${m[3]}` : ''}${m[4] || ''}`;
}
