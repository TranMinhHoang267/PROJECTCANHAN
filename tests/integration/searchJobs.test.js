const request = require('supertest');
const prisma = require('../../src/config/prisma');

let app, server;

beforeAll(async () => {
    const module = require('../../server');
    app = module.app;
    server = module.server;
});

afterAll(async () => {
    if (server) server.close();
    await prisma.$disconnect();
});

describe('Search Jobs API - GET /api/search-jobs/search-jobs', () => {
    test('should return 200 and job list without filters', async () => {
        const res = await request(app)
            .get('/api/search-jobs/search-jobs');

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'success');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('jobs');
    });

    test('should return 200 with keyword filter', async () => {
        const res = await request(app)
            .get('/api/search-jobs/search-jobs')
            .query({ keyword: 'JavaScript' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'success');
    });

    test('should return 200 with location filter', async () => {
        const res = await request(app)
            .get('/api/search-jobs/search-jobs')
            .query({ location: 'Hanoi' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'success');
    });

    test('should return 200 with jobType filter', async () => {
        const res = await request(app)
            .get('/api/search-jobs/search-jobs')
            .query({ jobType: 'FULL_TIME' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'success');
    });

    test('should return 200 with pagination', async () => {
        const res = await request(app)
            .get('/api/search-jobs/search-jobs')
            .query({ page: 1, limit: 5 });

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveProperty('current_page', 1);
        expect(res.body.data.jobs.length).toBeLessThanOrEqual(5);
    });

    test('should return 200 with combined filters', async () => {
        const res = await request(app)
            .get('/api/search-jobs/search-jobs')
            .query({ keyword: 'Developer', location: 'HCMC', jobType: 'FULL_TIME', page: 1, limit: 10 });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'success');
    });

    test('should return 200 with salary filter', async () => {
        const res = await request(app)
            .get('/api/search-jobs/search-jobs')
            .query({ salary: 1000 });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'success');
    });
});
