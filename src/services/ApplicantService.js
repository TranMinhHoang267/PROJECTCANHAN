const prisma = require('../config/prisma');
const path = require('path');
const fs = require('fs');

const _getCompanyId = async (userId) => {
    const company = await prisma.company.findUnique({ where: { userId } });
    if (!company) throw new Error('Bạn chưa có hồ sơ công ty.');
    return company.id;
};

const _getJobIds = async (companyId) => {
    const myJobs = await prisma.job.findMany({
        where: { companyId },
        select: { id: true }
    });
    return myJobs.map(j => j.id);
};

exports.getApplicantsByJob = async (userId, jobId, filters = {}) => {
    const companyId = await _getCompanyId(userId);

    const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
    if (!job) throw new Error('Tin tuyển dụng không tồn tại hoặc không thuộc công ty bạn.');

    const pageSize = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const where = { jobId };
    if (filters.status) where.status = filters.status;

    const [count, applications] = await Promise.all([
        prisma.application.count({ where }),
        prisma.application.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true, fullName: true, email: true, phone: true, avatarUrl: true,
                        candidateProfile: {
                            select: {
                                headline: true, summary: true, address: true, city: true,
                                dateOfBirth: true, gender: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    return {
        total_items: count,
        total_pages: Math.ceil(count / pageSize),
        current_page: pageNumber,
        applications: applications.map(app => ({
            applicationId: app.id,
            status: app.status,
            coverLetter: app.coverLetter,
            resumeUrl: app.resumeUrl,
            appliedAt: app.createdAt,
            candidate: {
                id: app.user?.id,
                fullName: app.user?.fullName,
                email: app.user?.email,
                phone: app.user?.phone,
                avatarUrl: app.user?.avatarUrl,
                headline: app.user?.candidateProfile?.headline,
                summary: app.user?.candidateProfile?.summary,
                address: app.user?.candidateProfile?.address,
                city: app.user?.candidateProfile?.city,
                dateOfBirth: app.user?.candidateProfile?.dateOfBirth,
                gender: app.user?.candidateProfile?.gender
            }
        }))
    };
};

exports.getAllApplicants = async (userId, filters = {}) => {
    const companyId = await _getCompanyId(userId);
    const jobIds = await _getJobIds(companyId);

    const pageSize = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip = (pageNumber - 1) * pageSize;

    if (jobIds.length === 0) {
        return { total_items: 0, total_pages: 0, current_page: pageNumber, applications: [] };
    }

    const where = { jobId: { in: jobIds } };
    if (filters.status) where.status = filters.status;

    const [count, applications] = await Promise.all([
        prisma.application.count({ where }),
        prisma.application.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true, fullName: true, email: true, phone: true, avatarUrl: true,
                        candidateProfile: {
                            include: {
                                experiences: true,
                                educations: true,
                                skills: { include: { skill: true } }
                            }
                        }
                    }
                },
                job: { select: { id: true, title: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    return {
        total_items: count,
        total_pages: Math.ceil(count / pageSize),
        current_page: pageNumber,
        applications: applications.map(app => ({
            applicationId: app.id,
            status: app.status,
            resumeUrl: app.resumeUrl,
            appliedAt: app.createdAt,
            job: { id: app.job?.id, title: app.job?.title },
            candidate: {
                id: app.user?.id,
                fullName: app.user?.fullName,
                email: app.user?.email,
                phone: app.user?.phone,
                avatarUrl: app.user?.avatarUrl,
                candidateProfile: app.user?.candidateProfile ? {
                    ...app.user.candidateProfile,
                    skills: app.user.candidateProfile.skills.map(cs => cs.skill)
                } : null
            }
        }))
    };
};

exports.getApplicationDetail = async (userId, applicationId) => {
    const companyId = await _getCompanyId(userId);
    const jobIds = await _getJobIds(companyId);

    const app = await prisma.application.findFirst({
        where: { id: applicationId, jobId: { in: jobIds } },
        include: {
            user: {
                select: {
                    id: true, fullName: true, email: true, phone: true, avatarUrl: true,
                    candidateProfile: {
                        include: {
                            experiences: true,
                            educations: true,
                            skills: { include: { skill: true } }
                        }
                    }
                }
            },
            job: { select: { id: true, title: true, location: true, jobType: true } }
        }
    });

    if (!app) throw new Error('Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền xem.');

    if (app.user?.candidateProfile?.skills) {
        app.user.candidateProfile.skills = app.user.candidateProfile.skills.map(cs => cs.skill);
    }

    return app;
};

exports.getCvFile = async (userId, applicationId, mode = 'view') => {
    const companyId = await _getCompanyId(userId);
    const jobIds = await _getJobIds(companyId);

    const app = await prisma.application.findFirst({
        where: { id: applicationId, jobId: { in: jobIds } }
    });

    if (!app) throw new Error('Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền xem.');
    if (!app.resumeUrl) throw new Error('Ứng viên này chưa đính kèm CV.');

    if (app.resumeUrl.startsWith('http://') || app.resumeUrl.startsWith('https://')) {
        return {
            fileUrl: app.resumeUrl,
            fileName: path.basename(app.resumeUrl),
            mode,
            isRemote: true
        };
    }

    const filePath = path.join(__dirname, '..', app.resumeUrl);
    if (!fs.existsSync(filePath)) throw new Error('File CV không tồn tại trên server.');

    return { filePath, fileName: path.basename(filePath), mode };
};

const VALID_STATUS_FLOW = ['submitted', 'under_review', 'interview', 'accepted', 'rejected'];

exports.updateApplicationStatus = async (userId, applicationId, status) => {
    if (!VALID_STATUS_FLOW.includes(status)) {
        throw new Error(`Trạng thái không hợp lệ. Chỉ chấp nhận: ${VALID_STATUS_FLOW.join(', ')}`);
    }

    const companyId = await _getCompanyId(userId);
    const jobIds = await _getJobIds(companyId);

    const app = await prisma.application.findFirst({
        where: { id: applicationId, jobId: { in: jobIds } }
    });
    if (!app) throw new Error('Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền thao tác.');

    const currentIdx = VALID_STATUS_FLOW.indexOf(app.status);
    const newIdx = VALID_STATUS_FLOW.indexOf(status);

    if (newIdx < currentIdx && status !== 'rejected') {
        throw new Error('Không thể quay lại trạng thái trước đó.');
    }

    await prisma.application.update({
        where: { id: applicationId },
        data: { status }
    });

    return await prisma.application.findUnique({ where: { id: applicationId } });
};
