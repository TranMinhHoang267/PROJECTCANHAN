const { faker } = require('@faker-js/faker');
const prisma = require('../../src/config/prisma');

const seedApplications = async (users, jobs, profiles) => {
    const candidates = users.filter(u => u.role === 'candidate');
    const applications = [];
    const bookmarks = [];
    const resumes = [];

    // Get all skills for job skills
    const allSkills = await prisma.skill.findMany();

    // Create resumes for candidates (1-3 per candidate)
    for (const user of candidates) {
        const resumeCount = faker.number.int({ min: 1, max: 3 });
        for (let i = 0; i < resumeCount; i++) {
            const resume = await prisma.resume.create({
                data: {
                    userId: user.id,
                    title: faker.lorem.words(3),
                    fileUrl: faker.internet.url() + '/resume_' + faker.string.uuid() + '.pdf',
                    isDefault: i === 0, // First resume is default
                    createdAt: faker.date.past(2)
                }
            });
            resumes.push(resume);
        }
    }

    // Create job skills for each job (2-5 skills per job)
    for (const job of jobs) {
        const skillCount = faker.number.int({ min: 2, max: 5 });
        const shuffled = [...allSkills].sort(() => 0.5 - Math.random()).slice(0, skillCount);
        for (const skill of shuffled) {
            await prisma.job_skill.create({
                data: {
                    jobId: job.id,
                    skillId: skill.id
                }
            });
        }
    }

    // Create bookmarks (random users bookmark random jobs)
    const bookmarkCount = faker.number.int({ min: 5, max: 10 });
    for (let i = 0; i < bookmarkCount; i++) {
        const user = faker.helpers.arrayElement(users);
        const job = faker.helpers.arrayElement(jobs);
        
        // Check if bookmark already exists
        const existing = await prisma.bookmark.findFirst({
            where: { userId: user.id, jobId: job.id }
        });
        
        if (!existing) {
            const bookmark = await prisma.bookmark.create({
                data: {
                    userId: user.id,
                    jobId: job.id
                }
            });
            bookmarks.push(bookmark);
        }
    }

    // Create applications (random candidates apply to random jobs)
    const appCount = faker.number.int({ min: 10, max: 20 });
    for (let i = 0; i < appCount; i++) {
        const candidate = faker.helpers.arrayElement(candidates);
        const job = faker.helpers.arrayElement(jobs);
        const profile = profiles.find(p => p.userId === candidate.id);
        
        // Get a resume for this candidate
        const userResumes = resumes.filter(r => r.userId === candidate.id);
        const resume = userResumes.length > 0 
            ? faker.helpers.arrayElement(userResumes) 
            : null;

        // Check if application already exists
        const existing = await prisma.application.findFirst({
            where: { userId: candidate.id, jobId: job.id }
        });

        if (!existing) {
            const statuses = ['submitted', 'under_review', 'interview', 'accepted', 'rejected'];
            const status = faker.helpers.arrayElement(statuses);
            
            const application = await prisma.application.create({
                data: {
                    userId: candidate.id,
                    jobId: job.id,
                    companyId: job.companyId,
                    fullName: candidate.fullName,
                    email: candidate.email,
                    phone: candidate.phone,
                    resumeUrl: resume?.fileUrl || null,
                    coverLetter: faker.datatype.boolean() ? faker.lorem.paragraph() : null,
                    status,
                    createdAt: faker.date.past(1)
                }
            });
            applications.push(application);
        }
    }

    console.log(`✅ Created ${resumes.length} resumes, ${bookmarks.length} bookmarks, ${applications.length} applications`);
    return { resumes, bookmarks, applications };
};

module.exports = { seedApplications };
