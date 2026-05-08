const request = require('supertest');
const prisma = require('../../src/config/prisma');

// Mock the jobChat service to avoid LLM/vector dependencies
jest.mock('../../src/services/jobChat.services', () => ({
    chat: jest.fn().mockResolvedValue('Đây là câu trả lời giả lập từ AI.'),
    history: jest.fn().mockResolvedValue([
        {
            id: '123e4567-e89b-12d3-a456-426614174000',
            userId: '123e4567-e89b-12d3-a456-426614174001',
            question: 'Test question',
            answer: 'Test answer',
            createdAt: new Date()
        }
    ])
}));

let app, server, candidateToken;

beforeAll(async () => {
    const module = require('../../server');
    app = module.app || module;
    server = module.server;

    // Get candidate user
    const candidate = await prisma.user.findFirst({ where: { role: 'candidate' } });
    if (candidate) {
        const candidateRes = await request(app)
            .post('/api/auth/login')
            .send({ email: candidate.email, password: 'password123' });
        candidateToken = candidateRes.body.data.accessToken;
    }
});

afterAll(async () => {
    if (server) {
        server.close();
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    await prisma.$disconnect();
});

describe('Job Chat API - POST /api/chat/chat (Candidate Only)', () => {
    test('should return 200 and AI answer for candidate', async () => {
        if (!candidateToken) return;

        const res = await request(app)
            .post('/api/chat/chat')
            .set('Authorization', `Bearer ${candidateToken}`)
            .send({ question: 'Công việc lập trình viên có yêu cầu gì?' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('ans');
    });

    test('should return 401 without token', async () => {
        const res = await request(app)
            .post('/api/chat/chat')
            .send({ question: 'Test question' });

        expect(res.statusCode).toBe(401);
    });

    test('should return error without question', async () => {
        if (!candidateToken) return;

        const res = await request(app)
            .post('/api/chat/chat')
            .set('Authorization', `Bearer ${candidateToken}`)
            .send({});

        // Service will throw error on undefined question
        expect([400, 500]).toContain(res.statusCode);
    });
});

describe('Job Chat API - GET /api/chat-history/chat-history (Candidate Only)', () => {
    test('should return 200 and chat history for candidate', async () => {
        if (!candidateToken) return;

        const res = await request(app)
            .get('/api/chat-history/chat-history')
            .set('Authorization', `Bearer ${candidateToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('history');
    });

    test('should return 401 without token', async () => {
        const res = await request(app)
            .get('/api/chat-history/chat-history');

        expect(res.statusCode).toBe(401);
    });
});
