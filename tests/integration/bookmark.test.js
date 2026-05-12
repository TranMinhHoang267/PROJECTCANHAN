const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, candidateToken, jobId;
const suffix = Date.now();

const candidate = {
  id: crypto.randomUUID(),
  email: `bm-candidate-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'BM Candidate',
  role: 'candidate'
};

const recruiter = {
  id: crypto.randomUUID(),
  email: `bm-recruiter-${suffix}@gmail.com`,
  phone: `091${(suffix + 1).toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'BM Recruiter',
  role: 'recruiter'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'bm-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'bm-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'bm-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'bm-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: candidate });
  await prisma.user.create({ data: recruiter });

  const company = await prisma.company.create({
    data: {
      id: crypto.randomUUID(),
      userId: recruiter.id,
      name: 'BM Test Company',
      status: 'approved'
    }
  });

  const job = await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'BM Test Job ' + suffix,
      status: 'approved'
    }
  });
  jobId = job.id;

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: candidate.email, password: 'password123' });
  candidateToken = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Bookmark API', () => {
  test('GET /api/bookmarks - should return empty list', async () => {
    const res = await request(app)
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  test('POST /api/bookmarks/:jobId - should bookmark a job', async () => {
    const res = await request(app)
      .post(`/api/bookmarks/${jobId}`)
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('bookmarked', true);
  });

  test('POST /api/bookmarks/:jobId - should unbookmark on second toggle', async () => {
    const res = await request(app)
      .post(`/api/bookmarks/${jobId}`)
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('bookmarked', false);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/bookmarks');
    expect(res.statusCode).toBe(401);
  });
});
