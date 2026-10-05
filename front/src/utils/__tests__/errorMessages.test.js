import {
  describeApiError,
  getErrorMessage,
  NETWORK_ERROR_MSG,
  TIMEOUT_ERROR_MSG,
  GENERIC_ERROR_MSG,
} from '../errorMessages';

const httpError = (status, data) => ({ response: { status, data } });

describe('describeApiError', () => {
  it("garde le message du serveur quand il est rédigé pour l'utilisateur", () => {
    expect(describeApiError(httpError(409, { message: 'Un compte existe déjà avec cette adresse email.' })))
      .toBe('Un compte existe déjà avec cette adresse email.');
  });

  it("n'affiche jamais un message technique brut", () => {
    const msg = describeApiError(httpError(400, { message: 'Request failed with status code 400' }));
    expect(msg).not.toMatch(/status code/i);
  });

  it('remplace toujours le message des erreurs serveur (5xx)', () => {
    const msg = describeApiError(httpError(500, { message: 'Cannot read properties of undefined' }));
    expect(msg).toMatch(/serveur/i);
    expect(msg).not.toMatch(/undefined/);
  });

  it('explique une absence de réseau', () => {
    expect(describeApiError({ request: {}, message: 'Network Error' })).toBe(NETWORK_ERROR_MSG);
  });

  it("explique un délai d'attente dépassé (serveur qui démarre)", () => {
    expect(describeApiError({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' })).toBe(TIMEOUT_ERROR_MSG);
  });

  it('donne un message clair pour une limite de tentatives', () => {
    expect(describeApiError(httpError(429, {}))).toMatch(/Patiente/);
  });
});

describe('getErrorMessage', () => {
  it('utilise le message lisible posé par le client API', () => {
    expect(getErrorMessage({ userMessage: 'Ce code a expiré.' }, 'fallback')).toBe('Ce code a expiré.');
  });

  it('retombe sur le message contextuel pour une erreur JavaScript interne', () => {
    expect(getErrorMessage(new Error('no_id'), 'La séance n\'a pas pu être enregistrée.'))
      .toBe('La séance n\'a pas pu être enregistrée.');
  });

  it('a un message par défaut', () => {
    expect(getErrorMessage(undefined)).toBe(GENERIC_ERROR_MSG);
  });
});
