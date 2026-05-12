const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, token, jobId;
const suffix = Date.now();

const admin = {
  id: crypto.randomUUID(),
  email: `aj-admin-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Admin Job Test',
  role: 'admin'
};

const recruiter = {
  id: crypto.randomUUID(),
  email: `aj-recruiter-${suffix}@gmail.com`,
  phone: `091${(suffix + 1).toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'AJ Recruiter',
  role: 'recruiter'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'aj-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'aj-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'aj-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'aj-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: admin });
  await prisma.user.create({ data: recruiter });

  const company = await prisma.company.create({
    data: { id: crypto.randomUUID(), userId: recruiter.id, name: 'AJ Test Company', status: 'approved' }
  });

  const job = await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'AJ Test Job ' + suffix,
      description: 'Pending review job',
      status: 'pending'
    }
  });
  jobId = job.id;

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password: 'password123' });
  token = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Admin Job API', () => {
  test('GET /api/admin/jobs - should return all jobs', async () => {
    const res = await request(app)
      .get('/api/admin/jobs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/admin/jobs/pending - should return pending jobs', async () => {
    const res = await request(app)
      .get('/api/admin/jobs/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/admin/jobs/:id - should return job detail', async () => {
    const res = await request(app)
      .get(`/api/admin/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('title');
  });

  test('PATCH /api/admin/jobs/:id/review - should approve job', async () => {
    const res = await request(app)
      .patch(`/api/admin/jobs/${jobId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approved' });
    expect(res.statusCode).toBe(200);
  });

  test('PATCH /api/admin/jobs/:id/review - should reject with reason', async () => {
    const newJob = await prisma.job.create({
      data: {
        id: crypto.randomUUID(),
        companyId: (await prisma.company.findFirst({ where: { userId: recruiter.id } })).id,
        title: 'AJ Test Job Reject ' + suffix,
        status: 'pending'
      }
    });
    const res = await request(app)
      .patch(`/api/admin/jobs/${newJob.id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'rejected', reason: 'Invalid content' });
    expect(res.statusCode).toBe(200);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/admin/jobs');
    expect(res.statusCode).toBe(401);
  });
});
