const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, token;
const suffix = Date.now();

const admin = {
  id: crypto.randomUUID(),
  email: `ar-admin-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Admin Report Test',
  role: 'admin'
};

const recruiter = {
  id: crypto.randomUUID(),
  email: `ar-recruiter-${suffix}@gmail.com`,
  phone: `091${(suffix + 1).toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'AR Recruiter',
  role: 'recruiter'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'ar-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'ar-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'ar-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'ar-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: admin });
  await prisma.user.create({ data: recruiter });

  const company = await prisma.company.create({
    data: { id: crypto.randomUUID(), userId: recruiter.id, name: 'AR Test Company', status: 'approved' }
  });

  await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'AR Test Job ' + suffix,
      status: 'approved',
      jobType: 'Full-time',
      jobLevel: 'Junior'
    }
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password: 'password123' });
  token = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Admin Report API', () => {
  test('GET /api/admin/reports/overview - should return stats', async () => {
    const res = await request(app)
      .get('/api/admin/reports/overview')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('users');
    expect(res.body.data).toHaveProperty('jobs');
  });

  test('GET /api/admin/reports/users/growth - should return growth data', async () => {
    const res = await request(app)
      .get('/api/admin/reports/users/growth')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/admin/reports/applications/monthly - should return monthly data', async () => {
    const res = await request(app)
      .get('/api/admin/reports/applications/monthly')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/admin/reports/jobs/by-type - should return jobs by type', async () => {
    const res = await request(app)
      .get('/api/admin/reports/jobs/by-type')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/admin/reports/jobs/by-level - should return jobs by level', async () => {
    const res = await request(app)
      .get('/api/admin/reports/jobs/by-level')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/admin/reports/overview');
    expect(res.statusCode).toBe(401);
  });
});
