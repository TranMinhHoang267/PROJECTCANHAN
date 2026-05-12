const { faker } = require('@faker-js/faker');
const prisma = require('../../src/config/prisma');

const seedCandidates = async (users) => {
    const candidates = users.filter(u => u.role === 'candidate');
    const profiles = [];
    const experiences = [];
    const educations = [];
    const skills = [];
    const candidateSkills = [];

    // Create or get skills first
    const skillNames = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C#', 'PHP', 'Go', 'Rust', 'SQL', 'MongoDB', 'Docker', 'AWS', 'Git'];
    const skillRecords = [];
    for (const name of skillNames) {
        const skill = await prisma.skill.upsert({
            where: { name },
            update: {},
            create: { name }
        });
        skillRecords.push(skill);
    }

    for (const user of candidates) {
        // Create Candidate Profile
        const profile = await prisma.candidate_profile.create({
            data: {
                userId: user.id,
                headline: faker.datatype.boolean() ? faker.person.jobTitle() : null,
                summary: faker.datatype.boolean() ? faker.lorem.paragraph() : null,
                phone: faker.phone.number('090#######'),
                address: faker.datatype.boolean() ? faker.location.streetAddress() : null,
                city: faker.datatype.boolean() ? faker.location.city() : null,
                dateOfBirth: faker.datatype.boolean() ? faker.date.past(30) : null,
                gender: faker.datatype.boolean() ? faker.helpers.arrayElement(['male', 'female', 'other']) : null
            }
        });
        profiles.push(profile);

        // Create 1-3 Experiences
        const expCount = faker.number.int({ min: 1, max: 3 });
        for (let i = 0; i < expCount; i++) {
            const startDate = faker.date.past(10);
            const hasEndDate = faker.datatype.boolean();
            const exp = await prisma.experience.create({
                data: {
                    profileId: profile.id,
                    title: faker.person.jobTitle(),
                    company: faker.company.name(),
                    startDate,
                    endDate: hasEndDate ? faker.date.between({ from: startDate, to: new Date() }) : null,
                    description: faker.datatype.boolean() ? faker.lorem.paragraph() : null
                }
            });
            experiences.push(exp);
        }

        // Create 1-2 Educations
        const eduCount = faker.number.int({ min: 1, max: 2 });
        for (let i = 0; i < eduCount; i++) {
            const startDate = faker.date.past(10);
            const hasEndDate = faker.datatype.boolean();
            const edu = await prisma.education.create({
                data: {
                    profileId: profile.id,
                    school: faker.company.name() + ' University',
                    degree: faker.helpers.arrayElement(['Bachelor', 'Master', 'PhD', 'Associate']),
                    field: faker.helpers.arrayElement(['Computer Science', 'Engineering', 'Business', 'Mathematics']),
                    startDate,
                    endDate: hasEndDate ? faker.date.between({ from: startDate, to: new Date() }) : null
                }
            });
            educations.push(edu);
        }

        // Assign 2-5 random skills
        const skillCount = faker.number.int({ min: 2, max: 5 });
        const shuffled = [...skillRecords].sort(() => 0.5 - Math.random()).slice(0, skillCount);
        for (const skill of shuffled) {
            await prisma.candidate_skill.create({
                data: {
                    profileId: profile.id,
                    skillId: skill.id
                }
            });
            candidateSkills.push({ profileId: profile.id, skillId: skill.id });
        }
    }

    console.log(`✅ Created ${profiles.length} candidate profiles, ${experiences.length} experiences, ${educations.length} educations`);
    return { profiles, experiences, educations, skills: candidateSkills };
};

module.exports = { seedCandidates };
