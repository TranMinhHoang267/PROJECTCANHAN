const ApplicationService = require('../services/ApplicationService');

// ==============================================================================
// HELPER ERROR
// ==============================================================================
const handleError = (res, error, context) => {
    console.error(`[ApplicationController] ${context}:`, error.message);
    const { message } = error;

    const NOT_FOUND  = ['Không tìm thấy đơn ứng tuyển.', 'CV không tồn tại hoặc không thuộc về bạn.', 'Công việc không tồn tại hoặc đã đóng tuyển.'];
    const BAD_REQUEST = ['Vui lòng chọn công việc muốn ứng tuyển.', 'Bạn đã nộp đơn ứng tuyển vị trí này rồi.', 'Công việc này đã hết hạn nộp hồ sơ.'];

    if (NOT_FOUND.includes(message))   return res.status(404).json({ message });
    if (BAD_REQUEST.includes(message)) return res.status(400).json({ message });
    return res.status(500).json({ message: `Lỗi server khi ${context}`, error: message });
};

// POST /api/applications
exports.applyJob = async (req, res) => {
    try {
        const data = await ApplicationService.applyJob(req.user.id, req.body);
        return res.status(201).json({ message: 'Nộp đơn ứng tuyển thành công!', data });
    } catch (error) {
        return handleError(res, error, 'nộp đơn ứng tuyển');
    }
};

// GET /api/applications
exports.getMyApplications = async (req, res) => {
    try {
        const data = await ApplicationService.getMyApplications(req.user.id, req.query);
        return res.status(200).json({ status: 'success', count: data.applications.length, data });
    } catch (error) {
        return handleError(res, error, 'lấy danh sách đơn ứng tuyển');
    }
};
