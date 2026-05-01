const path = require('path');
const fs   = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================================
// PRIVATE HELPER
// ==============================================================================
const _getCompanyId = async (userId) => {
    const company = await prisma.company.findUnique({ where: { user_id: userId } });
    if (!company) throw new Error('Bạn chưa có hồ sơ công ty.');
    return company.id;
};

// Dùng chung cho getAllApplicants, getApplicationDetail, getCvFile, updateApplicationStatus
const _getJobIds = async (companyId) => {
    const myJobs = await prisma.job.findMany({
        where: { company_id: companyId },
        select: { id: true }
    });
    return myJobs.map(j => j.id);
};

// ==============================================================================
// 1. XEM DANH SÁCH ỨNG VIÊN THEO TỪNG JOB
// ==============================================================================
/**
 * @param {string} userId  - recruiter userId
 * @param {string} jobId   - ID của tin tuyển dụng
 */
exports.getApplicantsByJob = async (userId, jobId, filters = {}) => {
    const companyId = await _getCompanyId(userId);

    const job = await prisma.job.findFirst({ where: { id: jobId, company_id: companyId } });
    if (!job) throw new Error('Tin tuyển dụng không tồn tại hoặc không thuộc công ty bạn.');

    const pageSize   = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip       = (pageNumber - 1) * pageSize;

    const where = { job_id: jobId };
    if (filters.status) where.status = filters.status;

    const [count, applications] = await Promise.all([
        prisma.application.count({ where }),
        prisma.application.findMany({
            where,
            include: {
                candidate: {
                    select: { id: true, full_name: true, email: true, phone: true, avatar_url: true,
                        candidateProfile: { select: { headline: true, bio: true, linkedin_url: true } }
                    }
                }
            },
            orderBy: { applied_at: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    return {
        total_items:   count,
        total_pages:   Math.ceil(count / pageSize),
        current_page:  pageNumber,
        applications:  applications.map(app => ({
            application_id:    app.id,
            status:            app.status,
            cover_letter:      app.cover_letter,
            cv_url:            app.resume_url,
            applied_at:        app.applied_at,
            note_by_recruiter: app.note_by_recruiter,
            candidate: {
                id:         app.candidate?.id,
                full_name:  app.candidate?.full_name,
                email:      app.candidate?.email,
                phone:      app.candidate?.phone,
                avatar_url: app.candidate?.avatar_url,
                headline:   app.candidate?.candidateProfile?.headline,
                bio:        app.candidate?.candidateProfile?.bio,
                linkedin_url: app.candidate?.candidateProfile?.linkedin_url
            }
        }))
    };
};

// ==============================================================================
// 2. XEM TOÀN BỘ ỨNG VIÊN CỦA TẤT CẢ JOB (tổng quan)
// ==============================================================================
exports.getAllApplicants = async (userId, filters = {}) => {
    const companyId = await _getCompanyId(userId);
    const jobIds    = await _getJobIds(companyId);

    const pageSize   = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip       = (pageNumber - 1) * pageSize;

    // Trả về object phân trang dù không có job
    if (jobIds.length === 0) {
        return { total_items: 0, total_pages: 0, current_page: pageNumber, applications: [] };
    }

    const where = { job_id: { in: jobIds } };
    if (filters.status) where.status = filters.status;

    const [count, applications] = await Promise.all([
        prisma.application.count({ where }),
        prisma.application.findMany({
            where,
            include: {
                candidate: {
                    select: { id: true, full_name: true, email: true, phone: true, avatar_url: true,
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
            orderBy: [
                { applied_at: 'desc' },
                { candidate: { candidateProfile: { experiences: { start_date: 'desc' } } } },
                { candidate: { candidateProfile: { educations: { start_date: 'desc' } } } }
            ],
            take: pageSize,
            skip
        })
    ]);

    return {
        total_items:  count,
        total_pages:  Math.ceil(count / pageSize),
        current_page: pageNumber,
        applications: applications.map(app => ({
            application_id: app.id,
            status:         app.status,
            cv_url:         app.resume_url,
            applied_at:     app.applied_at,
            job:       { id: app.job?.id, title: app.job?.title },
            candidate: {
                id:               app.candidate?.id,
                full_name:        app.candidate?.full_name,
                email:            app.candidate?.email,
                phone:            app.candidate?.phone,
                avatar_url:       app.candidate?.avatar_url,
                candidateProfile: app.candidate?.candidateProfile ? {
                    ...app.candidate.candidateProfile,
                    skills: app.candidate.candidateProfile.skills.map(cs => cs.skill)
                } : null
            }
        }))
    };
};

// ==============================================================================
// 3. XEM CHI TIẾT ĐƠN ỨNG TUYỂN + COVER LETTER
// ==============================================================================
exports.getApplicationDetail = async (userId, applicationId) => {
    const companyId = await _getCompanyId(userId);
    const jobIds    = await _getJobIds(companyId);

    const app = await prisma.application.findFirst({
        where: { id: applicationId, job_id: { in: jobIds } },
        include: [
            {
                candidate: {
                    select: { id: true, full_name: true, email: true, phone: true, avatar_url: true,
                        candidateProfile: {
                            include: {
                                experiences: true,
                                educations: true,
                                skills: { include: { skill: true } }
                            }
                        }
                    }
                }
            },
            {
                job: { select: { id: true, title: true, location: true, job_type: true } }
            }
        ]
    });

    if (!app) throw new Error('Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền xem.');
    
    // Transform skills
    if (app.candidate?.candidateProfile?.skills) {
        app.candidate.candidateProfile.skills = app.candidate.candidateProfile.skills.map(cs => cs.skill);
    }
    
    return app;
};

// ==============================================================================
// 4. XEM TRƯỚC PDF CV / TẢI CV
// ==============================================================================
exports.getCvFile = async (userId, applicationId, mode = 'view') => {
    const companyId = await _getCompanyId(userId);
    const jobIds    = await _getJobIds(companyId);

    const app = await prisma.application.findFirst({
        where: { id: applicationId, job_id: { in: jobIds } }
    });
    
    if (!app)        throw new Error('Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền xem.');
    if (!app.resume_url) throw new Error('Ứng viên này chưa đính kèm CV.');

    // ✅ Nếu là URL cloud (http/https) → trả về URL luôn, không đọc file local
    if (app.resume_url.startsWith('http://') || app.resume_url.startsWith('https://')) {
        return {
            fileUrl:  app.resume_url,
            fileName: path.basename(app.resume_url),
            mode,
            isRemote: true
        };
    }

    // local file
    const filePath = path.join(__dirname, '..', app.resume_url);
    if (!fs.existsSync(filePath)) throw new Error('File CV không tồn tại trên server.');

    return { filePath, fileName: path.basename(filePath), mode };
};

// ==============================================================================
// 5. CẬP NHẬT TRẠNG THÁI ĐƠN ỨNG TUYỂN
// ==============================================================================
const VALID_STATUS_FLOW = ['submitted', 'under_review', 'interview', 'accepted', 'rejected'];

exports.updateApplicationStatus = async (userId, applicationId, status, note) => {
    if (!VALID_STATUS_FLOW.includes(status)) {
        throw new Error(`Trạng thái không hợp lệ. Chỉ chấp nhận: ${VALID_STATUS_FLOW.join(', ')}`);
    }

    const companyId = await _getCompanyId(userId);
    const jobIds    = await _getJobIds(companyId);

    const app = await prisma.application.findFirst({
        where: { id: applicationId, job_id: { in: jobIds } }
    });
    if (!app) throw new Error('Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền thao tác.');

    const currentIdx = VALID_STATUS_FLOW.indexOf(app.status);
    const newIdx     = VALID_STATUS_FLOW.indexOf(status);

    if (newIdx < currentIdx && status !== 'rejected') {
        throw new Error('Không thể quay lại trạng thái trước đó.');
    }

    await prisma.application.update({
        where: { id: applicationId },
        data: {
            status,
            note_by_recruiter: note?.trim() || app.note_by_recruiter
        }
    });

    return await prisma.application.findUnique({ where: { id: applicationId } });
};
