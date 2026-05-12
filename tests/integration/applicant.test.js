const request = require('supertest');
const prisma = require('../../src/config/prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

let app, server, recruiterToken, applicationId, jobId;
const suffix = Date.now();

const recruiter = {
  id: crypto.randomUUID(),
  email: `appl-recruiter-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Applicant Recruiter',
  role: 'recruiter'
};

const candidate = {
  id: crypto.randomUUID(),
  email: `appl-candidate-${suffix}@gmail.com`,
  phone: `091${(suffix + 1).toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Applicant Candidate',
  role: 'candidate'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'appl-' } } } });
  await prisma.application.deleteMany({ where: { job: { company: { user: { email: { startsWith: 'appl-' } } } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'appl-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'appl-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: recruiter });
  await prisma.user.create({ data: candidate });

  await prisma.candidate_profile.create({
    data: { id: crypto.randomUUID(), userId: candidate.id }
  });

  const company = await prisma.company.create({
    data: { id: crypto.randomUUID(), userId: recruiter.id, name: 'Appl Test Company', status: 'approved' }
  });

  const job = await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      companyId: company.id,
      title: 'Appl Test Job ' + suffix,
      description: 'Test job for applicants',
      status: 'approved'
    }
  });
  jobId = job.id;

  const appRecord = await prisma.application.create({
    data: {
      id: crypto.randomUUID(),
      jobId: job.id,
      userId: candidate.id,
      companyId: company.id,
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone,
      resumeUrl: '/uploads/resumes/test.pdf',
      status: 'submitted'
    }
  });
  applicationId = appRecord.id;

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: recruiter.email, password: 'password123' });
  recruiterToken = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Applicant API', () => {
  test('GET /api/employer/applicants - should return applicants', async () => {
    const res = await request(app)
      .get('/api/employer/applicants')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.applications.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/employer/applicants/:id - should return detail', async () => {
    const res = await request(app)
      .get(`/api/employer/applicants/${applicationId}`)
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('status', 'submitted');
  });

  test('PATCH /api/employer/applicants/:id/status - should update status', async () => {
    const res = await request(app)
      .patch(`/api/employer/applicants/${applicationId}/status`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ status: 'under_review' });
    expect(res.statusCode).toBe(200);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/employer/applicants');
    expect(res.statusCode).toBe(401);
  });
});
