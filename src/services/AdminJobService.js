const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================================
// 1. DANH SÁCH TIN TUYỂN DỤNG ĐANG CHỜ DUYỆT
// ==============================================================================
exports.getPendingJobs = async (filters = {}) => {
    const pageSize = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const [count, jobs] = await Promise.all([
        prisma.job.count({ where: { status: 'pending' } }),
        prisma.job.findMany({
            where: { status: 'pending' },
            include: {
                company: {
                    select: {
                        id: true, name: true, logo_url: true, city: true,
                        user: { select: { full_name: true, email: true } }
                    }
                },
                skills: {
                    include: { skill: { select: { id: true, name: true } } }
                }
            },
            orderBy: { created_at: 'asc' }, // FIFO
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
// 2. DANH SÁCH TẤT CẢ TIN TUYỂN DỤNG (lọc theo status)
// ==============================================================================
exports.getAllJobs = async (filters = {}) => {
    const {
        status,
        keyword,
        page = 1,
        limit = 10
    } = filters;

    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const pageNumber = Math.max(1, parseInt(page));
    const skip = (pageNumber - 1) * pageSize;

    const where = {};
    if (status) where.status = status;
    if (keyword) where.title = { contains: keyword.trim(), mode: 'insensitive' };

    const [count, jobs] = await Promise.all([
        prisma.job.count({ where }),
        prisma.job.findMany({
            where,
            include: {
                company: { select: { id: true, name: true, logo_url: true, city: true } },
                skills: { include: { skill: { select: { id: true, name: true } } } }
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
// 3. XEM CHI TIẾT MỘT TIN TUYỂN DỤNG
// ==============================================================================
exports.getJobDetail = async (jobId) => {
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
            company: {
                include: { user: { select: { full_name: true, email: true, phone: true } } }
            },
            skills: { include: { skill: true } }
        }
    });
    if (!job) throw new Error('Tin tuyển dụng không tồn tại.');

    // Transform skills
    job.skills = job.skills.map(js => js.skill);
    return job;
};

// ==============================================================================
// 4. DUYỆT TIN TUYỂN DỤNG (approved / rejected)
// ==============================================================================
/**
 * @param {string} jobId
 * @param {'approved' | 'rejected'} action
 * @param {string} [reason] - Bắt buộc khi rejected
 */
exports.reviewJob = async (jobId, action, reason) => {
    if (!['approved', 'rejected'].includes(action)) {
        throw new Error('Hành động không hợp lệ. Chỉ chấp nhận: approved hoặc rejected.');
    }
    if (action === 'rejected' && !reason?.trim()) {
        throw new Error('Vui lòng cung cấp lý do từ chối tin đăng.');
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Tin tuyển dụng không tồn tại.');

    if (job.status !== 'pending') {
        throw new Error(`Tin tuyển dụng này đã được xử lý (trạng thái hiện tại: ${job.status}).`);
    }

    await prisma.job.update({
        where: { id: jobId },
        data: {
            status: action,
            rejection_reason: action === 'rejected' ? reason.trim() : null
        }
    });

    return await prisma.job.findUnique({
        where: { id: jobId },
        include: { company: { select: { name: true } } }
    });
};

// ==============================================================================
// 5. XÓA JOB VI PHẠM (Admin — kể cả job đã approved)
// ==============================================================================
exports.deleteJob = async (jobId) => {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Tin tuyển dụng không tồn tại.');
    await prisma.job.delete({ where: { id: jobId } });
    return true;
};
