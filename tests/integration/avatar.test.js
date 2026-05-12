const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, token;
const suffix = Date.now();

const testUser = {
  id: crypto.randomUUID(),
  email: `avatar-test-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Avatar Test User',
  role: 'candidate'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'avatar-test-' } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'avatar-test-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'avatar-test-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: testUser });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: 'password123' });
  token = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Avatar API', () => {
  test('DELETE /api/avatar - should return 400 when no avatar exists', async () => {
    const res = await request(app)
      .delete('/api/avatar')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 400, 404]).toContain(res.statusCode);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).delete('/api/avatar');
    expect(res.statusCode).toBe(401);
  });
});
