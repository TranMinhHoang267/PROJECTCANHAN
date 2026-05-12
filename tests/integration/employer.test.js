const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, token;
const suffix = Date.now();

const recruiter = {
  id: crypto.randomUUID(),
  email: `emp-recruiter-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Employer Test Recruiter',
  role: 'recruiter'
};

let companyId;

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'emp-recruiter-' } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'emp-recruiter-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'emp-recruiter-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: recruiter });

  companyId = crypto.randomUUID();
  await prisma.company.create({
    data: {
      id: companyId,
      userId: recruiter.id,
      name: 'Employer Test Company',
      description: 'A test company',
      website: 'https://test.com',
      address: '123 Test St',
      city: 'HCM',
      size: '50-100',
      status: 'approved'
    }
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: recruiter.email, password: 'password123' });
  token = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Employer API', () => {
  test('GET /api/employer/profile - should return company profile', async () => {
    const res = await request(app)
      .get('/api/employer/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('name', 'Employer Test Company');
  });

  test('PUT /api/employer/profile - should update company profile', async () => {
    const res = await request(app)
      .put('/api/employer/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated description', city: 'Hà Nội' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.city).toBe('Hà Nội');
  });

  test('GET /api/employer/profile - should return 401 without token', async () => {
    const res = await request(app).get('/api/employer/profile');
    expect(res.statusCode).toBe(401);
  });
});
