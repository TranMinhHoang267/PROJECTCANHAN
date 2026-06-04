const prisma = require('../config/prisma');

exports.searchJobs = async (filters) => {
    const {
        keyword, location, jobType, jobLevel,
        // salaryMin / salaryMax — dải lương (đơn vị VNĐ)
        // negotiable = 'true' — chỉ lọc job "Thỏa thuận" (salaryMin IS NULL AND salaryMax IS NULL)
        salaryMin, salaryMax, negotiable,
        page = 1, limit = 10
    } = filters;

    const pageSize   = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const pageNumber = Math.max(1, parseInt(page) || 1);
    const skip       = (pageNumber - 1) * pageSize;

    // ─── Build AND array (all conditions combined) ────────────────────────────
    const andConditions = [];

    // 1. Chỉ lấy job đã duyệt
    andConditions.push({ status: 'approved' });

    // 2. Deadline chưa hết hoặc không giới hạn
    andConditions.push({
        OR: [
            { deadline: { gt: new Date() } },
            { deadline: null }
        ]
    });

    // 3. Keyword — tìm theo title, company name, skill name
    if (keyword) {
        const key = keyword.trim();
        andConditions.push({
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
        });
    }

    // 4. Location — tìm theo job.location (ưu tiên) hoặc company.city (phụ)
    //    KHÔNG dùng company.address vì đó là địa chỉ đăng ký công ty,
    //    có thể khác với địa điểm thực tế của job
    if (location) {
        const loc = location.trim();
        andConditions.push({
            OR: [
                { location: { contains: loc, mode: 'insensitive' } },
                {
                    AND: [
                        { location: null },          // chỉ fallback khi job không có location riêng
                        { company: { city: { contains: loc, mode: 'insensitive' } } }
                    ]
                }
            ]
        });
    }

    // 5. Job Type (case-insensitive contains để tránh lỗi format không khớp)
    if (jobType) {
        andConditions.push({
            jobType: { contains: jobType.trim(), mode: 'insensitive' }
        });
    }

    // 6. Job Level (case-insensitive contains)
    if (jobLevel) {
        andConditions.push({
            jobLevel: { contains: jobLevel.trim(), mode: 'insensitive' }
        });
    }

    // 7. Salary filter
    // Trường hợp 1: chỉ lọc "Thỏa thuận" (cả salaryMin và salaryMax đều NULL)
    if (negotiable === 'true') {
        andConditions.push({ salaryMin: null, salaryMax: null });
    }
    // Trường hợp 2: lọc theo dải lương
    else if (salaryMin || salaryMax) {
        const minNum = salaryMin ? parseInt(salaryMin) : null;
        const maxNum = salaryMax ? parseInt(salaryMax) : null;

        if (minNum !== null && maxNum !== null) {
            // Dải cụ thể: lấy job có khoảng lương giao nhau với [minNum, maxNum]
            // Điều kiện giao nhau: job.salaryMax >= minNum AND job.salaryMin <= maxNum
            andConditions.push({
                OR: [
                    // Job có lương cụ thể và khoảng giao nhau
                    {
                        AND: [
                            { salaryMin: { not: null } },
                            { salaryMax: { not: null } },
                            { salaryMax: { gte: minNum } },
                            { salaryMin: { lte: maxNum } }
                        ]
                    },
                    // Job chỉ có salaryMin (không có max): salaryMin nằm trong khoảng
                    {
                        AND: [
                            { salaryMin: { not: null } },
                            { salaryMax: null },
                            { salaryMin: { gte: minNum } },
                            { salaryMin: { lte: maxNum } }
                        ]
                    }
                ]
            });
        } else if (minNum !== null) {
            // Chỉ có salaryMin ("Trên X triệu"):
            // Lấy job có salaryMax >= minNum HOẶC salaryMin >= minNum (job không có max)
            andConditions.push({
                OR: [
                    { salaryMax: { gte: minNum } },
                    {
                        AND: [
                            { salaryMax: null },
                            { salaryMin: { gte: minNum } }
                        ]
                    }
                ]
            });
        } else if (maxNum !== null) {
            // Chỉ có salaryMax ("Dưới X triệu"):
            // Lấy job có salaryMin <= maxNum HOẶC job thỏa thuận (salaryMin null)
            andConditions.push({
                OR: [
                    { salaryMin: { lte: maxNum } },
                    { salaryMin: null }
                ]
            });
        }
    }

    const where = { AND: andConditions };

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
        jobs:         transformedJobs
    };
};