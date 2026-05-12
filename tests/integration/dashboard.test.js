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
  email: `dash-recruiter-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Dashboard Recruiter',
  role: 'recruiter'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'dash-recruiter-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'dash-recruiter-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'dash-recruiter-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'dash-recruiter-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: recruiter });

  const company = await prisma.company.create({
    data: { id: crypto.randomUUID(), userId: recruiter.id, name: 'Dash Test Company', status: 'approved' }
  });

  const job = await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'Dash Test Job ' + suffix,
      status: 'approved'
    }
  });

  await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'Dash Pending Job ' + suffix,
      status: 'pending'
    }
  });

  await prisma.application.create({
    data: {
      id: crypto.randomUUID(),
      jobId: job.id,
      userId: recruiter.id,
      companyId: company.id,
      fullName: 'Test Applicant',
      email: 'test@app.com',
      phone: '0900000000',
      resumeUrl: '/uploads/resumes/test.pdf',
      status: 'submitted'
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

describe('Dashboard API', () => {
  test('GET /api/employer/dashboard - should return dashboard stats', async () => {
    const res = await request(app)
      .get('/api/employer/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('jobs');
    expect(res.body.data).toHaveProperty('applications');
    expect(res.body.data.jobs.total).toBeGreaterThanOrEqual(2);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/employer/dashboard');
    expect(res.statusCode).toBe(401);
  });
});
