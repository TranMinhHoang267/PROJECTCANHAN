const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, jobId, companyId;
const suffix = Date.now();

const recruiter = {
  id: crypto.randomUUID(),
  email: `pub-recruiter-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Public Recruiter',
  role: 'recruiter'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { company: { user: { email: { startsWith: 'pub-recruiter-' } } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'pub-recruiter-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'pub-recruiter-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'pub-recruiter-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: recruiter });

  companyId = crypto.randomUUID();
  await prisma.company.create({
    data: {
      id: companyId,
      userId: recruiter.id,
      name: 'Public Test Company',
      description: 'A public test company',
      website: 'https://public-test.com',
      city: 'HCM',
      status: 'approved'
    }
  });

  const job = await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: companyId,
      title: 'Public Job ' + suffix,
      description: 'Public job description',
      status: 'approved'
    }
  });
  jobId = job.id;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Public API', () => {
  test('GET /api/public/jobs/:id - should return approved job', async () => {
    const res = await request(app).get(`/api/public/jobs/${jobId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('title', 'Public Job ' + suffix);
  });

  test('GET /api/public/companies/:id - should return approved company', async () => {
    const res = await request(app).get(`/api/public/companies/${companyId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.company).toHaveProperty('name', 'Public Test Company');
  });

  test('GET /api/public/jobs/:id - should return 404 for non-existent job', async () => {
    const res = await request(app).get(`/api/public/jobs/${crypto.randomUUID()}`);
    expect(res.statusCode).toBe(404);
  });

  test('GET /api/public/companies/:id - should return 404 for non-existent company', async () => {
    const res = await request(app).get(`/api/public/companies/${crypto.randomUUID()}`);
    expect(res.statusCode).toBe(404);
  });
});
