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
  email: `admin-test-${suffix}@gmail.com`,
  phone: `090${suffix.toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Admin Test User',
  role: 'admin'
};

const regularUser = {
  id: crypto.randomUUID(),
  email: `admin-regular-${suffix}@gmail.com`,
  phone: `091${(suffix + 1).toString().slice(-7)}`,
  password: bcrypt.hashSync('password123', 10),
  fullName: 'Regular User For Admin',
  role: 'candidate'
};

beforeAll(async () => {
  await prisma.application.deleteMany({ where: { user: { email: { startsWith: 'admin-' } } } });
  await prisma.job.deleteMany({ where: { company: { user: { email: { startsWith: 'admin-' } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'admin-' } } });
  const mod = require('../../server');
  app = mod.app;
  server = mod.server;

  await prisma.user.create({ data: admin });
  await prisma.user.create({ data: regularUser });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password: 'password123' });
  token = loginRes.body.data.accessToken;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect();
});

describe('Admin User API', () => {
  test('GET /api/admin/users - should return users list', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(2);
  });

  test('GET /api/admin/users?role=candidate - should filter by role', async () => {
    const res = await request(app)
      .get('/api/admin/users?role=candidate')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    res.body.data.users.forEach(u => expect(u.role).toBe('candidate'));
  });

  test('PATCH /api/admin/users/:id/toggle-lock - should toggle user lock', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${regularUser.id}/toggle-lock`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('isActive');
  });

  test('DELETE /api/admin/users/:id - should delete regular user', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${regularUser.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.statusCode).toBe(401);
  });
});
