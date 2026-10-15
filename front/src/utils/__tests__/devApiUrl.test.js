const { resolveDevApiUrl } = require('../devApiUrl');

describe('resolveDevApiUrl', () => {
  it("remplace une IP locale périmée par l'adresse actuelle du Mac", () => {
    expect(resolveDevApiUrl('http://192.168.1.17:4000/api', '192.168.1.21')).toBe('http://192.168.1.21:4000/api');
    expect(resolveDevApiUrl('http://localhost:4000/api', '192.168.1.21')).toBe('http://192.168.1.21:4000/api');
  });

  it('laisse une API distante intacte', () => {
    expect(resolveDevApiUrl('https://athly-api.onrender.com/api', '192.168.1.21')).toBe('https://athly-api.onrender.com/api');
  });

  it("ne change rien sans hôte de développement ou sans URL", () => {
    expect(resolveDevApiUrl('http://192.168.1.17:4000/api', null)).toBe('http://192.168.1.17:4000/api');
    expect(resolveDevApiUrl('', '192.168.1.21')).toBe('');
  });
});
