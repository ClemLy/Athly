// Statistiques par période de l'écran Stats : découpage, totaux, comparaison.
const {
  computePeriodStats,
  indexLogsByDay,
  monthSummary,
  longDay,
} = require('../periodStats');

// Mardi 6 octobre 2026, 15 h (heure locale).
const NOW = new Date(2026, 9, 6, 15, 0, 0);

function log(daysAgo, volume, extra = {}) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(18, 30, 0, 0);
  if (daysAgo === 0) d.setHours(9, 0, 0, 0);
  return {
    id: `l${daysAgo}-${volume}`,
    date: d.toISOString(),
    totalVolume: volume,
    setsCompleted: 10,
    durationSeconds: 3600,
    muscleDistribution: { pectoraux: volume },
    ...extra,
  };
}

describe('computePeriodStats — 7 jours', () => {
  it('découpe 7 jours se terminant aujourd\'hui', () => {
    const s = computePeriodStats([], '7d', NOW);
    expect(s.buckets).toHaveLength(7);
    expect(s.buckets[6].label).toBe('auj.');
    expect(s.buckets[5].label).toBe('lun.');
    expect(s.buckets[0].label).toBe('mer.');
    expect(s.rangeLabel).toBe('Du 30 sept. au 6 oct.');
  });

  it('les barres additionnées donnent les chiffres clés', () => {
    const logs = [log(0, 1000), log(1, 2000), log(6, 500), log(7, 9999)];
    const s = computePeriodStats(logs, '7d', NOW);
    expect(s.totals.sessions).toBe(3);
    expect(s.totals.volume).toBe(3500);
    expect(s.buckets.reduce((n, b) => n + b.volume, 0)).toBe(3500);
    expect(s.buckets[6].volume).toBe(1000);
    expect(s.buckets[0].volume).toBe(500);
  });

  it('compare avec les 7 jours précédents', () => {
    const logs = [log(1, 2000), log(7, 800), log(13, 700), log(14, 5000)];
    const s = computePeriodStats(logs, '7d', NOW);
    expect(s.previous.sessions).toBe(2);
    expect(s.previous.volume).toBe(1500);
  });
});

describe('computePeriodStats — 4 semaines', () => {
  it('4 barres de 7 jours glissants, étiquetées par leur premier jour', () => {
    const s = computePeriodStats([], '4w', NOW);
    expect(s.buckets.map((b) => b.label)).toEqual(['9 sept.', '16 sept.', '23 sept.', '30 sept.']);
    expect(s.buckets[3].fullLabel).toBe('Du 30 sept. au 6 oct.');
    expect(s.buckets[0].fullLabel).toBe('Du 9 au 15 sept.');
  });

  it('une séance à J-27 compte, J-28 va dans la période précédente', () => {
    const s = computePeriodStats([log(27, 100), log(28, 200)], '4w', NOW);
    expect(s.totals.volume).toBe(100);
    expect(s.previous.volume).toBe(200);
  });
});

describe('computePeriodStats — 12 mois', () => {
  it('12 mois calendaires, le dernier est le mois en cours', () => {
    const s = computePeriodStats([], '12m', NOW);
    expect(s.buckets).toHaveLength(12);
    expect(s.buckets[11].label).toBe('oct.');
    expect(s.buckets[11].fullLabel).toBe('octobre 2026');
    expect(s.buckets[0].fullLabel).toBe('novembre 2025');
  });
});

describe('computePeriodStats — muscles', () => {
  it('trie les groupes du plus au moins travaillé, avec leur part', () => {
    const logs = [
      log(1, 300, { muscleDistribution: { dos: 100, jambes: 200 } }),
      log(2, 100, { muscleDistribution: { dos: 100 } }),
    ];
    const s = computePeriodStats(logs, '7d', NOW);
    expect(s.muscles.map((m) => m.id)).toEqual(['dos', 'jambes']);
    expect(s.muscles[0].share).toBeCloseTo(0.5);
    expect(s.muscles[0].label).toBe('Dos');
  });

  it('signale les groupes principaux délaissés à partir de 3 séances', () => {
    const logs = [1, 2, 3].map((d) => log(d, 100, {
      muscleDistribution: { pectoraux: 30, dos: 30, epaules: 20, bras: 20, jambes: 1 },
    }));
    const s = computePeriodStats(logs, '7d', NOW);
    expect(s.neglected).toEqual(['Jambes', 'Abdos']);
  });

  it('pas de conseil avec trop peu de séances', () => {
    const s = computePeriodStats([log(1, 100)], '7d', NOW);
    expect(s.neglected).toEqual([]);
  });
});

describe('calendrier', () => {
  it('indexe tout l\'historique par jour local', () => {
    const idx = indexLogsByDay([log(0, 1), log(0, 2), log(40, 3), { date: 'pas une date' }]);
    expect(idx['2026-10-06']).toHaveLength(2);
    expect(Object.keys(idx)).toHaveLength(2);
  });

  it('résume un mois calendaire', () => {
    const m = monthSummary([log(0, 100), log(5, 50), log(6, 25)], 2026, 9);
    expect(m.sessions).toBe(2);
    expect(m.volume).toBe(150);
  });

  it('écrit un jour en toutes lettres', () => {
    expect(longDay('2026-10-06')).toBe('mardi 6 octobre');
  });
});
