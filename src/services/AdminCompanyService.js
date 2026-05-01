const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================================
// 1. DANH SÁCH CÔNG TY CẦN DUYỆT (status = pending)
// ==============================================================================
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
                    select: { id: true, full_name: true, email: true, phone: true, created_at: true }
                }
            },
            orderBy: { created_at: 'asc' }, // FIFO
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

// ==============================================================================
// 2. DANH SÁCH TẤT CẢ CÔNG TY (lọc theo status)
// ==============================================================================
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

    // Tìm kiếm theo tên công ty hoặc thành phố
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
                    select: { id: true, full_name: true, email: true, phone: true }
                }
            },
            orderBy: { created_at: 'desc' },
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

// ==============================================================================
// 3. DUYỆT CÔNG TY (approved / rejected)
// ==============================================================================
/**
 * @param {string} companyId
 * @param {'approved' | 'rejected'} action
 * @param {string} [reason] - Lý do từ chối (bắt buộc khi rejected)
 */
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
            rejection_reason: action === 'rejected' ? reason.trim() : null
        }
    });

    return await prisma.company.findUnique({
        where: { id: companyId },
        include: { user: { select: { full_name: true, email: true } } }
    });
};
