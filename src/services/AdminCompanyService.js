const prisma = require('../config/prisma');

exports.getPendingCompanies = async (filters = {}) => {
    const pageSize = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const [count, companies] = await Promise.all([
        prisma.company.count({ where: { status: 'pending' } }),
        prisma.company.findMany({
            where: { status: 'pending' },
            include: {
                user: {
                    select: { id: true, fullName: true, email: true, phone: true, createdAt: true }
                }
            },
            orderBy: { createdAt: 'asc' },
            take: pageSize,
            skip
        })
    ]);

    return {
        total_items: count,
        total_pages: Math.ceil(count / pageSize),
        current_page: pageNumber,
        companies
    };
};

exports.getAllCompanies = async (filters = {}) => {
    const {
        status,
        keyword,
        page = 1,
        limit = 10
    } = filters;

    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const pageNumber = Math.max(1, parseInt(page));
    const skip = (pageNumber - 1) * pageSize;

    const where = {};
    if (status) where.status = status;

    if (keyword) {
        where.OR = [
            { name: { contains: keyword.trim(), mode: 'insensitive' } },
            { city: { contains: keyword.trim(), mode: 'insensitive' } }
        ];
    }

    const [count, companies] = await Promise.all([
        prisma.company.count({ where }),
        prisma.company.findMany({
            where,
            include: {
                user: {
                    select: { id: true, fullName: true, email: true, phone: true }
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
        companies
    };
};

exports.reviewCompany = async (companyId, action, reason) => {
    if (!['approved', 'rejected'].includes(action)) {
        throw new Error('Hành động không hợp lệ. Chỉ chấp nhận: approved hoặc rejected.');
    }
    if (action === 'rejected' && !reason?.trim()) {
        throw new Error('Vui lòng cung cấp lý do từ chối.');
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error('Công ty không tồn tại.');

    if (company.status !== 'pending') {
        throw new Error(`Công ty này đã được xử lý (trạng thái hiện tại: ${company.status}).`);
    }

    await prisma.company.update({
        where: { id: companyId },
        data: {
            status: action,
            rejectionReason: action === 'rejected' ? reason.trim() : null
        }
    });

    return await prisma.company.findUnique({
        where: { id: companyId },
        include: { user: { select: { fullName: true, email: true } } }
    });
};
