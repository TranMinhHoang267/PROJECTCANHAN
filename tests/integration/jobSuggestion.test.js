const request = require('supertest');
const prisma = require('../../src/config/prisma');
let app, server, token;

beforeAll(async () => {
    const module = require('../../server');
    app = module.app;
    server = module.server;

    const user = await prisma.user.findFirst({ where: { role: 'candidate' } });
    if (user) {
        const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
        token = res.body.data.accessToken;
    }
});

afterAll(async () => {
    if (server) {
        server.close();
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    await prisma.$disconnect();
});

describe('Job Suggestion API', () => {
    test('GET /api/suggestions - should return suggestions for candidate', async () => {
        if (!token) return;
        const res = await request(app).get('/api/suggestions').set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'success');
    });

    test('GET /api/suggestions - should return 401 without token', async () => {
        const res = await request(app).get('/api/suggestions');
        expect(res.statusCode).toBe(401);
    });

    test('GET /api/suggestions?limit=5 - should respect limit parameter', async () => {
        if (!token) return;
        const res = await request(app).get('/api/suggestions?limit=5').set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.count).toBeLessThanOrEqual(5);
    });
});
