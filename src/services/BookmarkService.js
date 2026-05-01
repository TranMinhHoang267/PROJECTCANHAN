const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================================
// 1. TOGGLE LƯU / BỎ LƯU TIN TUYỂN DỤNG
// ==============================================================================
exports.toggleBookmark = async (userId, jobId) => {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Công việc không tồn tại.');

    const existing = await prisma.bookmark.findFirst({ where: { user_id: userId, job_id: jobId } });

    if (existing) {
        await prisma.bookmark.delete({ where: { id: existing.id } });
        return { bookmarked: false, message: 'Đã bỏ lưu tin tuyển dụng.' };
    } else {
        await prisma.bookmark.create({ data: { user_id: userId, job_id: jobId } });
        return { bookmarked: true, message: 'Đã lưu tin tuyển dụng.' };
    }
};

// ==============================================================================
// 2. DANH SÁCH TIN ĐÃ LƯU
// ==============================================================================
exports.getBookmarks = async (userId, filters = {}) => {
    const pageSize   = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip       = (pageNumber - 1) * pageSize;

    const [count, bookmarks] = await Promise.all([
        prisma.bookmark.count({ where: { user_id: userId } }),
        prisma.bookmark.findMany({
            where: { user_id: userId },
            include: {
                job: {
                    select: { id: true, title: true, location: true, job_type: true,
                              salary_min: true, salary_max: true, deadline: true, status: true,
                        company: { select: { name: true, logo_url: true, city: true } }
                    }
                }
            },
            orderBy: { created_at: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    return {
        total_items:  count,
        total_pages:  Math.ceil(count / pageSize),
        current_page: pageNumber,
        bookmarks:    bookmarks.map(b => ({
            bookmark_id: b.id,
            saved_at:    b.created_at,
            job:         b.job
        }))
    };
};
