const prisma = require('../config/prisma');

exports.getJobDetail = async (jobId) => {
    const job = await prisma.job.findFirst({
        where: {
            id: jobId,
            status: 'approved'
        },
        include: {
            company: {
                select: {
                    id: true, name: true, logoUrl: true, city: true,
                    address: true, website: true, size: true, description: true
                }
            },
            skills: {
                include: { skill: { select: { id: true, name: true } } }
            }
        }
    });

    if (!job) {
        throw new Error('Không tìm thấy tin tuyển dụng hoặc tin đã bị khóa/gỡ bỏ.');
    }

    job.skills = job.skills.map(js => js.skill);
    return job;
};

exports.getCompanyDetail = async (companyId) => {
    const company = await prisma.company.findFirst({
        where: { id: companyId, status: 'approved' },
        select: {
            id: true, name: true, description: true, website: true,
            logoUrl: true, address: true, city: true, size: true,
            createdAt: true,
            jobs: {
                where: { status: 'approved' },
                select: {
                    id: true, title: true, location: true,
                    salaryMin: true, salaryMax: true,
                    jobType: true, createdAt: true, deadline: true, jobLevel: true
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!company) throw new Error('Không tìm thấy thông tin công ty hoặc công ty chưa được duyệt.');

    return {
        company,
        active_jobs: company.jobs
    };
};
