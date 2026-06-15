// Fausses données de séances injectées uniquement pendant le Chapitre 5 (Stats)
// du tutoriel. Disparaissent dès que le chapitre se termine ou est passé.

function make(daysAgo, name, volume, sets, muscles, xp) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `mock-${daysAgo}-${name.replace(/\s/g, '')}`,
    date: d.toISOString(),
    name,
    exercises: [],
    totalVolume: volume,
    setsCompleted: sets,
    muscleDistribution: muscles,
    durationSeconds: 3600,
    xpEarned: xp,
    notes: '',
    streakAtFinish: 3,
    xpMultiplier: 1.2,
  };
}

export const MOCK_TUTORIAL_LOGS = [
  make(2,  'Push Day A',       3200, 18, { pectoraux: 1800, bras: 900,  epaules: 500 },         245),
  make(4,  'Pull Day A',       2800, 16, { dos: 1800,       bras: 700,  epaules: 300 },          210),
  make(7,  'Legs Day',         4100, 20, { jambes: 3500,    abdos: 600 },                        310),
  make(9,  'Push Day B',       3500, 19, { pectoraux: 2000, bras: 1000, epaules: 500 },          265),
  make(11, 'Full Body',        2900, 22, { pectoraux: 900,  dos: 800,   jambes: 800, bras: 400 },220),
  make(14, 'Pull Day B',       3100, 17, { dos: 2000,       bras: 800,  epaules: 300 },          235),
  make(16, 'Épaules & Bras',   2200, 15, { epaules: 1200,  bras: 1000 },                        168),
  make(18, 'Legs Power',       4800, 21, { jambes: 4200,    abdos: 600 },                        365),
  make(21, 'Push Day C',       3800, 20, { pectoraux: 2200, bras: 1100, epaules: 500 },          290),
  make(23, 'Pull Day C',       3300, 18, { dos: 2100,       bras: 900,  epaules: 300 },          252),
  make(26, 'Full Body B',      3200, 24, { pectoraux: 800,  dos: 900,   jambes: 900, bras: 600 },245),
  make(30, 'Push Day D',       4100, 21, { pectoraux: 2400, bras: 1200, epaules: 500 },          312),
  make(35, 'Pull Day D',       3600, 19, { dos: 2300,       bras: 1000, epaules: 300 },          274),
  make(40, 'Legs Day B',       5200, 22, { jambes: 4600,    abdos: 600 },                        396),
  make(45, 'Push Day E',       3900, 20, { pectoraux: 2200, bras: 1100, epaules: 600 },          297),
  make(50, 'Épaules Isolées',  2600, 16, { epaules: 1600,  bras: 1000 },                        198),
  make(55, 'Legs Day C',       4900, 23, { jambes: 4300,    abdos: 600 },                        373),
  make(60, 'Full Body C',      3500, 26, { pectoraux: 900,  dos: 1000,  jambes: 1000, bras: 600},267),
  make(70, 'Pull Day E',       3800, 20, { dos: 2500,       bras: 1000, epaules: 300 },          290),
  make(80, 'Push Day F',       4200, 22, { pectoraux: 2500, bras: 1200, epaules: 500 },          320),
];
