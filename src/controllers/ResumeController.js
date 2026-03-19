const ResumeService = require('../services/ResumeService');

// ==============================================================================
// HELPER: Xử lý lỗi chung
// ==============================================================================
const handleError = (res, error, context) => {
    console.error(`Lỗi [${context}]:`, error);
    const { message } = error;

    if (
        message === 'Không tìm thấy CV hoặc bạn không có quyền thay đổi.' ||
        message === 'Không tìm thấy CV hoặc bạn không có quyền xóa.'     ||
        message === 'Không tìm thấy CV hoặc bạn không có quyền xem.'
    ) 
    {
        return res.status(404).json({ status: 'error', message });
    }
    // 404 — File tồn tại trong DB nhưng mất trên disk
    if (message === 'File CV không tồn tại trên server.') {
        return res.status(404).json({ 
            status: 'error', 
            message: 'File CV không tồn tại trên server. Vui lòng upload lại.' 
        });
    }
    
    return res.status(500).json({ message: `Lỗi server khi ${context}`, error: message });
};

// ==============================================================================
// 1. UPLOAD CV
// POST /api/resumes/upload
// ==============================================================================
exports.uploadResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn file PDF để upload.' });
        }
        const data = await ResumeService.uploadResume(req.user.id, req.file);
        return res.status(201).json({ status: 'success', 
        message: 'Upload CV thành công', data });
    } 
    catch (error) {
        return handleError(res, error, 'upload CV');
    }
};

// ==============================================================================
// 2. LẤY DANH SÁCH CV
// GET /api/resumes
// ==============================================================================
exports.getResumes = async (req, res) => {
    try {
        const data = await ResumeService.getResumes(req.user.id);
        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return handleError(res, error, 'lấy danh sách CV');
    }
};

// ==============================================================================
// 3. ĐẶT CV LÀM DEFAULT
// PATCH /api/resumes/:id/default
// ==============================================================================
exports.setDefault = async (req, res) => {
    try {
        const data = await ResumeService.setDefault(req.user.id, req.params.id);
        return res.status(200).json({ status: 'success', message: 'Đặt CV mặc định thành công', data });
    } catch (error) {
        return handleError(res, error, 'đặt CV mặc định');
    }
};

// ==============================================================================
// 4. XÓA CV
// DELETE /api/resumes/:id
// ==============================================================================
exports.deleteResume = async (req, res) => {
    try {
        await ResumeService.deleteResume(req.user.id, req.params.id);
        return res.status(200).json({status: 'success', message: 'Xóa CV thành công' });
    } catch (error) {
        return handleError(res, error, 'xóa CV');
    }
};

// ==============================================================================
// 5. XEM TRƯỚC CV (STREAM PDF)
// GET /api/resumes/:id/view
// ==============================================================================
exports.viewResume = async (req, res) => {
    try {
        const { filePath, fileName } = await ResumeService.getFilePath(req.user.id, req.params.id);

        // Đặt header để browser hiển thị inline (PDF Viewer thay vì download)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);

        return res.sendFile(filePath);
    } catch (error) {
        return handleError(res, error, 'xem CV');
    }
};
