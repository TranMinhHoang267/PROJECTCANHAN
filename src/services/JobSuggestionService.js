const prisma = require('../config/prisma');

exports.getJobSuggestions = async (userId, limit = 10) => {
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));

    const profile = await prisma.candidate_profile.findUnique({
        where: { userId },
        include: {
            skills: {
                include: { skill: { select: { id: true, name: true } } }
            }
        }
    });

    const appliedApplications = await prisma.application.findMany({
        where: { userId },
        select: { jobId: true }
    });
    const appliedJobIds = appliedApplications.map(a => a.jobId);

    if (!profile || !profile.skills || profile.skills.length === 0) {
        const where = { status: 'approved' };
        if (appliedJobIds.length > 0) where.id = { notIn: appliedJobIds };

        const jobs = await prisma.job.findMany({
            where,
            include: {
                company: { select: { name: true, logoUrl: true, city: true } },
                skills: { include: { skill: { select: { id: true, name: true } } } }
            },
            orderBy: { createdAt: 'desc' },
            take: safeLimit
        });

        return jobs.map(job => ({
            id: job.id,
            title: job.title,
            location: job.location,
            jobType: job.jobType,
            jobLevel: job.jobLevel,
            benefits: job.benefits,
            description: job.description,
            requirements: job.requirements,
            skills: job.skills.map(js => js.skill),
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            deadline: job.deadline,
            company: job.company
        }));
    }

    const candidateSkillIds = profile.skills.map(s => s.skill.id);

    const where = {
        status: 'approved',
        skills: { some: { skillId: { in: candidateSkillIds } } }
    };
    if (appliedJobIds.length > 0) where.id = { notIn: appliedJobIds };

    const jobs = await prisma.job.findMany({
        where,
        include: {
            company: { select: { name: true, logoUrl: true, city: true } },
            skills: { include: { skill: { select: { id: true, name: true } } } }
        },
        take: safeLimit * 3
    });

    return jobs
        .map(job => {
            const jobSkillIds = job.skills.map(s => s.skill.id);
            const matchCount = jobSkillIds.filter(id => candidateSkillIds.includes(id)).length;
            const matchPercent = Math.round((matchCount / candidateSkillIds.length) * 100);
            const matchedSkills = job.skills
                .filter(s => candidateSkillIds.includes(s.skill.id))
                .map(s => s.skill.name);

            return {
                id: job.id,
                title: job.title,
                location: job.location,
                jobType: job.jobType,
                jobLevel: job.jobLevel,
                benefits: job.benefits,
                description: job.description,
                requirements: job.requirements,
                skills: job.skills.map(js => js.skill),
                salaryMin: job.salaryMin,
                salaryMax: job.salaryMax,
                deadline: job.deadline,
                company: job.company,
                matchedSkills,
                matchCount,
                matchPercent
            };
        })
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, safeLimit);
};
