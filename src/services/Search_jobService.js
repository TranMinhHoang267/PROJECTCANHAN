const prisma = require('../config/prisma');

exports.searchJobs = async (filters) => {
    const {
        keyword, location, jobType, jobLevel, salary,
        page = 1, limit = 10
    } = filters;

    const pageSize = parseInt(limit);
    const pageNumber = parseInt(page);
    const skip = (pageNumber - 1) * pageSize;

    const where = {
        status: 'approved'
    };

    if (keyword) {
        const escapedKey = keyword.trim();
        where.OR = [
            { title: { contains: escapedKey, mode: 'insensitive' } },
            { company: { name: { contains: escapedKey, mode: 'insensitive' } } },
            {
                skills: {
                    some: {
                        skill: {
                            name: { contains: escapedKey, mode: 'insensitive' }
                        }
                    }
                }
            }
        ];
    }

    if (location) {
        const escapedLoc = location.trim();
        where.OR = where.OR || [];
        where.OR.push(
            { location: { contains: escapedLoc, mode: 'insensitive' } },
            { company: { city: { contains: escapedLoc, mode: 'insensitive' } } },
            { company: { address: { contains: escapedLoc, mode: 'insensitive' } } }
        );
    }

    if (jobType) where.jobType = jobType;
    if (jobLevel) where.jobLevel = jobLevel;
    if (salary) where.salaryMax = { gte: parseInt(salary) };

    const [count, jobs] = await Promise.all([
        prisma.job.count({ where }),
        prisma.job.findMany({
            where,
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        city: true,
                        address: true
                    }
                },
                skills: {
                    include: {
                        skill: {
                            select: { id: true, name: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    const transformedJobs = jobs.map(job => ({
        id: job.id,
        title: job.title,
        location: job.location,
        jobType: job.jobType,
        jobLevel: job.jobLevel,
        benefits: job.benefits,
        description: job.description,
        requirements: job.requirements,
        skills: job.skills.map(js => js.skill),
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        deadline: job.deadline,
        company: job.company
    }));

    return {
        total_items: count,
        total_pages: Math.ceil(count / pageSize),
        current_page: pageNumber,
        jobs: transformedJobs
    };
};
