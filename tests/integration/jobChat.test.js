const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/services/jobChat.services', () => ({
  chat: jest.fn().mockResolvedValue('Đây là câu trả lời giả lập từ AI.'),
  history: jest.fn().mockResolvedValue([
    { id: '00000000-0000-0000-0000-000000000001', userId: '00000000-0000-0000-0000-000000000002', question: 'Test question', answer: 'Test answer', createdAt: new Date() }
  ])
}));

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, candidateToken;
const suffix = Date.now();

const candidate = {
  id: crypto.randomUUID(),
  email: `chat-candidate-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Chat Test Candidate',
  role: 'candidate'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'chat-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'chat-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'chat-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'chat-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: candidate });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: candidate.email, password: 'password123' });
  candidateToken = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Job Chat API - POST /api/chat/chat (Candidate Only)', () => {
  test('should return 200 and AI answer for candidate', async () => {
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

  test('should return 403 for recruiter role', async () => {
    const recruiterUser = {
      id: crypto.randomUUID(),
      email: `chat-recruiter-${Date.now()}@gmail.com`,
      phone: `091${Date.now().toString().slice(-7)}`,
      password: bcrypt.hashSync('password123', 10),
      fullName: 'Chat Recruiter',
      role: 'recruiter'
    };
    await prisma.user.create({ data: recruiterUser });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: recruiterUser.email, password: 'password123' });
    const recruiterToken = loginRes.body.data.accessToken;
    const res = await request(app)
      .post('/api/chat/chat')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ question: 'Test' });
    expect(res.statusCode).toBe(403);
    await prisma.user.delete({ where: { id: recruiterUser.id } });
  });
});

describe('Job Chat API - GET /api/chat-history/chat-history (Candidate Only)', () => {
  test('should return 200 and chat history for candidate', async () => {
    const res = await request(app)
      .get('/api/chat-history/chat-history')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('history');
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/chat-history/chat-history');
    expect(res.statusCode).toBe(401);
  });
});
