const { faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');
const prisma = require('../../src/config/prisma');

const seedUsers = async () => {
    // Cleanup in correct order (children first)
    await prisma.bookmark.deleteMany();
    await prisma.application.deleteMany();
    await prisma.resume.deleteMany();
    await prisma.candidate_skill.deleteMany();
    await prisma.education.deleteMany();
    await prisma.experience.deleteMany();
    await prisma.candidate_profile.deleteMany();
    await prisma.job_skill.deleteMany();
    await prisma.job.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();

    const users = [];
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create 5 Candidates
    for (let i = 0; i < 5; i++) {
        const user = await prisma.user.create({
            data: {
                email: faker.internet.email().toLowerCase(),
                password: hashedPassword,
                fullName: faker.person.fullName(),
                phone: faker.phone.number('090#######'),
                role: 'candidate',
                avatarUrl: faker.datatype.boolean() ? faker.image.avatar() : null,
                isActive: faker.datatype.boolean()
            }
        });
        users.push(user);
    }

    // Create 5 Recruiters
    for (let i = 0; i < 5; i++) {
        const user = await prisma.user.create({
            data: {
                email: faker.internet.email().toLowerCase(),
                password: hashedPassword,
                fullName: faker.person.fullName(),
                phone: faker.phone.number('090#######'),
                role: 'recruiter',
                avatarUrl: faker.datatype.boolean() ? faker.image.avatar() : null,
                isActive: true
            }
        });
        users.push(user);
    }

    // Create 5 Admins
    for (let i = 0; i < 5; i++) {
        const user = await prisma.user.create({
            data: {
                email: faker.internet.email().toLowerCase(),
                password: hashedPassword,
                fullName: faker.person.fullName(),
                phone: faker.phone.number('090#######'),
                role: 'admin',
                isActive: true
            }
        });
        users.push(user);
    }

    console.log(`✅ Created ${users.length} users (5 candidates, 5 recruiters, 5 admins)`);
    return users;
};

module.exports = { seedUsers };
