const { Company, User, Job } = require('../models');
const {Op} = require('sequelize');

// ==============================================================================
// 1. DANH SÁCH CÔNG TY CẦN DUYỆT (status = pending)
// ==============================================================================
exports.getPendingCompanies = async (filters = {}) => {
    const pageSize   = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
    const pageNumber = Math.max(1, parseInt(filters.page) || 1);
    const offset     = (pageNumber - 1) * pageSize;

    const { count, rows } = await Company.findAndCountAll({
        where: { status: 'pending' },
        include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'phone', 'created_at']
        }],
        order:    [['created_at', 'ASC']], // FIFO
        limit:    pageSize,
        offset,
        distinct: true
    });

    return {
        total_items:  count,
        total_pages:  Math.ceil(count / pageSize),
        current_page: pageNumber,
        companies:    rows
    };
};




// ==============================================================================
// 2. DANH SÁCH TẤT CẢ CÔNG TY (lọc theo status)
// ==============================================================================
exports.getAllCompanies = async (filters = {}) => {
    const {
        status,
        keyword,
        page  = 1,
        limit = 10
    } = filters;

    const pageSize   = Math.min(50, Math.max(1, parseInt(limit)));
    const pageNumber = Math.max(1, parseInt(page));
    const offset     = (pageNumber - 1) * pageSize;

    const where = {};
    if (status) where.status = status;

    // Tìm kiếm theo tên công ty hoặc thành phố
    if (keyword) {
        where[Op.or] = [
            { name: { [Op.substring]: keyword.trim() } },
            { city: { [Op.substring]: keyword.trim() } }
        ];
    }

    const { count, rows } = await Company.findAndCountAll({
        where,
        include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'phone']
        }],
        order:    [['created_at', 'DESC']],
        limit:    pageSize,
        offset,
        distinct: true
    });

    return {
        total_items:  count,
        total_pages:  Math.ceil(count / pageSize),
        current_page: pageNumber,
        companies:    rows
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

    const company = await Company.findByPk(companyId);
    if (!company) throw new Error('Công ty không tồn tại.');

    if (company.status !== 'pending') {
        throw new Error(`Công ty này đã được xử lý (trạng thái hiện tại: ${company.status}).`);
    }

    await company.update({
        status:           action,
        rejection_reason: action === 'rejected' ? reason.trim() : null
    });

    return await Company.findByPk(companyId, {
        include: [{ model: User, as: 'user', attributes: ['full_name', 'email'] }]
    });
};
