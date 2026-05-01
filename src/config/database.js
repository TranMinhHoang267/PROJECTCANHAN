// src/config/prisma.js
const { PrismaClient } = require('../generated/prisma'); // Trỏ đúng vào output bạn đã set

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

module.exports = prisma;