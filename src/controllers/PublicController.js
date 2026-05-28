const publicService = require('../services/PublicService');

// Đưa ra ngoài dùng chung cho cả 2 hàm
const NOT_FOUND_ERRORS = [
    'Không tìm thấy tin tuyển dụng hoặc tin đã bị khóa/gỡ bỏ.',
    'Không tìm thấy thông tin công ty hoặc công ty chưa được duyệt.'
];

const handleError = (res, error, context) => {
    console.error(`Lỗi API ${context}:`, error);
    if (NOT_FOUND_ERRORS.includes(error.message)) {
        return res.status(404).json({ status: 'error', message: error.message });
    }
    return res.status(500).json({
        status: 'error',
        message: 'Lỗi server nội bộ',
        error: error.message
    });
};

exports.getJobDetail = async (req, res) => {
    try {
        const result = await publicService.getJobDetail(req.params.id);
        return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        return handleError(res, error, 'lấy chi tiết tin tuyển dụng');
    }
};

exports.getCompanyDetail = async (req, res) => {
    try {
        const result = await publicService.getCompanyDetail(req.params.id);
        return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        return handleError(res, error, 'lấy chi tiết công ty');
    }
};

exports.getAllJobs = async (req, res) => {
    try {
        const filters = {
            limit: parseInt(req.query.limit) || 10,
            search: req.query.search || null,
            companyId: req.query.companyId || null
        };
        const result = await publicService.getAllJobs(filters);
        return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        return handleError(res, error, 'lấy danh sách tin tuyển dụng');
    }
};

exports.getAllCompanies = async (req, res) => {
    try {
        const filters = {
            limit: parseInt(req.query.limit) || 10,
            search: req.query.search || null
        };
        const result = await publicService.getAllCompanies(filters);
        return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        return handleError(res, error, 'lấy danh sách công ty');
    }
};