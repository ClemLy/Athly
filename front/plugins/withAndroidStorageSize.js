// Plugin Expo : relève le plafond de stockage local d'Android.
// AsyncStorage y est une base SQLite limitée par défaut à 6 Mo pour toute
// l'app, soit environ 2 000 séances d'historique. 64 Mo laissent des années
// de marge. Appliqué à la génération du projet natif (EAS Build, prebuild).
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'AsyncStorage_db_size_in_MB';

module.exports = function withAndroidStorageSize(config, { sizeMB = 64 } = {}) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === KEY));
    cfg.modResults.push({ type: 'property', key: KEY, value: String(sizeMB) });
    return cfg;
  });
};
