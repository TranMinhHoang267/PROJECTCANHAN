const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server;
const suffix = Date.now();

const testUser = {
  id: crypto.randomUUID(),
  email: `auth-test-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Auth Test User',
  role: 'candidate'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'auth-test-' } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'auth-test-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'auth-test-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;
  await prisma.user.create({ data: testUser });
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Auth API', () => {
  test('POST /api/auth/login - should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data.accessToken');
  });

  test('POST /api/auth/login - should fail with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpass' });
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/auth/register - should register new candidate', async () => {
    const uniqueEmail = `authreg${Date.now()}@gmail.com`;
    const uniquePhone = `091${Date.now().toString().slice(-7)}`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Registered User',
        email: uniqueEmail,
        phone: uniquePhone,
        password: 'password123'
      });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body.data).toHaveProperty('accessToken');
    await prisma.user.deleteMany({ where: { email: uniqueEmail } });
  });

  test('POST /api/auth/refresh-token - should refresh access token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'password123' });
    const refreshToken = loginRes.body.data.refreshToken;
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  test('POST /api/auth/logout - should logout', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'password123' });
    const token = loginRes.body.data.accessToken;
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });
});
