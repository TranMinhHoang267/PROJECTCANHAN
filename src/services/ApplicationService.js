const prisma = require('../config/prisma');

const _getActiveJob = async (jobId) => {
    const job = await prisma.job.findFirst({ where: { id: jobId, status: 'approved' } });
    if (!job) throw new Error('Công việc không tồn tại hoặc đã đóng tuyển.');
    if (job.deadline && new Date(job.deadline) < new Date()) {
        throw new Error('Công việc này đã hết hạn nộp hồ sơ.');
    }
    return job;
};

exports.applyJob = async (userId, data) => {
    const { jobId, resumeId, coverLetter } = data;

    if (!jobId) throw new Error('Vui lòng chọn công việc muốn ứng tuyển.');

    await _getActiveJob(jobId);

    const existed = await prisma.application.findFirst({ where: { userId, jobId } });
    if (existed) throw new Error('Bạn đã nộp đơn ứng tuyển vị trí này rồi.');

    let resumeUrl = null;
    if (resumeId) {
        const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
        if (!resume) throw new Error('CV không tồn tại hoặc không thuộc về bạn.');
        resumeUrl = resume.fileUrl;
    } else {
        const defaultResume = await prisma.resume.findFirst({ where: { userId, isDefault: true } });
        if (defaultResume) resumeUrl = defaultResume.fileUrl;
    }

    const job  = await prisma.job.findUnique({ where: { id: jobId } });
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const application = await prisma.application.create({
        data: {
            userId,
            jobId,
            companyId:   job?.companyId   || null,
            fullName:    user?.fullName    || '',
            email:       user?.email       || '',
            phone:       user?.phone       || '',
            resumeUrl:   resumeUrl,
            coverLetter: coverLetter?.trim() || null,
            status:      'submitted'
        }
    });

    return application;
};

exports.getMyApplications = async (userId, filters = {}) => {
    const pageSize   = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip       = (pageNumber - 1) * pageSize;

    // ✅ camelCase và isDeleted
    const where = { userId, isDeleted: false };
    if (filters.status) where.status = filters.status;

    const [count, applications] = await Promise.all([
        prisma.application.count({ where }),
        prisma.application.findMany({
            where,
            include: {
                job: {
                    select: {
                        id:       true,
                        title:    true,
                        location: true,
                        jobType:  true,
                        salaryMin: true,
                        salaryMax: true,
                        deadline: true,
                        company: { select: { name: true, logoUrl: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take:    pageSize,
            skip               // ✅ đã định nghĩa
        })
    ]);

    return {
        total_items:  count,
        total_pages:  Math.ceil(count / pageSize),
        current_page: pageNumber,
        applications: applications.map(app => ({
            id:          app.id,
            status:      app.status,
            coverLetter: app.coverLetter,
            resumeUrl:   app.resumeUrl,
            appliedAt:   app.createdAt,
            job: {
                id:        app.job?.id,
                title:     app.job?.title,
                location:  app.job?.location,
                jobType:   app.job?.jobType,
                salaryMin: app.job?.salaryMin,
                salaryMax: app.job?.salaryMax,
                deadline:  app.job?.deadline,
                company:   app.job?.company
            }
        }))
    };
};
exports.getApplicationDetail = async (userId, applicationId) => {
    const app = await prisma.application.findFirst({
        where:   { id: applicationId, userId },
        include: { job: { include: { company: true } } }
    });
    if (!app) throw new Error('Không tìm thấy đơn ứng tuyển.');
    return app;
};


// ==============================================================================
// 4. RÚT ĐƠN (chỉ khi status = submitted)
exports.withdrawApplication = async (userId, applicationId) => {
    const app = await prisma.application.findFirst({
        where: { id: applicationId, userId }
    });
    if (!app) throw new Error('Không tìm thấy đơn ứng tuyển.');

    if (app.status !== 'submitted') {
        throw new Error('Chỉ có thể rút đơn khi hồ sơ đang ở trạng thái "Đã nộp".');
    }

    // ✅ Soft delete
    await prisma.application.update({
        where: { id: applicationId },
        data:  { isDeleted: true }
    });
    return true;
};

// ==============================================================================
// 5. XÓA ĐƠN BỊ TỪ CHỐI
exports.deleteRejectedApplication = async (userId, applicationId) => {
    const app = await prisma.application.findFirst({
        where: { id: applicationId, userId }
    });
    if (!app) throw new Error('Không tìm thấy đơn ứng tuyển.');

    if (app.status !== 'rejected') {
        throw new Error('Chỉ có thể xóa đơn khi hồ sơ đã bị từ chối.');
    }

     await prisma.application.update({
        where: { id: applicationId },
        data:  { isDeleted: true } // Đã sửa thành isDeleted
    });

    return true;
};  