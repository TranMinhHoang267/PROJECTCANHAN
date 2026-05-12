const prisma = require('../config/prisma');

exports.getAllUsers = async (filters = {}) => {
    const {
        role,
        is_active,
        page = 1,
        limit = 10,
        keyword
    } = filters;

    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const pageNumber = Math.max(1, parseInt(page));
    const skip = (pageNumber - 1) * pageSize;

    const where = {};
    if (role) where.role = role;
    if (is_active !== undefined) where.isActive = is_active === 'true';

    if (keyword) {
        const key = keyword.trim();
        where.OR = [
            { fullName: { contains: key, mode: 'insensitive' } },
            { email: { contains: key, mode: 'insensitive' } },
            { phone: { contains: key, mode: 'insensitive' } }
        ];
    }

    const [count, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            select: {
                id: true, email: true, fullName: true, role: true, phone: true,
                avatarUrl: true, isActive: true, createdAt: true, updatedAt: true
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
        users
    };
};

exports.deleteUser = async (id) => {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User không tồn tại');
    if (user.role === 'admin') throw new Error('Không thể xóa tài khoản Admin.');
    await prisma.user.delete({ where: { id } });
    return true;
};

exports.toggleLockUser = async (id) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, fullName: true, email: true, role: true, isActive: true }
    });
    if (!user) throw new Error('User không tồn tại');
    if (user.role === 'admin') throw new Error('Không thể khóa tài khoản Admin.');

    const newStatus = !user.isActive;
    await prisma.user.update({
        where: { id },
        data: { isActive: newStatus }
    });

    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: newStatus,
        message: newStatus ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.'
    };
};
