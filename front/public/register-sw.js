// Enregistrement du service worker (mode hors ligne + installation de la PWA).
// Fichier externe plutôt que script inline : compatible avec la politique de
// sécurité du contenu (CSP) qui interdit les scripts inline (voir vercel.json).
// Désactivé en local pour ne jamais servir un ancien bundle de développement.
(function () {
  if (!('serviceWorker' in navigator)) return;
  var host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {
      // Sans service worker l'app fonctionne normalement, seulement sans mode hors ligne.
    });
  });
})();
