const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, token, resumeId;
const suffix = Date.now();

const testUser = {
  id: crypto.randomUUID(),
  email: `resume-test-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Resume Test User',
  role: 'candidate'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'resume-test-' } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'resume-test-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'resume-test-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: testUser });

  resumeId = crypto.randomUUID();
  await prisma.resume.create({
    data: {
      id: resumeId,
      userId: testUser.id,
      title: 'Test CV',
      fileUrl: '/uploads/resumes/test.pdf',
      isDefault: true
    }
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: 'password123' });
  token = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Resume API', () => {
  test('GET /api/resumes - should return resumes list', async () => {
    const res = await request(app)
      .get('/api/resumes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('PATCH /api/resumes/:id/default - should set CV as default', async () => {
    const res = await request(app)
      .patch(`/api/resumes/${resumeId}/default`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/resumes');
    expect(res.statusCode).toBe(401);
  });
});
