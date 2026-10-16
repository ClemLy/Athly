import * as bigStorage from '../utils/bigStorage';

// Chargés à la demande : les services qui utilisent ce module restent
// importables dans les tests unitaires (sans React Native ni réseau).
const api = () => require('../api/api').default;
async function getToken() {
  try { return await require('../utils/authStorage').getToken(); } catch (_) { return null; }
}

// ─── Sauvegarde du compte (miroir serveur des données locales) ────────────────
// L'app reste local-first : tout s'écrit d'abord sur le téléphone, l'écran ne
// dépend jamais du réseau. Chaque écriture compare l'ancienne et la nouvelle
// liste et note les différences dans une file d'attente (créations,
// modifications, suppressions), envoyée au serveur dès que possible
// (POST /api/cloud/:kind/sync). Hors ligne, la file attend le retour du réseau.
//
// Au démarrage (et sur un nouvel appareil), `pullAndMerge` récupère la
// sauvegarde et fusionne :
//   - un changement local pas encore envoyé gagne toujours ;
//   - sinon la version du serveur fait foi (autre appareil plus récent) ;
//   - un élément supprimé ailleurs disparaît ici aussi ;
//   - un élément local inconnu du serveur (données d'avant la sauvegarde) y
//     est envoyé.
// La file d'attente est propre à chaque compte (voir accountScope.service.js).

const BATCH_MAX_ITEMS = 100;          // aligné sur validators/cloud.validator.js
const BATCH_MAX_DELS = 500;
const BATCH_MAX_BYTES = 300 * 1024;   // sous la limite de 512 ko du serveur
const ITEM_MAX_BYTES = 60 * 1024;     // au-delà, refusé par le serveur : ignoré
const FLUSH_DELAY_MS = 1500;

export const pendingKeyFor = (kind) => `athly:cloud:pending:${kind}:v1`;

// Listes et file d'attente peuvent devenir volumineuses (premier envoi d'un
// long historique) : stockage adapté aux grosses valeurs.
const readJson = (key, fallback) => bigStorage.getJson(key, fallback);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Différences entre deux listes d'éléments { id, ... }
export function diffOps(prev, next) {
  const ops = {};
  const before = new Map((prev || []).map((x) => [x.id, JSON.stringify(x)]));
  const after = new Set();
  for (const item of next || []) {
    if (!item || !item.id) continue;
    after.add(item.id);
    if (before.get(item.id) !== JSON.stringify(item)) ops[item.id] = { op: 'put', item };
  }
  for (const id of before.keys()) {
    if (!after.has(id)) ops[id] = { op: 'del' };
  }
  return ops;
}

// Fusion décrite en tête de fichier. Pure : testée dans __tests__.
export function mergeRemote(local, remote, pending, sortKey) {
  const remoteById = new Map((remote || []).map((r) => [r.id, r]));
  const result = [];
  const seen = new Set();
  const backfill = {};

  for (const item of local || []) {
    if (!item || !item.id) continue;
    seen.add(item.id);
    if (pending[item.id]) { result.push(item); continue; }
    const r = remoteById.get(item.id);
    if (!r) { result.push(item); backfill[item.id] = { op: 'put', item }; continue; }
    if (r.deleted || !r.data) continue;
    result.push(r.data);
  }
  for (const r of remote || []) {
    if (seen.has(r.id) || r.deleted || !r.data) continue;
    if (pending[r.id]?.op === 'del') continue;
    result.push(r.data);
  }
  if (sortKey) {
    const t = (x) => new Date(sortKey(x) || 0).getTime() || 0;
    result.sort((a, b) => t(b) - t(a));
  }
  return { items: result, backfill };
}

/**
 * @param {{ kind: string, storageKey?: string, read?: () => Promise<object[]>,
 *           write?: (items: object[]) => Promise<void>, sortKey?: (item: object) => any }} options
 *   `storageKey` : liste JSON (voir utils/bigStorage.js). `read`/`write`
 *   remplacent ce stockage (préférences réparties sur plusieurs clés).
 */
export function createCloudCollection({ kind, storageKey, read, write, sortKey }) {
  const pendingKey = pendingKeyFor(kind);
  const readItems = read || (async () => {
    const list = await readJson(storageKey, []);
    return Array.isArray(list) ? list : [];
  });
  const writeItems = write || ((items) => bigStorage.setJson(storageKey, items));

  // Les lectures-écritures de la file d'attente passent une par une.
  let chain = Promise.resolve();
  const withLock = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  let timer = null;
  let flushing = null;

  const readPending = () => readJson(pendingKey, {});
  const writePending = (p) => bigStorage.setJson(pendingKey, p);

  function scheduleFlush() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; flush(); }, FLUSH_DELAY_MS);
    timer?.unref?.(); // Node (tests) : n'empêche pas le processus de se terminer
  }

  async function queue(ops) {
    if (Object.keys(ops).length === 0) return;
    await withLock(async () => writePending({ ...(await readPending()), ...ops }));
    scheduleFlush();
  }

  // Exécute une modification d'un seul tenant (lecture, calcul, écriture) et
  // met en file ce qui a changé. Sous le même verrou que la fusion : une
  // écriture ne peut pas se glisser au milieu d'une restauration (sinon les
  // éléments restaurés seraient pris pour des suppressions).
  function transaction(fn) {
    const run = withLock(async () => {
      const before = await readItems();
      // fn reçoit de quoi lire et écrire la liste sans repasser par le verrou.
      const result = await fn({ read: readItems, write: writeItems });
      const ops = diffOps(before, await readItems());
      if (Object.keys(ops).length) await writePending({ ...(await readPending()), ...ops });
      return result;
    });
    run.then(scheduleFlush, () => {});
    return run;
  }

  // Remplace toute la liste (même garanties qu'une transaction).
  function writeLocal(next) {
    return transaction(() => writeItems(next));
  }

  // Signale un élément modifié hors de writeLocal (préférences).
  async function markPut(item) {
    await queue({ [item.id]: { op: 'put', item } });
  }

  // Retire de la file ce qui a été accepté, sauf si ça a changé entre-temps.
  async function ack(entries) {
    await withLock(async () => {
      const p = await readPending();
      for (const [id, op] of entries) {
        if (p[id] && same(p[id], op)) delete p[id];
      }
      await writePending(p);
    });
  }

  async function sendBatch(entries) {
    const puts = entries.filter(([, o]) => o.op === 'put').map(([, o]) => o.item);
    const dels = entries.filter(([, o]) => o.op === 'del').map(([id]) => id);
    await api().post(`/cloud/${kind}/sync`, { puts, dels });
    await ack(entries);
  }

  // Envoie la file d'attente par lots. Silencieux : réessaie au prochain essai.
  function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      try {
        if (!(await getToken())) return;
        const entries = Object.entries(await readPending());
        if (entries.length === 0) return;

        const tooBig = entries.filter(([, o]) => o.op === 'put' && JSON.stringify(o.item).length > ITEM_MAX_BYTES);
        if (tooBig.length) await ack(tooBig);

        let batch = [];
        let bytes = 0;
        let puts = 0;
        let dels = 0;
        for (const entry of entries) {
          const [, o] = entry;
          if (o.op === 'put' && JSON.stringify(o.item).length > ITEM_MAX_BYTES) continue;
          const size = o.op === 'put' ? JSON.stringify(o.item).length : 0;
          const full = (o.op === 'put' && (puts >= BATCH_MAX_ITEMS || bytes + size > BATCH_MAX_BYTES))
            || (o.op === 'del' && dels >= BATCH_MAX_DELS);
          if (full && batch.length) {
            await sendBatch(batch);
            batch = []; bytes = 0; puts = 0; dels = 0;
          }
          batch.push(entry);
          if (o.op === 'put') { puts += 1; bytes += size; } else { dels += 1; }
        }
        if (batch.length) await sendBatch(batch);
      } catch (_) {
        // Hors ligne, serveur qui démarre… la file reste, nouvel essai plus tard.
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  /**
   * Récupère la sauvegarde du compte et la fusionne avec les données locales.
   * @returns {Promise<{ items: object[], changed: boolean } | null>} null si
   *   pas connecté ou serveur injoignable (les données locales restent).
   */
  async function pullAndMerge() {
    try {
      if (!(await getToken())) return null;
      const res = await api().get(`/cloud/${kind}`);
      // Réponse servie par le cache hors ligne : potentiellement périmée.
      if (res.fromCache || !Array.isArray(res.data?.items)) return null;
      const out = await withLock(async () => {
        const local = await readItems();
        const pending = await readPending();
        const { items, backfill } = mergeRemote(local, res.data.items, pending, sortKey);
        const changed = !same(items, local);
        if (changed) await writeItems(items);
        if (Object.keys(backfill).length) await writePending({ ...pending, ...backfill });
        return { items, changed };
      });
      flush();
      return out;
    } catch (_) {
      return null;
    }
  }

  return { readLocal: readItems, writeLocal, transaction, markPut, flush, pullAndMerge };
}
