const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get all users except sensitive fields
 * @returns {Promise<Array>} List of users
 */
exports.getAllUsers = async (filters = {}) => {
    const {
        role,
        is_active,
        page  = 1,
        limit = 10,
        keyword
    } = filters;

    const pageSize   = Math.min(50, Math.max(1, parseInt(limit)));
    const pageNumber = Math.max(1, parseInt(page));
    const skip       = (pageNumber - 1) * pageSize;

    // Build where clause
    const where = {};
    if (role)                        where.role      = role;
    if (is_active !== undefined)     where.is_active = is_active === 'true';

    // Tìm kiếm theo tên hoặc email
    if (keyword) {
        const key = keyword.trim();
        where.OR = [
            { full_name: { contains: key, mode: 'insensitive' } },
            { email:     { contains: key, mode: 'insensitive' } },
            { phone:     { contains: key, mode: 'insensitive' } }
        ];
    }

    const [count, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            select: { id: true, email: true, full_name: true, role: true, phone: true,
                      avatar_url: true, is_active: true, created_at: true, updated_at: true },
            orderBy: { created_at: 'desc' },
            take: pageSize,
            skip
        })
    ]);

    return {
        total_items:  count,
        total_pages:  Math.ceil(count / pageSize),
        current_page: pageNumber,
        users
    };
};

/**
 * Delete a user by ID
 * @param {string} id - User ID
 * @returns {Promise<boolean>} True if deleted, throws error if not found
 */
exports.deleteUser = async (id) => {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User không tồn tại');
    if (user.role === 'admin') throw new Error('Không thể xóa tài khoản Admin.');
    await prisma.user.delete({ where: { id } });
    return true;
};

/**
 * Khóa hoặc Mở khóa tài khoản (toggle is_active)
 * @param {string} id - User ID
 */
exports.toggleLockUser = async (id) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, full_name: true, email: true, role: true, is_active: true }
    });
    if (!user) throw new Error('User không tồn tại');
    if (user.role === 'admin') throw new Error('Không thể khóa tài khoản Admin.');

    const newStatus = !user.is_active; // Toggle
    await prisma.user.update({
        where: { id },
        data: { is_active: newStatus }
    });

    return {
        id:        user.id,
        full_name: user.full_name,
        email:     user.email,
        role:      user.role,
        is_active: newStatus,
        message:   newStatus ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.'
    };
};
