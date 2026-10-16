jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const mockPost = jest.fn();
const mockGet = jest.fn();
jest.mock('../../api/api', () => ({
  __esModule: true,
  default: { post: (...a) => mockPost(...a), get: (...a) => mockGet(...a) },
}));
const mockGetToken = jest.fn();
jest.mock('../../utils/authStorage', () => ({ getToken: (...a) => mockGetToken(...a) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCloudCollection, diffOps, mergeRemote, pendingKeyFor } from '../cloudCollection';

const KEY = 'test:items:v1';
const pending = async () => JSON.parse((await AsyncStorage.getItem(pendingKeyFor('logs'))) || '{}');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockGetToken.mockResolvedValue('jeton');
  mockPost.mockResolvedValue({ data: { success: true } });
});

describe('diffOps', () => {
  it('repère créations, modifications et suppressions', () => {
    const ops = diffOps(
      [{ id: 'a', v: 1 }, { id: 'b', v: 1 }],
      [{ id: 'a', v: 2 }, { id: 'c', v: 1 }],
    );
    expect(ops).toEqual({
      a: { op: 'put', item: { id: 'a', v: 2 } },
      c: { op: 'put', item: { id: 'c', v: 1 } },
      b: { op: 'del' },
    });
  });

  it("ne note rien quand rien n'a changé", () => {
    expect(diffOps([{ id: 'a', v: 1 }], [{ id: 'a', v: 1 }])).toEqual({});
  });
});

describe('mergeRemote', () => {
  const remote = [
    { id: 'r1', data: { id: 'r1', date: '2026-10-03' }, deleted: false },
    { id: 'gone', data: null, deleted: true },
    { id: 'both', data: { id: 'both', date: '2026-10-02', v: 'serveur' }, deleted: false },
  ];

  it('restaure sur un nouvel appareil (aucune donnée locale)', () => {
    const { items, backfill } = mergeRemote([], remote, {}, (x) => x.date);
    expect(items.map((x) => x.id)).toEqual(['r1', 'both']);
    expect(backfill).toEqual({});
  });

  it('applique les suppressions faites ailleurs et envoie les éléments inconnus du serveur', () => {
    const local = [
      { id: 'gone', date: '2026-10-01' },
      { id: 'old', date: '2026-09-01' },
    ];
    const { items, backfill } = mergeRemote(local, remote, {}, (x) => x.date);
    expect(items.map((x) => x.id)).toEqual(['r1', 'both', 'old']);
    expect(Object.keys(backfill)).toEqual(['old']);
  });

  it("garde une modification locale pas encore envoyée, sinon la version du serveur", () => {
    const local = [{ id: 'both', date: '2026-10-02', v: 'local' }];
    expect(mergeRemote(local, remote, {}, null).items.find((x) => x.id === 'both').v).toBe('serveur');
    const withPending = { both: { op: 'put', item: local[0] } };
    expect(mergeRemote(local, remote, withPending, null).items.find((x) => x.id === 'both').v).toBe('local');
  });

  it("ne ressuscite pas un élément supprimé ici mais pas encore côté serveur", () => {
    const { items } = mergeRemote([], remote, { r1: { op: 'del' } }, null);
    expect(items.map((x) => x.id)).toEqual(['both']);
  });
});

describe('createCloudCollection', () => {
  const make = () => createCloudCollection({ kind: 'logs', storageKey: KEY, sortKey: (x) => x.date });

  it("écrit localement, met en file puis envoie au serveur", async () => {
    const c = make();
    await c.writeLocal([{ id: 'a', date: '2026-10-01' }]);
    expect(JSON.parse(await AsyncStorage.getItem(KEY))).toHaveLength(1);
    expect(Object.keys(await pending())).toEqual(['a']);

    await c.flush();
    expect(mockPost).toHaveBeenCalledWith('/cloud/logs/sync', { puts: [{ id: 'a', date: '2026-10-01' }], dels: [] });
    expect(await pending()).toEqual({});
  });

  it('garde la file intacte si le serveur est injoignable', async () => {
    const c = make();
    await c.writeLocal([{ id: 'a' }]);
    mockPost.mockRejectedValueOnce({ network: true });
    await c.flush();
    expect(Object.keys(await pending())).toEqual(['a']);
  });

  it("n'envoie rien sans session", async () => {
    mockGetToken.mockResolvedValue(null);
    const c = make();
    await c.writeLocal([{ id: 'a' }]);
    await c.flush();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('découpe un gros historique en plusieurs lots', async () => {
    const c = make();
    const many = Array.from({ length: 250 }, (_, i) => ({ id: `log-${i}` }));
    await c.writeLocal(many);
    await c.flush();
    expect(mockPost).toHaveBeenCalledTimes(3);
    expect(await pending()).toEqual({});
  });

  it('restaure la sauvegarde sur un nouvel appareil', async () => {
    mockGet.mockResolvedValue({ data: { items: [{ id: 'r1', data: { id: 'r1', date: '2026-10-03' }, deleted: false }] } });
    const c = make();
    const out = await c.pullAndMerge();
    expect(out.changed).toBe(true);
    expect(JSON.parse(await AsyncStorage.getItem(KEY))).toEqual([{ id: 'r1', date: '2026-10-03' }]);
  });

  it("ignore une réponse servie par le cache hors ligne", async () => {
    mockGet.mockResolvedValue({ fromCache: true, data: { items: [] } });
    await AsyncStorage.setItem(KEY, JSON.stringify([{ id: 'a' }]));
    expect(await make().pullAndMerge()).toBeNull();
    expect(JSON.parse(await AsyncStorage.getItem(KEY))).toEqual([{ id: 'a' }]);
  });

  it("une écriture pendant la restauration ne supprime rien", async () => {
    let release;
    mockGet.mockReturnValue(new Promise((r) => { release = r; }));
    const c = make();
    const pull = c.pullAndMerge();
    const write = c.transaction(async () => {
      const cur = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
      await AsyncStorage.setItem(KEY, JSON.stringify([{ id: 'new', date: '2026-10-05' }, ...cur]));
    });
    release({ data: { items: [{ id: 'r1', data: { id: 'r1', date: '2026-10-03' }, deleted: false }] } });
    await Promise.all([pull, write]);
    const ids = JSON.parse(await AsyncStorage.getItem(KEY)).map((x) => x.id).sort();
    expect(ids).toEqual(['new', 'r1']);
    const ops = Object.values(await pending()).map((o) => o.op);
    expect(ops).not.toContain('del');
  });
});
