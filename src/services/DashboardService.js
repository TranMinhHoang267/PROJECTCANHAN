const prisma = require('../config/prisma');

exports.getDashboard = async (userId) => {
    const company = await prisma.company.findUnique({ where: { userId } });
    if (!company) throw new Error('Bạn chưa có hồ sơ công ty.');

    const companyId = company.id;

    const allJobs = await prisma.job.findMany({
        where: { companyId },
        select: { id: true, status: true }
    });
    const jobIds = allJobs.map(j => j.id);

    const jobStats = {
        total: allJobs.length,
        pending: allJobs.filter(j => j.status === 'pending').length,
        approved: allJobs.filter(j => j.status === 'approved').length,
        rejected: allJobs.filter(j => j.status === 'rejected').length,
        paused: allJobs.filter(j => j.status === 'paused').length
    };

    if (jobIds.length === 0) {
        return {
            companyName: company.name,
            companyStatus: company.status,
            jobs: jobStats,
            applications: { total: 0, submitted: 0, under_review: 0, interview: 0, accepted: 0, rejected: 0 },
            successRate: '0%',
            recentApplications: []
        };
    }

    const allApps = await prisma.application.findMany({
        where: { jobId: { in: jobIds } },
        select: { id: true, status: true, createdAt: true }
    });

    const appStats = {
        total: allApps.length,
        submitted: allApps.filter(a => a.status === 'submitted').length,
        under_review: allApps.filter(a => a.status === 'under_review').length,
        interview: allApps.filter(a => a.status === 'interview').length,
        accepted: allApps.filter(a => a.status === 'accepted').length,
        rejected: allApps.filter(a => a.status === 'rejected').length
    };

    const reviewed = appStats.accepted + appStats.rejected;
    const successRate = reviewed > 0
        ? `${Math.round((appStats.accepted / reviewed) * 100)}%`
        : '0%';

    const recent = await prisma.application.findMany({
        where: { jobId: { in: jobIds } },
        include: {
            user: { select: { fullName: true, email: true, avatarUrl: true } },
            job: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    return {
        companyName: company.name,
        companyStatus: company.status,
        jobs: jobStats,
        applications: appStats,
        successRate: successRate,
        recentApplications: recent.map(a => ({
            id: a.id,
            status: a.status,
            appliedAt: a.createdAt,
            candidate: { fullName: a.user?.fullName, email: a.user?.email, avatarUrl: a.user?.avatarUrl },
            jobTitle: a.job?.title
        }))
    };
};
