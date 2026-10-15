const {
  formatClock, breathPhaseAt, guidedStepAt, readableOn,
} = require('../ritualTimer');

describe('formatClock', () => {
  it('formate en mm:ss en arrondissant à la seconde supérieure', () => {
    expect(formatClock(300)).toBe('05:00');
    expect(formatClock(59.2)).toBe('01:00');
    expect(formatClock(0.4)).toBe('00:01');
    expect(formatClock(-3)).toBe('00:00');
  });
});

describe('breathPhaseAt', () => {
  it('commence par 4 s d\'inspiration', () => {
    expect(breathPhaseAt(0)).toMatchObject({ inhale: true, phaseLeft: 4, cycle: 1 });
    expect(breathPhaseAt(3.5)).toMatchObject({ inhale: true, phaseLeft: 1 });
  });

  it('enchaîne 6 s d\'expiration puis un nouveau cycle', () => {
    expect(breathPhaseAt(4)).toMatchObject({ inhale: false, phaseLeft: 6, cycle: 1 });
    expect(breathPhaseAt(9.9)).toMatchObject({ inhale: false, phaseLeft: 1 });
    expect(breathPhaseAt(10)).toMatchObject({ inhale: true, cycle: 2 });
  });

  it('donne une clé différente à chaque phase', () => {
    const keys = [0, 4, 10, 14].map((t) => breathPhaseAt(t).phaseKey);
    expect(new Set(keys).size).toBe(4);
  });
});

describe('guidedStepAt', () => {
  it('découpe la durée en étapes égales', () => {
    expect(guidedStepAt(0, 5, 300)).toMatchObject({ index: 0, stepLeft: 60 });
    expect(guidedStepAt(61, 5, 300)).toMatchObject({ index: 1, stepLeft: 59 });
  });

  it('reste sur la dernière étape une fois le temps écoulé', () => {
    expect(guidedStepAt(300, 5, 300)).toMatchObject({ index: 4, stepLeft: 0 });
    expect(guidedStepAt(999, 5, 300).index).toBe(4);
  });
});

describe('readableOn', () => {
  it('choisit un texte sombre sur les couleurs claires', () => {
    expect(readableOn('#22C55E')).toBe('#0B0B12');
    expect(readableOn('#F59E0B')).toBe('#0B0B12');
  });

  it('choisit un texte blanc sur les couleurs sombres', () => {
    expect(readableOn('#3D0000')).toBe('#FFFFFF');
    expect(readableOn('pas une couleur')).toBe('#FFFFFF');
  });
});
