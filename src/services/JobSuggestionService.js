const prisma = require('../config/prisma');

exports.getJobSuggestions = async (userId, filters = {}) => {
    // Lấy limit từ filters giống các service khác
    const limit = filters.limit || 10;
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
    // 1. Lấy kỹ năng ứng viên
    const profile = await prisma.candidate_profile.findUnique({
        where: { userId: userId }, // Đã sửa thành userId
        include: {
            skills: {
                include: { skill: { select: { id: true, name: true } } }
            }
        }
    });

    // 2. Lấy tất cả job đã ứng tuyển để loại trừ (không gợi ý các công việc đang ứng tuyển hoặc đã bị từ chối)
    const appliedApplications = await prisma.application.findMany({
        where: {
            userId,
            OR: [
                { isDeleted: false },
                { isDeleted: true, status: "rejected" }
            ]
        },
        select: { jobId: true }
    });

    const appliedJobIds = appliedApplications.map(a => a.jobId);

    const baseWhere = {
        status: 'approved',
        ...(appliedJobIds.length > 0 && { id: { notIn: appliedJobIds } }),
        OR: [
            { deadline: { gt: new Date() } },
            { deadline: null }
        ]
    };

    // 3. Không có kỹ năng → trả về job mới nhất chưa hết hạn với matchPercent mặc định
    if (!profile || !profile.skills || profile.skills.length === 0) {
        const jobs = await prisma.job.findMany({
            where: baseWhere,
            include: {
                company: { select: { name: true, logoUrl: true, city: true } },
                skills: {
                    include: { skill: { select: { id: true, name: true } } }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: safeLimit
        });

        return jobs.map(job => ({
            id:           job.id,
            title:        job.title,
            location:     job.location,
            jobType:      job.jobType,
            jobLevel:     job.jobLevel,
            benefits:     job.benefits,
            description:  job.description,
            requirements: job.requirements,
            skills:       job.skills.map(js => js.skill),
            salaryMin:    job.salaryMin,
            salaryMax:    job.salaryMax,
            deadline:     job.deadline,
            company:      job.company,
            matchPercent: 50 // Mức độ phù hợp mặc định khi chưa có kỹ năng
        }));
    }

    const candidateSkillIds = profile.skills.map(s => s.skill.id);

    // 4. Tìm job có skill khớp và chưa hết hạn
    const jobs = await prisma.job.findMany({
        where: {
            ...baseWhere,
            skills: {
                some: { skillId: { in: candidateSkillIds } }
            }
        },
        include: {
            company: { select: { name: true, logoUrl: true, city: true } },
            skills: {
                include: { skill: { select: { id: true, name: true } } }
            }
        },
        take: safeLimit * 3
    });

    // 5. Tính điểm match và sắp xếp
    return jobs
        .map(job => {
            const jobSkillIds   = job.skills.map(js => js.skill.id);
            const matchCount    = jobSkillIds.filter(id => candidateSkillIds.includes(id)).length;
            // Tính phần trăm khớp dựa trên số kỹ năng công việc yêu cầu
            const matchPercent  = jobSkillIds.length > 0 
                ? Math.round((matchCount / jobSkillIds.length) * 100) 
                : 70; // 70% mặc định nếu công việc không yêu cầu kỹ năng cụ thể
            
            const matchedSkills = job.skills
                .filter(js => candidateSkillIds.includes(js.skill.id))
                .map(js => js.skill.name);

            return {
                id:            job.id,
                title:         job.title,
                location:      job.location,
                jobType:       job.jobType,
                jobLevel:      job.jobLevel,
                benefits:      job.benefits,
                description:   job.description,
                requirements:  job.requirements,
                skills:        job.skills.map(js => js.skill),
                salaryMin:     job.salaryMin,
                salaryMax:     job.salaryMax,
                deadline:      job.deadline,
                company:       job.company,
                matchedSkills,
                matchCount,
                matchPercent
            };
        })
        .sort((a, b) => b.matchPercent - a.matchPercent)
        .slice(0, safeLimit);
};