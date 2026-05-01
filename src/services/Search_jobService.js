const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.searchJobs = async (filters) => {
    const { 
        keyword, location, job_type, job_level, salary,
        page = 1, limit = 10 
    } = filters;

    const pageSize = parseInt(limit);
    const pageNumber = parseInt(page);
    const skip = (pageNumber - 1) * pageSize;

    // Build where conditions
    const where = {
        status: 'approved'
    };

    // Keyword: search in title, company name, or skill name
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

    // Location: search in job location, company city, or company address
    if (location) {
        const escapedLoc = location.trim();
        where.OR = [
            { location: { contains: escapedLoc, mode: 'insensitive' } },
            { company: { city: { contains: escapedLoc, mode: 'insensitive' } } },
            { company: { address: { contains: escapedLoc, mode: 'insensitive' } } }
        ];
    }

    if (job_type)  where.job_type = job_type;
    if (job_level) where.job_level = job_level;
    if (salary)    where.salary_max = { gte: parseInt(salary) };

    // Get total count and jobs in parallel
    const [count, jobs] = await Promise.all([
        prisma.job.count({ where }),
        prisma.job.findMany({
            where,
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                        logo_url: true,
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
            orderBy: { created_at: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    // Transform skills to match old Sequelize format
    const transformedJobs = jobs.map(job => ({
        ...job,
        skills: job.skills.map(js => js.skill)
    }));

    return {
        total_items: count,
        total_pages: Math.ceil(count / pageSize),
        current_page: pageNumber,
        jobs: transformedJobs
    };
};
