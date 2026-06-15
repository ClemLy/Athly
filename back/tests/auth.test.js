const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User.js');

// Connexion à la base de données avant les tests
beforeAll(async () => {
    // Vérification de la connexion
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI);
    }
});

// Nettoyage de la collection Users après chaque test pour éviter les conflits
afterEach(async () => {
    await User.deleteMany();
});

// Fermeture de la connexion à la base de données après tous les tests
afterAll(async () => {
    await mongoose.connection.close();
});

describe('Flux Authentification Athly', () => {
    
    const mockUser = {
        pseudo: 'Testeur Athly',
        email: 'testeur@athly.fr',
        password: 'Password123!'
    };

    it('devrait créer un nouvel utilisateur (POST /auth/register)', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(mockUser);

        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toBe(true);
        // L'API register renvoie { success, message, email } — pas d'objet user imbriqué
        expect(res.body).toHaveProperty('email', mockUser.email.toLowerCase());
    });

    it('devrait connecter l\'utilisateur et renvoyer un token (POST /auth/login)', async () => {
        // 1. Création et vérification directe en DB (bypass email OTP pour les tests)
        await request(app).post('/api/auth/register').send(mockUser);
        await User.updateOne({ email: mockUser.email }, { isVerified: true });

        // 2. Tentative de connexion avec les mêmes identifiants
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: mockUser.email, password: mockUser.password });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token');
    });

    it('devrait refuser l\'accès au profil sans token (GET /api/users/me)', async () => {
        const res = await request(app).get('/api/users/me');
        expect(res.statusCode).toEqual(401);
    });
});