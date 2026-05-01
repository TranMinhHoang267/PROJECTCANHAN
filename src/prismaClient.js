require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
}

const adapter = new PrismaPg({
    connectionString
});

const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
