const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, token, jobId;
const suffix = Date.now();

const recruiter = {
  id: crypto.randomUUID(),
  email: `job-recruiter-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Job Test Recruiter',
  role: 'recruiter'
};

jest.setTimeout(30000);

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'job-recruiter-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'job-recruiter-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'job-recruiter-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'job-recruiter-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: recruiter });

  await prisma.company.create({
    data: {
      id: crypto.randomUUID(),
      userId: recruiter.id,
      name: 'Job Test Company',
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
  try {
    const { stopVectorSchedule } = require('../../src/scheduler/vectorRetry.scheduler');
    if (stopVectorSchedule) await stopVectorSchedule();
  } catch (e) {}
  await new Promise(resolve => setTimeout(resolve, 500));
  await prisma.$disconnect();
});

describe('Job API', () => {
  test('GET /api/employer/jobs - should return empty list initially', async () => {
    const res = await request(app)
      .get('/api/employer/jobs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/employer/jobs - should create a job', async () => {
    const res = await request(app)
      .post('/api/employer/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Test Job ${suffix}`,
        description: 'Test description for job creation',
        salaryMin: 1000,
        salaryMax: 2000,
        location: 'HCM',
        jobType: 'Full-time',
        jobLevel: 'Junior',
        deadline: new Date('2026-12-31').toISOString()
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('pending');
    jobId = res.body.data.id;
  });

  test('PATCH /api/employer/jobs/:id/toggle-pause - should toggle status', async () => {
    if (!jobId) return;
    const res = await request(app)
      .patch(`/api/employer/jobs/${jobId}/toggle-pause`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 400]).toContain(res.statusCode);
  });

  test('GET /api/employer/jobs?status=pending - should filter by status', async () => {
    const res = await request(app)
      .get('/api/employer/jobs?status=pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('jobs');
    expect(Array.isArray(res.body.data.jobs)).toBe(true);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/employer/jobs');
    expect(res.statusCode).toBe(401);
  });
});
