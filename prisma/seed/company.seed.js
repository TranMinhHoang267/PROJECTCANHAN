const { faker } = require('@faker-js/faker');
const prisma = require('../../src/config/prisma');

const seedCompanies = async (users) => {
    const recruiters = users.filter(u => u.role === 'recruiter');
    const companies = [];
    const jobs = [];
    const jobSkills = [];

    // Create companies for each recruiter
    for (const user of recruiters) {
        const company = await prisma.company.create({
            data: {
                userId: user.id,
                name: faker.company.name(),
                description: faker.datatype.boolean() ? faker.lorem.paragraph() : null,
                website: faker.datatype.boolean() ? faker.internet.url() : null,
                logoUrl: faker.datatype.boolean() ? faker.image.url() : null,
                address: faker.datatype.boolean() ? faker.location.streetAddress() : null,
                city: faker.datatype.boolean() ? faker.location.city() : null,
                size: faker.helpers.arrayElement(['1-50', '50-100', '100-500', '500+']),
                status: faker.helpers.arrayElement(['pending', 'approved', 'rejected']),
                rejectionReason: faker.datatype.boolean() ? faker.lorem.sentence() : null
            }
        });
        companies.push(company);

        // Create 2-4 jobs for each company
        const jobCount = faker.number.int({ min: 2, max: 4 });
        for (let i = 0; i < jobCount; i++) {
            const job = await prisma.job.create({
                data: {
                    companyId: company.id,
                    title: faker.person.jobTitle(),
                    description: faker.datatype.boolean() ? faker.lorem.paragraph() : null,
                    requirements: faker.datatype.boolean() ? faker.lorem.paragraph() : null,
                    benefits: faker.datatype.boolean() ? faker.lorem.paragraph() : null,
                    salaryMin: faker.datatype.boolean() ? faker.number.int({ min: 1000, max: 3000 }) : null,
                    salaryMax: faker.datatype.boolean() ? faker.number.int({ min: 3001, max: 5000 }) : null,
                    location: faker.datatype.boolean() ? faker.location.city() : null,
                    jobType: faker.helpers.arrayElement(['Full-time', 'Part-time', 'Remote', 'Contract']),
                    jobLevel: faker.helpers.arrayElement(['Intern', 'Junior', 'Mid-level', 'Senior', 'Manager']),
                    status: faker.helpers.arrayElement(['pending', 'approved', 'rejected', 'paused']),
                    rejectionReason: faker.datatype.boolean() ? faker.lorem.sentence() : null,
                    deadline: faker.datatype.boolean() ? faker.date.future() : null
                }
            });
            jobs.push(job);
        }
    }

    console.log(`✅ Created ${companies.length} companies and ${jobs.length} jobs`);
    return { companies, jobs };
};

module.exports = { seedCompanies };
