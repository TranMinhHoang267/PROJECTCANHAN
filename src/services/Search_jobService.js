const prisma = require('../config/prisma');

exports.searchJobs = async (filters) => {
    const {
        keyword, location, jobType, jobLevel, salary,
        page = 1, limit = 10
    } = filters;

    const pageSize   = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const pageNumber = Math.max(1, parseInt(page) || 1);
    const skip       = (pageNumber - 1) * pageSize;

    // ✅ Khởi tạo where đúng Prisma
    const where = {
        status: 'approved',
        OR: [
            { deadline: { gt: new Date() } },
            { deadline: null }
        ]
    };

    // ✅ Keyword — tìm theo title, company name, skill name
    if (keyword) {
        const key = keyword.trim();
        where.AND = [
            ...(where.AND || []),
            {
                OR: [
                    { title:   { contains: key, mode: 'insensitive' } },
                    { company: { name: { contains: key, mode: 'insensitive' } } },
                    {
                        skills: {
                            some: {
                                skill: { name: { contains: key, mode: 'insensitive' } }
                            }
                        }
                    }
                ]
            }
        ];
    }

    // ✅ Location — tìm theo location, city, address
    if (location) {
        const loc = location.trim();
        where.AND = [
            ...(where.AND || []),
            {
                OR: [
                    { location: { contains: loc, mode: 'insensitive' } },
                    { company:  { city:    { contains: loc, mode: 'insensitive' } } },
                    { company:  { address: { contains: loc, mode: 'insensitive' } } }
                ]
            }
        ];
    }

    if (jobType)  where.jobType   = jobType;
    if (jobLevel) where.jobLevel  = jobLevel;
    if (salary)   where.salaryMax = { gte: parseInt(salary) };

    const [count, jobs] = await Promise.all([
        prisma.job.count({ where }),
        prisma.job.findMany({
            where,
            include: {
                company: {
                    select: {
                        id:       true,
                        name:     true,
                        logoUrl:  true,
                        city:     true,
                        address:  true
                    }
                },
                skills: {
                    include: {
                        skill: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    // ✅ Dùng jobs đã transform, không dùng rows
    const transformedJobs = jobs.map(job => ({
        id:           job.id,
        title:        job.title,
        location:     job.location,
        jobType:      job.jobType,
        jobLevel:     job.jobLevel,
        benefits:     job.benefits,
        description:  job.description,
        requirements: job.requirements,
        skills:       job.skills.map(js => js.skill),
        salaryMin:    job.salaryMin,
        salaryMax:    job.salaryMax,
        deadline:     job.deadline,
        company:      job.company
    }));

    return {
        total_items:  count,
        total_pages:  Math.ceil(count / pageSize),
        current_page: pageNumber,
        jobs:         transformedJobs  // ✅ dùng transformedJobs thay vì rows
    };
};