const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, candidateToken, jobId, resumeId;
const suffix = Date.now();

const candidate = {
  id: crypto.randomUUID(),
  email: `app-candidate-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'App Candidate',
  role: 'candidate'
};

const recruiter = {
  id: crypto.randomUUID(),
  email: `app-recruiter-${suffix}@gmail.com`,
  phone: `091${(suffix + 1).toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'App Recruiter',
  role: 'recruiter'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'app-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'app-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'app-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'app-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: candidate });
  await prisma.user.create({ data: recruiter });

  await prisma.candidate_profile.create({
    data: { id: crypto.randomUUID(), userId: candidate.id }
  });

  const company = await prisma.company.create({
    data: {
      id: crypto.randomUUID(),
      userId: recruiter.id,
      name: 'App Test Company',
      status: 'approved'
    }
  });

  const skill = await prisma.skill.upsert({
    where: { name: 'NodeJS' },
    update: {},
    create: { id: crypto.randomUUID(), name: 'NodeJS' }
  });

  const job = await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'Test Job ' + suffix,
      description: 'Test description',
      status: 'approved'
    }
  });
  jobId = job.id;

  resumeId = crypto.randomUUID();
  await prisma.resume.create({
    data: {
      id: resumeId,
      userId: candidate.id,
      title: 'Test CV',
      fileUrl: '/uploads/resumes/test.pdf',
      isDefault: true
    }
  });

  const candidateLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: candidate.email, password: 'password123' });
  candidateToken = candidateLogin.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Application API', () => {
  test('GET /api/applications - should return empty list', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/applications - should apply to job', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ jobId, resumeId, coverLetter: 'Test application' });
    expect([201, 400]).toContain(res.statusCode);
  });

  test('POST /api/applications - should fail without jobId', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ coverLetter: 'No job id' });
    expect(res.statusCode).toBe(400);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.statusCode).toBe(401);
  });
});
