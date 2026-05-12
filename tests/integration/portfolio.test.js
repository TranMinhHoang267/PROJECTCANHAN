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
  email: `portfolio-test-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Portfolio Test User',
  role: 'candidate'
};

let profileId;

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'portfolio-test-' } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'portfolio-test-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'portfolio-test-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: testUser });
  profileId = crypto.randomUUID();
  await prisma.candidate_profile.create({
    data: { id: profileId, userId: testUser.id }
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

describe('Portfolio API', () => {
  test('GET /api/portfolio/experiences - should return empty list', async () => {
    const res = await request(app)
      .get('/api/portfolio/experiences')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/portfolio/experiences - should create experience', async () => {
    const res = await request(app)
      .post('/api/portfolio/experiences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company: 'Test Corp',
        title: 'Developer',
        startDate: new Date('2024-01-01').toISOString(),
        description: 'Test description'
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('id');
  });

  test('GET /api/portfolio/educations - should return empty list', async () => {
    const res = await request(app)
      .get('/api/portfolio/educations')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/portfolio/educations - should create education', async () => {
    const res = await request(app)
      .post('/api/portfolio/educations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        school: 'Đại học Test',
        degree: 'Cử nhân',
        field: 'CNTT',
        startDate: new Date('2020-01-01').toISOString()
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('id');
  });

  test('GET /api/portfolio/skills - should return empty list', async () => {
    const res = await request(app)
      .get('/api/portfolio/skills')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('PUT /api/portfolio/skills - should update skills', async () => {
    const res = await request(app)
      .put('/api/portfolio/skills')
      .set('Authorization', `Bearer ${token}`)
      .send({ skills: ['JavaScript', 'Node.js'] });
    expect(res.statusCode).toBe(200);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/portfolio/experiences');
    expect(res.statusCode).toBe(401);
  });
});
