const { seedUsers } = require('./seed/auth.seed');
const { seedCandidates } = require('./seed/candidate.seed');
const { seedCompanies } = require('./seed/company.seed');
const { seedApplications } = require('./seed/application.seed');
const prisma = require('./../src/config/prisma');

const main = async () => {
    console.log('🌱 Starting seed process...\n');

    // Step 1: Seed Users
    const users = await seedUsers();
    console.log('');

    // Step 2: Seed Candidate Profiles
    const { profiles, experiences, educations } = await seedCandidates(users);
    console.log('');

    // Step 3: Seed Companies and Jobs
    const { companies, jobs } = await seedCompanies(users);
    console.log('');

    // Step 4: Seed Applications, Bookmarks, Resumes
    const { resumes, bookmarks, applications } = await seedApplications(users, jobs, profiles);
    console.log('\n✅ Seed completed successfully!');
    
    return { users, profiles, companies, jobs, resumes, bookmarks, applications };
};

main()
    .then(async () => {
        await prisma.$disconnect();
        process.exit(0);
    })
    .catch(async (e) => {
        console.error('❌ Seed error:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
