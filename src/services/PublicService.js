const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================================
// 1. LẤY CHI TIẾT 1 CÔNG VIỆC (PUBLIC)
// ==============================================================================
exports.getJobDetail = async (jobId) => {
    const job = await prisma.job.findFirst({
        where: { 
            id: jobId, 
            status: 'approved' // Khách chỉ thấy job đã duyệt
        },
        include: {
            company: {
                select: {
                    id: true, name: true, logo_url: true, city: true,
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

    // Transform skills to match old Sequelize format
    job.skills = job.skills.map(js => js.skill);
    return job;
};

// ==============================================================================
// 2. LẤY CHI TIẾT THÔNG TIN 1 CÔNG TY VÀ CÁC JOB CỦA HỌ (PUBLIC)
// ==============================================================================
exports.getCompanyDetail = async (companyId) => {
    const company = await prisma.company.findFirst({
        where: { id: companyId, status: 'approved' },
        select: {
            id: true, name: true, description: true, website: true,
            logo_url: true, address: true, city: true, size: true,
            created_at: true,
            jobs: {
                where: { status: 'approved' },
                select: {
                    id: true, title: true, location: true,
                    salary_min: true, salary_max: true,
                    job_type: true, created_at: true, deadline: true, job_level: true
                },
                orderBy: { created_at: 'desc' }
            }
        }
    });

    if (!company) throw new Error('Không tìm thấy thông tin công ty hoặc công ty chưa được duyệt.');

    return {
        company,
        active_jobs: company.jobs
    };
};
