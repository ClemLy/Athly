import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Stockage des grosses valeurs (historique, sauvegarde en attente) ─────────
// AsyncStorage a deux plafonds qui finissent par casser un long historique :
//  - Android (SQLite) : une valeur de plus de 2 Mo ne peut plus être relue
//    (environ 700 séances) ;
//  - web (localStorage) : 5 Mo pour TOUT le site (environ 1 700 séances), et
//    au-delà, l'enregistrement d'une nouvelle séance échoue.
// Ici, même interface texte (getItem / setItem / removeItem), mais :
//  - web : IndexedDB, qui n'a pas cette limite (repli sur AsyncStorage si
//    IndexedDB est indisponible, ex : navigation privée de vieux Safari) ;
//  - iOS / Android : la valeur est découpée en morceaux de 400 000 caractères.
// Les données déjà stockées "à l'ancienne" (une seule valeur AsyncStorage)
// sont relues telles quelles puis migrées à la prochaine écriture.

const CHUNK_MARK = '__athly_chunks__:';
let chunkSize = 400 * 1024;

// Tests uniquement : morceaux plus petits pour exercer le découpage.
export function configureBigStorage({ chunkSize: size } = {}) {
  if (size) chunkSize = size;
}

// ─── IndexedDB (web) ──────────────────────────────────────────────────────────

const DB_NAME = 'athly';
const STORE = 'kv';
let dbPromise = null;

function hasIndexedDB() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('indexeddb_blocked'));
    }).catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

async function idb(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ─── Morceaux AsyncStorage (iOS / Android, et repli web) ──────────────────────

const partKey = (key, gen, i) => `${key}::${gen}::${i}`;

function parseMark(head) {
  if (typeof head !== 'string' || !head.startsWith(CHUNK_MARK)) return null;
  const [gen, n] = head.slice(CHUNK_MARK.length).split(':');
  const count = parseInt(n, 10);
  return gen && count > 0 ? { gen, count } : null;
}

const partKeys = (key, mark) => Array.from({ length: mark.count }, (_, i) => partKey(key, mark.gen, i));

async function chunkedGet(key) {
  const head = await AsyncStorage.getItem(key);
  const mark = parseMark(head);
  if (!mark) return head;
  const parts = await AsyncStorage.multiGet(partKeys(key, mark));
  // Morceau manquant : valeur illisible. null plutôt qu'un JSON tronqué
  // (la sauvegarde du compte la restaurera).
  if (parts.some(([, v]) => v == null)) return null;
  return parts.map(([, v]) => v).join('');
}

async function chunkedSet(key, value) {
  const oldMark = parseMark(await AsyncStorage.getItem(key));
  if (value.length <= chunkSize) {
    await AsyncStorage.setItem(key, value);
  } else {
    // Nouveaux morceaux d'abord, repère ensuite : une coupure en plein milieu
    // laisse l'ancienne version intacte et lisible.
    const gen = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    const pairs = [];
    for (let i = 0; i * chunkSize < value.length; i += 1) {
      pairs.push([partKey(key, gen, i), value.slice(i * chunkSize, (i + 1) * chunkSize)]);
    }
    await AsyncStorage.multiSet(pairs);
    await AsyncStorage.setItem(key, `${CHUNK_MARK}${gen}:${pairs.length}`);
  }
  if (oldMark) await AsyncStorage.multiRemove(partKeys(key, oldMark));
}

async function chunkedRemove(key) {
  const mark = parseMark(await AsyncStorage.getItem(key));
  await AsyncStorage.removeItem(key);
  if (mark) await AsyncStorage.multiRemove(partKeys(key, mark));
}

// ─── Interface publique ───────────────────────────────────────────────────────

export async function getItem(key) {
  if (hasIndexedDB()) {
    try {
      const value = await idb('readonly', (s) => s.get(key));
      if (value != null) return value;
      // Première lecture depuis la mise à jour : migration depuis localStorage
      const legacy = await chunkedGet(key);
      if (legacy != null) {
        await idb('readwrite', (s) => s.put(legacy, key));
        await chunkedRemove(key);
      }
      return legacy;
    } catch (_) {
      // IndexedDB indisponible : stockage classique
    }
  }
  return chunkedGet(key);
}

export async function setItem(key, value) {
  if (hasIndexedDB()) {
    try {
      await idb('readwrite', (s) => s.put(value, key));
      // Ancienne copie localStorage éventuelle : libère le quota de 5 Mo
      if ((await AsyncStorage.getItem(key)) != null) await chunkedRemove(key);
      return;
    } catch (_) {
      // repli ci-dessous
    }
  }
  await chunkedSet(key, value);
}

export async function removeItem(key) {
  if (hasIndexedDB()) {
    try { await idb('readwrite', (s) => s.delete(key)); } catch (_) { /* repli */ }
  }
  await chunkedRemove(key);
}

export async function getJson(key, fallback) {
  try {
    const raw = await getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

export function setJson(key, value) {
  return setItem(key, JSON.stringify(value));
}
