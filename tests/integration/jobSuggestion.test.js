const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, token;
const suffix = Date.now();

const candidate = {
  id: crypto.randomUUID(),
  email: `js-candidate-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'JS Candidate',
  role: 'candidate'
};

const recruiter = {
  id: crypto.randomUUID(),
  email: `js-recruiter-${suffix}@gmail.com`,
  phone: `091${(suffix + 1).toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'JS Recruiter',
  role: 'recruiter'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'js-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'js-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'js-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'js-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: candidate });
  await prisma.user.create({ data: recruiter });

  await prisma.candidate_profile.create({
    data: { id: crypto.randomUUID(), userId: candidate.id }
  });

  const skill = await prisma.skill.upsert({
    where: { name: 'NodeJS' },
    update: {},
    create: { id: crypto.randomUUID(), name: 'NodeJS' }
  });

  const company = await prisma.company.create({
    data: { id: crypto.randomUUID(), userId: recruiter.id, name: 'JS Test Company', status: 'approved' }
  });

  const job = await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'JS Suggestion Job ' + suffix,
      status: 'approved'
    }
  });

  await prisma.job_skill.create({
    data: { jobId: job.id, skillId: skill.id }
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: candidate.email, password: 'password123' });
  token = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Job Suggestion API', () => {
  test('GET /api/suggestions - should return suggestions for candidate', async () => {
    const res = await request(app)
      .get('/api/suggestions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
  });

  test('GET /api/suggestions - should return 401 without token', async () => {
    const res = await request(app).get('/api/suggestions');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/suggestions?limit=5 - should respect limit', async () => {
    const res = await request(app)
      .get('/api/suggestions?limit=5')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeLessThanOrEqual(5);
  });
});
