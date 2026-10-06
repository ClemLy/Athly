// Calculs de la page d'accueil.
const { weekDays, weekTotals, daysSinceGroup, recommendationReason, greeting, localDayKey } = require('../homeInsights');

// Mardi 6 octobre 2026, 10 h (heure locale)
const NOW = new Date(2026, 9, 6, 10, 0, 0);
const at = (d, h = 18) => new Date(2026, 9, d, h, 0, 0).toISOString();

describe('semaine en cours', () => {
  test('lundi → dimanche, aujourd\'hui et jours entraînés', () => {
    const days = weekDays([{ date: at(5) }, { date: at(6, 8) }, { date: at(1) }], NOW);
    expect(days.map((d) => d.letter)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    expect(days[0].key).toBe('2026-10-05');
    expect(days.filter((d) => d.trained).map((d) => d.key)).toEqual(['2026-10-05', '2026-10-06']);
    expect(days[1].isToday).toBe(true);
    expect(days.slice(2).every((d) => d.isFuture)).toBe(true);
  });
  test('le dimanche appartient à la semaine qui se termine', () => {
    const sunday = new Date(2026, 9, 11, 21, 0, 0);
    const days = weekDays([], sunday);
    expect(days[0].key).toBe('2026-10-05');
    expect(days[6].isToday).toBe(true);
  });
  test('totaux limités à la semaine affichée', () => {
    const logs = [{ date: at(5), totalVolume: 4000 }, { date: at(6, 8), totalVolume: 2500 }, { date: at(2), totalVolume: 9000 }];
    expect(weekTotals(logs, weekDays(logs, NOW))).toEqual({ sessions: 2, volume: 6500 });
  });
  test('séance tard le soir comptée sur le bon jour', () => {
    expect(localDayKey(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06');
  });
});

describe('séance recommandée', () => {
  const logs = [
    { date: at(5), muscleDistribution: { dos: 4000 } },
    { date: at(1), muscleDistribution: { abdos: 300, jambes: 5000 } },
  ];
  test('jours depuis le dernier travail du groupe', () => {
    expect(daysSinceGroup(logs, 'abdos', NOW)).toBe(5);
    expect(daysSinceGroup(logs, 'dos', NOW)).toBe(1);
    expect(daysSinceGroup(logs, 'bras', NOW)).toBeNull();
  });
  test('raison concrète et bien accordée', () => {
    expect(recommendationReason(logs, 'abdos', NOW)).toBe("Tes abdos n'ont pas été travaillés depuis 5 jours. On rééquilibre.");
    expect(recommendationReason([{ date: at(1), muscleDistribution: { dos: 1 } }].concat(logs.slice(1)), 'dos', new Date(2026, 9, 9))).toBe("Ton dos n'a pas été travaillé depuis 8 jours. On rééquilibre.");
    expect(recommendationReason(logs, 'bras', NOW)).toBe("Tes bras n'ont pas encore été travaillés. On les met au programme.");
    expect(recommendationReason([], 'pectoraux', NOW)).toMatch(/lancer ton programme/);
  });
});

test('salutation selon l\'heure', () => {
  expect(greeting(new Date(2026, 9, 6, 9))).toBe('Bonjour');
  expect(greeting(new Date(2026, 9, 6, 20))).toBe('Bonsoir');
});
