const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================================
// THỐNG KÊ TỔNG QUAN HỆ THỐNG
// ==============================================================================
exports.getSystemStats = async () => {
    const [totalUsers, totalCandidates, totalRecruiters,
           totalCompanies, approvedCompanies,
           totalJobs, approvedJobs,
           totalApplications, acceptedApplications] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'candidate' } }),
        prisma.user.count({ where: { role: 'recruiter' } }),
        prisma.company.count(),
        prisma.company.count({ where: { status: 'approved' } }),
        prisma.job.count(),
        prisma.job.count({ where: { status: 'approved' } }),
        prisma.application.count(),
        prisma.application.count({ where: { status: 'accepted' } })
    ]);

    const reviewed = await prisma.application.count({
        where: { status: { in: ['accepted', 'rejected'] } }
    });

    return {
        users: {
            total:      totalUsers,
            candidates: totalCandidates,
            recruiters: totalRecruiters
        },
        companies: {
            total:    totalCompanies,
            approved: approvedCompanies,
            pending:  totalCompanies - approvedCompanies
        },
        jobs: {
            total:    totalJobs,
            approved: approvedJobs,
            pending:  await prisma.job.count({ where: { status: 'pending' } }),
            rejected: await prisma.job.count({ where: { status: 'rejected' } })
        },
        applications: {
            total:    totalApplications,
            accepted: acceptedApplications,
            success_rate: reviewed > 0
                ? `${Math.round((acceptedApplications / reviewed) * 100)}%`
                : '0%'
        }
    };
};

// ==============================================================================
// TĂNG TRƯỞNG USER THEO THÁNG (12 tháng gần nhất)
// ==============================================================================
exports.getUserGrowth = async () => {
    const rows = await prisma.$queryRaw`
        SELECT 
            DATE_TRUNC('month', created_at) as month,
            role,
            COUNT(id) as count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at), role
        ORDER BY month ASC
    `;

    // Gom nhóm theo tháng
    const byMonth = {};
    rows.forEach(row => {
        const month = new Date(row.month).toISOString().slice(0, 7); // YYYY-MM
        if (!byMonth[month]) byMonth[month] = { month, candidate: 0, recruiter: 0, total: 0 };
        byMonth[month][row.role] = parseInt(row.count);
        byMonth[month].total += parseInt(row.count);
    });

    return Object.values(byMonth);
};

// ==============================================================================
// SỐ ĐƠN ỨNG TUYỂN / CV THEO THÁNG (12 tháng gần nhất)
// ==============================================================================
exports.getApplicationsByMonth = async () => {
    const rows = await prisma.$queryRaw`
        SELECT 
            DATE_TRUNC('month', created_at) as month,
            status,
            COUNT(id) as count
        FROM applications
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at), status
        ORDER BY month ASC
    `;

    // Gom nhóm theo tháng
    const byMonth = {};
    rows.forEach(row => {
        const month = new Date(row.month).toISOString().slice(0, 7);
        if (!byMonth[month]) byMonth[month] = { month, total: 0, accepted: 0, rejected: 0 };
        byMonth[month].total += parseInt(row.count);
        if (row.status === 'accepted') byMonth[month].accepted += parseInt(row.count);
        if (row.status === 'rejected') byMonth[month].rejected += parseInt(row.count);
    });

    return Object.values(byMonth);
};

// ==============================================================================
// TIN TUYỂN DỤNG THEO LOẠI CÔNG VIỆC (job_type)
// ==============================================================================
exports.getJobsByType = async () => {
    const rows = await prisma.job.groupBy({
        by: ['job_type'],
        where: { status: 'approved' },
        _count: { id: true }
    });

    return rows.map(r => ({
        job_type: r.job_type || 'Khác',
        count: r._count.id
    })).sort((a, b) => b.count - a.count);
};

// ==============================================================================
// TIN TUYỂN DỤNG THEO CẤP ĐỘ (job_level)
// ==============================================================================
exports.getJobsByLevel = async () => {
    const rows = await prisma.job.groupBy({
        by: ['job_level'],
        where: { status: 'approved' },
        _count: { id: true }
    });

    return rows.map(r => ({
        job_level: r.job_level || 'Khác',
        count: r._count.id
    })).sort((a, b) => b.count - a.count);
};
