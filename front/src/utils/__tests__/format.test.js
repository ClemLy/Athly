import { formatWeight, formatNumber, plural, pluralWord } from '../format';

// Intl insère une espace insécable (fine) entre les milliers : on la normalise
const norm = (s) => s.replace(/[  ]/g, ' ');

describe('formatWeight', () => {
  it('affiche les kilos sous 10 tonnes', () => {
    expect(norm(formatWeight(850))).toBe('850 kg');
    expect(norm(formatWeight(9850))).toBe('9 850 kg');
  });

  it('passe en tonnes au-delà, pour tenir dans les petites cartes', () => {
    expect(formatWeight(13300)).toBe('13,3 t');
    expect(norm(formatWeight(1250000))).toBe('1 250 t');
  });

  it('résiste aux valeurs absentes', () => {
    expect(formatWeight(undefined)).toBe('0 kg');
  });
});

describe('formatNumber', () => {
  it('arrondit et sépare les milliers', () => {
    expect(norm(formatNumber(12499.6))).toBe('12 500');
  });
});

describe('plural', () => {
  it('accorde au singulier pour 0 et 1', () => {
    expect(plural(1, 'jour')).toBe('1 jour');
    expect(plural(0, 'jour')).toBe('0 jour');
  });

  it('accorde au pluriel à partir de 2', () => {
    expect(plural(3, 'jour')).toBe('3 jours');
    expect(pluralWord(2, 'série validée', 'séries validées')).toBe('séries validées');
  });
});
