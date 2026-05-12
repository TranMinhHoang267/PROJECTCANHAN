const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server;
const suffix = Date.now();

const recruiter = {
  id: crypto.randomUUID(),
  email: `search-recruiter-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Search Recruiter',
  role: 'recruiter'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'search-recruiter-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'search-recruiter-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'search-recruiter-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'search-recruiter-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: recruiter });

  const company = await prisma.company.create({
    data: { id: crypto.randomUUID(), userId: recruiter.id, name: 'Search Test Company', status: 'approved' }
  });

  await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'NodeJS Developer ' + suffix,
      description: 'Looking for NodeJS developer',
      location: 'Hồ Chí Minh',
      jobType: 'Full-time',
      jobLevel: 'Junior',
      salaryMin: 1000,
      salaryMax: 2000,
      status: 'approved'
    }
  });

  await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'Python Developer ' + suffix,
      description: 'Looking for Python developer',
      location: 'Hà Nội',
      jobType: 'Part-time',
      jobLevel: 'Senior',
      salaryMin: 2000,
      salaryMax: 4000,
      status: 'approved'
    }
  });
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Search Jobs API - GET /api/search-jobs/search-jobs', () => {
  test('should return 200 and job list without filters', async () => {
    const res = await request(app).get('/api/search-jobs/search-jobs');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
    expect(res.body.data).toHaveProperty('jobs');
    expect(res.body.data.jobs.length).toBeGreaterThanOrEqual(2);
  });

  test('should return 200 with keyword filter', async () => {
    const res = await request(app)
      .get('/api/search-jobs/search-jobs')
      .query({ keyword: 'NodeJS' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
  });

  test('should return 200 with location filter', async () => {
    const res = await request(app)
      .get('/api/search-jobs/search-jobs')
      .query({ location: 'Hồ Chí Minh' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
  });

  test('should return 200 with jobType filter', async () => {
    const res = await request(app)
      .get('/api/search-jobs/search-jobs')
      .query({ jobType: 'Full-time' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
  });

  test('should return 200 with pagination', async () => {
    const res = await request(app)
      .get('/api/search-jobs/search-jobs')
      .query({ page: 1, limit: 5 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('current_page', 1);
    expect(res.body.data.jobs.length).toBeLessThanOrEqual(5);
  });

  test('should return 200 with salary filter', async () => {
    const res = await request(app)
      .get('/api/search-jobs/search-jobs')
      .query({ salary: 1500 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
  });
});
