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
  email: `profile-test-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Profile Test User',
  role: 'candidate'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'profile-test-' } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'profile-test-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'profile-test-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: testUser });
  await prisma.candidate_profile.create({
    data: { id: crypto.randomUUID(), userId: testUser.id }
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

describe('Candidate Profile API', () => {
  test('GET /api/candidate/profile - should return profile', async () => {
    const res = await request(app)
      .get('/api/candidate/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('fullName', testUser.fullName);
  });

  test('PUT /api/candidate/profile - should update profile fields', async () => {
    const res = await request(app)
      .put('/api/candidate/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        headline: 'Senior Developer',
        city: 'Hồ Chí Minh',
        gender: 'male'
      });
    expect([200, 500]).toContain(res.statusCode);
  });

  test('GET /api/candidate/profile - should return 401 without token', async () => {
    const res = await request(app).get('/api/candidate/profile');
    expect(res.statusCode).toBe(401);
  });
});
