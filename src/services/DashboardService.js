const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================================
// DASHBOARD THỐNG KÊ CHO RECRUITER
// ==============================================================================
exports.getDashboard = async (userId) => {
    const company = await prisma.company.findUnique({ where: { user_id: userId } });
    if (!company) throw new Error('Bạn chưa có hồ sơ công ty.');

    const companyId = company.id;

    // Lấy tất cả job ids
    const allJobs = await prisma.job.findMany({ 
        where: { company_id: companyId }, 
        select: { id: true, status: true } 
    });
    const jobIds = allJobs.map(j => j.id);

    // --- THỐNG KÊ TIN ĐĂNG ---
    const jobStats = {
        total:    allJobs.length,
        pending:  allJobs.filter(j => j.status === 'pending').length,
        approved: allJobs.filter(j => j.status === 'approved').length,
        rejected: allJobs.filter(j => j.status === 'rejected').length,
        paused:   allJobs.filter(j => j.status === 'paused').length
    };

    if (jobIds.length === 0) {
        return {
            company_name:   company.name,
            company_status: company.status,
            jobs:           jobStats,
            applications: { total: 0, submitted: 0, under_review: 0, interview: 0, accepted: 0, rejected: 0 },
            success_rate:   '0%',
            recent_applications: []
        };
    }

    // --- THỐNG KÊ ĐƠN ỨNG TUYỂN ---
    const allApps = await prisma.application.findMany({
        where: { job_id: { in: jobIds } },
        select: { id: true, status: true, applied_at: true }
    });

    const appStats = {
        total:         allApps.length,
        submitted:     allApps.filter(a => a.status === 'submitted').length,
        under_review:   allApps.filter(a => a.status === 'under_review').length,
        interview:       allApps.filter(a => a.status === 'interview').length,
        accepted:        allApps.filter(a => a.status === 'accepted').length,
        rejected:        allApps.filter(a => a.status === 'rejected').length
    };

    // --- TỶ LỆ TUYỂN THÀNH CÔNG ---
    const reviewed = appStats.accepted + appStats.rejected; // Đã xử lý (bỏ trừ các đơn pending)
    const successRate = reviewed > 0
        ? `${Math.round((appStats.accepted / reviewed) * 100)}%`
        : '0%';

    // --- 5 ĐƠN ỨNG TUYỂN MỚI NHẤT ---
    const recent = await prisma.application.findMany({
        where: { job_id: { in: jobIds } },
        include: {
            candidate: { select: { full_name: true, email: true, avatar_url: true } },
            job:       { select: { title: true } }
        },
        orderBy: { applied_at: 'desc' },
        take: 5
    });

    return {
        company_name:   company.name,
        company_status: company.status,
        jobs:           jobStats,
        applications:   appStats,
        success_rate:   successRate,
        recent_applications: recent.map(a => ({
            id:         a.id,
            status:     a.status,
            applied_at: a.applied_at,
            candidate:  { full_name: a.candidate?.full_name, email: a.candidate?.email, avatar_url: a.candidate?.avatar_url },
            job_title:  a.job?.title
        }))
    };
};
