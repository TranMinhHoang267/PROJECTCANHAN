const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getJobSuggestions = async (userId, limit = 10) => {
    // Giới hạn tối đa 50
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));

    // 1. Lấy kỹ năng ứng viên
    const profile = await prisma.candidate_profile.findUnique({
        where: { user_id: userId },
        include: {
            skills: {
                include: { skill: { select: { id: true, name: true } } }
            }
        }
    });

    // 1a. Lấy danh sách job đã ứng tuyển
    const appliedApplications = await prisma.application.findMany({
        where: { user_id: userId },
        select: { job_id: true }
    });
    const appliedJobIds = appliedApplications.map(a => a.job_id);

    const excludeClause = appliedJobIds.length > 0
        ? { id: { notIn: appliedJobIds } }
        : {};

    // Không có kỹ năng → trả về job mới nhất
    if (!profile || !profile.skills || profile.skills.length === 0) {
        const jobs = await prisma.job.findMany({
            where: { status: 'approved', ...excludeClause },
            include: {
                company: { select: { name: true, logo_url: true, city: true } },
                skills: {
                    include: { skill: { select: { id: true, name: true } } }
                }
            },
            orderBy: { created_at: 'desc' },
            take: safeLimit
        });

        return jobs.map(job => ({
            ...job,
            skills: job.skills.map(js => js.skill)
        }));
    }

    const candidateSkillIds = profile.skills.map(s => s.skill.id);

    // 2. Tìm job có skill khớp
    const jobs = await prisma.job.findMany({
        where: {
            status: 'approved',
            ...excludeClause,
            skills: {
                some: {
                    skill_id: { in: candidateSkillIds }
                }
            }
        },
        include: {
            company: { select: { name: true, logo_url: true, city: true } },
            skills: {
                include: { skill: { select: { id: true, name: true } } }
            }
        },
        take: safeLimit * 3
    });

    // 3. Tính điểm match và sắp xếp
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
                job_type: job.job_type,
                job_level: job.job_level,
                benefits: job.benefits,
                description: job.description,
                requirements: job.requirements,
                skills: job.skills.map(js => js.skill),
                salary_min: job.salary_min,
                salary_max: job.salary_max,
                deadline: job.deadline,
                company: job.company,
                matched_skills: matchedSkills,
                match_count: matchCount,
                match_percent: matchPercent
            };
        })
        .sort((a, b) => b.match_count - a.match_count)
        .slice(0, safeLimit);
};
