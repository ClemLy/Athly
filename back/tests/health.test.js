const request = require('supertest');
const app = require('../app');

describe('GET /health', () => {
  it('devrait retourner un statut 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'OK');
  });
});