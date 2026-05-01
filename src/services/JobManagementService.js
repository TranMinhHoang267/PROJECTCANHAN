const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================================
// PRIVATE HELPERS
// ==============================================================================
/**
 * Lấy company của recruiter, throw nếu chưa có hoặc chưa được duyệt
 */
const _getApprovedCompany = async (userId) => {
    const company = await prisma.company.findUnique({ where: { user_id: userId } });
    if (!company) throw new Error('Bạn chưa có hồ sơ công ty.');
    if (company.status !== 'approved') throw new Error('Hồ sơ công ty chưa được Admin duyệt. Bạn chưa thể đăng tin.');
    return company;
};

const _getOwnJob = async (userId, jobId) => {
    const company = await prisma.company.findUnique({ where: { user_id: userId } });
    if (!company) throw new Error('Bạn chưa có hồ sơ công ty.');

    const job = await prisma.job.findFirst({
        where: { id: jobId, company_id: company.id },
        include: {
            skills: {
                include: { skill: { select: { id: true, name: true } } }
            },
            company: true
        }
    });
    if (!job) throw new Error('Không tìm thấy tin đăng hoặc bạn không có quyền thao tác.');
    
    // Transform skills to match old Sequelize format
    job.skills = job.skills.map(js => js.skill);
    return job;
};

// Helper dùng chung cho createJob và updateJob
const _attachSkills = async (jobId, skills) => {
    const skillIds = [];
    for (const name of skills) {
        const cleanName = name.trim();
        if (!cleanName) continue;
        const skill = await prisma.skill.upsert({
            where: { name: cleanName },
            update: {},
            create: { name: cleanName }
        });
        skillIds.push({ skill_id: skill.id });
    }

    await prisma.job_skill.deleteMany({ where: { job_id: jobId } });
    if (skillIds.length > 0) {
        await prisma.job_skill.createMany({
            data: skillIds.map(s => ({ job_id: jobId, skill_id: s.skill_id }))
        });
    }
};

// ==============================================================================
// 1. TẠO TIN TUYỂN DỤNG MỚI
// ==============================================================================
exports.createJob = async (userId, data) => {
    const company = await _getApprovedCompany(userId);

    const {
        title, description, requirements, benefits,
        salary_min, salary_max, location,
        job_type, job_level, deadline, skills = []
    } = data;

    if (!title?.trim()) throw new Error('Tiêu đề công việc không được để trống.');

    const job = await prisma.job.create({
        data: {
            company_id: company.id,
            title: title.trim(),
            description: description?.trim() || null,
            requirements: requirements?.trim() || null,
            benefits: benefits?.trim() || null,
            salary_min: salary_min || null,
            salary_max: salary_max || null,
            location: location?.trim() || null,
            job_type: job_type?.trim() || null,
            job_level: job_level?.trim() || null,
            deadline: deadline || null,
            status: 'pending'
        }
    });

    // Attach skills
    if (skills.length > 0) {
        await _attachSkills(job.id, skills);
    }

    return await _getOwnJob(userId, job.id);
};

// ==============================================================================
// 2. DANH SÁCH TIN ĐĂNG CỦA CÔNG TY
// ==============================================================================
exports.getMyJobs = async (userId, filters = {}) => {
    const company = await prisma.company.findUnique({ where: { user_id: userId } });
    if (!company) throw new Error('Bạn chưa có hồ sơ công ty.');

    const pageSize = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const where = { company_id: company.id };
    if (filters.status) where.status = filters.status;

    const [count, jobs] = await Promise.all([
        prisma.job.count({ where }),
        prisma.job.findMany({
            where,
            include: {
                skills: {
                    include: { skill: { select: { id: true, name: true } } }
                }
            },
            orderBy: { created_at: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    // Transform skills
    const transformedJobs = jobs.map(job => ({
        ...job,
        skills: job.skills.map(js => js.skill)
    }));

    return {
        total_items: count,
        total_pages: Math.ceil(count / pageSize),
        current_page: pageNumber,
        jobs: transformedJobs
    };
};

// ==============================================================================
// 3. XEM CHI TIẾT MỘT TIN ĐĂNG
// ==============================================================================
exports.getJobDetail = async (userId, jobId) => {
    return await _getOwnJob(userId, jobId);
};

// ==============================================================================
// 4. CẬP NHẬT TIN ĐĂNG
// ==============================================================================
exports.updateJob = async (userId, jobId, data) => {
    const job = await _getOwnJob(userId, jobId);

    if (job.status === 'rejected') {
        throw new Error('Tin đăng đã bị từ chối. Vui lòng tạo tin đăng mới.');
    }

    const {
        title, description, requirements, benefits,
        salary_min, salary_max, location,
        job_type, job_level, deadline, skills
    } = data;

    if (title !== undefined && !title?.trim()) {
        throw new Error('Tiêu đề công việc không được để trống.');
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (requirements !== undefined) updateData.requirements = requirements?.trim() || null;
    if (benefits !== undefined) updateData.benefits = benefits?.trim() || null;
    if (salary_min !== undefined) updateData.salary_min = salary_min;
    if (salary_max !== undefined) updateData.salary_max = salary_max;
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (job_type !== undefined) updateData.job_type = job_type?.trim() || null;
    if (job_level !== undefined) updateData.job_level = job_level?.trim() || null;
    if (deadline !== undefined) updateData.deadline = deadline;

    if (Object.keys(updateData).length > 0 && job.status !== 'paused') {
        updateData.status = 'pending';
        updateData.rejection_reason = null;
    }

    await prisma.job.update({
        where: { id: jobId },
        data: updateData
    });

    // Update skills
    if (Array.isArray(skills) && skills.length > 0) {
        await _attachSkills(jobId, skills);
    }

    return await _getOwnJob(userId, jobId);
};

// ==============================================================================
// 5. TẠM DỪNG / MỞ LẠI TIN ĐĂNG
// ==============================================================================
exports.togglePauseJob = async (userId, jobId) => {
    const job = await _getOwnJob(userId, jobId);

    if (job.status === 'pending') throw new Error('Tin đang chờ duyệt. Không thể tạm dừng lúc này.');
    if (job.status === 'rejected') throw new Error('Tin đã bị từ chối. Không thể tạm dừng.');

    if (job.status === 'paused') {
        await prisma.job.update({
            where: { id: jobId },
            data: { status: 'approved' }
        });
        return { status: 'approved', message: 'Đã mở lại tin tuyển dụng.' };
    } else {
        await prisma.job.update({
            where: { id: jobId },
            data: { status: 'paused' }
        });
        return { status: 'paused', message: 'Đã tạm dừng tin tuyển dụng.' };
    }
};

// ==============================================================================
// 6. XÓA TIN ĐĂNG
// ==============================================================================
exports.deleteJob = async (userId, jobId) => {
    const job = await _getOwnJob(userId, jobId);
    await prisma.job.delete({ where: { id: jobId } });
    return true;
};
