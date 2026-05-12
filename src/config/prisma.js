require('dotenv').config();
const process = require('process');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
}

// Khởi tạo Pool và Adapter
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

/** @type {PrismaClient} */
// @ts-ignore
const prisma = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    global.prisma = prisma;
}

module.exports = prisma;