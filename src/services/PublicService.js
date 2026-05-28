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

exports.getAllJobs = async (filters = {}) => {
    const limit = parseInt(filters.limit) || 10;
    const search = filters.search?.trim();
    const companyId = filters.companyId;

    const andConditions = [
        { status: 'approved' },
        {
            OR: [
                { deadline: { gt: new Date() } },
                { deadline: null }
            ]
        }
    ];

    if (companyId) {
        andConditions.push({ companyId });
    }

    if (search) {
        andConditions.push({
            OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { company: { name: { contains: search, mode: 'insensitive' } } }
            ]
        });
    }

    const jobs = await prisma.job.findMany({
        where: { AND: andConditions },
        include: {
            company: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    city: true
                }
            },
            skills: {
                include: { skill: { select: { id: true, name: true } } }
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: limit
    });

    return jobs.map(job => {
        const skillsMapped = job.skills.map(js => js.skill);
        return {
            ...job,
            skills: skillsMapped
        };
    });
};

exports.getAllCompanies = async (filters = {}) => {
    const limit = parseInt(filters.limit) || 10;
    const search = filters.search?.trim();

    const where = {
        status: 'approved'
    };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } }
        ];
    }

    const companies = await prisma.company.findMany({
        where,
        select: {
            id: true,
            name: true,
            description: true,
            logoUrl: true,
            city: true,
            size: true,
            website: true
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: limit
    });

    return companies;
};