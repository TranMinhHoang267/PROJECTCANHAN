const { seedUsers } = require('./auth.seed');
const { seedCandidates } = require('./candidate.seed');
const { seedCompanies } = require('./company.seed');
const { seedApplications } = require('./application.seed');

const main = async () => {
    console.log('🌱 Starting seed process...\n');

    // Step 1: Seed Users (Candidates, Recruiters, Admins)
    const users = await seedUsers();
    console.log('');

    // Step 2: Seed Candidate Profiles, Experiences, Educations, Skills
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
