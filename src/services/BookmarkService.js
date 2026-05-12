const prisma = require('../config/prisma');

exports.toggleBookmark = async (userId, jobId) => {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Công việc không tồn tại.');

    const existing = await prisma.bookmark.findFirst({ where: { userId, jobId } });

    if (existing) {
        await prisma.bookmark.delete({ where: { id: existing.id } });
        return { bookmarked: false, message: 'Đã bỏ lưu tin tuyển dụng.' };
    } else {
        await prisma.bookmark.create({ data: { userId, jobId } });
        return { bookmarked: true, message: 'Đã lưu tin tuyển dụng.' };
    }
};

exports.getBookmarks = async (userId, filters = {}) => {
    const pageSize = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const [count, bookmarks] = await Promise.all([
        prisma.bookmark.count({ where: { userId } }),
        prisma.bookmark.findMany({
            where: { userId },
            include: {
                job: {
                    select: {
                        id: true, title: true, location: true, jobType: true,
                        salaryMin: true, salaryMax: true, deadline: true, status: true,
                        company: { select: { name: true, logoUrl: true, city: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    return {
        total_items: count,
        total_pages: Math.ceil(count / pageSize),
        current_page: pageNumber,
        bookmarks: bookmarks.map(b => ({
            bookmarkId: b.id,
            savedAt: b.createdAt,
            job: b.job
        }))
    };
};
