const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, token, companyId;
const suffix = Date.now();

const admin = {
  id: crypto.randomUUID(),
  email: `ac-admin-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Admin Company Test',
  role: 'admin'
};

const recruiter = {
  id: crypto.randomUUID(),
  email: `ac-recruiter-${suffix}@gmail.com`,
  phone: `091${(suffix + 1).toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'AC Recruiter',
  role: 'recruiter'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'ac-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'ac-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'ac-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'ac-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: admin });
  await prisma.user.create({ data: recruiter });

  const company = await prisma.company.create({
    data: {
      id: crypto.randomUUID(),
      userId: recruiter.id,
      name: 'AC Test Company',
      status: 'pending'
    }
  });
  companyId = company.id;

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password: 'password123' });
  token = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Admin Company API', () => {
  test('GET /api/admin/companies - should return companies', async () => {
    const res = await request(app)
      .get('/api/admin/companies')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/admin/companies/pending - should return pending companies', async () => {
    const res = await request(app)
      .get('/api/admin/companies/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  test('PATCH /api/admin/companies/:id/review - should approve company', async () => {
    const res = await request(app)
      .patch(`/api/admin/companies/${companyId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approved' });
    expect(res.statusCode).toBe(200);
  });

  test('PATCH /api/admin/companies/:id/review - should reject missing action', async () => {
    const res = await request(app)
      .patch(`/api/admin/companies/${companyId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.statusCode).toBe(400);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/admin/companies');
    expect(res.statusCode).toBe(401);
  });
});
