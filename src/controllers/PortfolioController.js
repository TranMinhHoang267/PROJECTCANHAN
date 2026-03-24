const PortfolioService = require('../services/PortfolioService');

// ==============================================================================
// HELPER: Xử lý lỗi chung
// ==============================================================================
const handleError = (res, error, context) => {
    console.error(`Lỗi ${context}:`, error);
    const { message } = error;

    if (message === 'Hồ sơ ứng viên không tồn tại. Vui lòng tạo hồ sơ chung trước.')
        return res.status(404).json({ status: 'error', message });

    if (message === 'Không tìm thấy dữ liệu hoặc bạn không có quyền sửa.' ||
        message === 'Không tìm thấy dữ liệu để xóa.'                      ||
        message === 'Kỹ năng không tồn tại trong hồ sơ của bạn.')          // ← Thêm
        return res.status(404).json({ status: 'error', message });

    if (message.includes('không được để trống') || message.includes('phải sau'))
        return res.status(400).json({ status: 'error', message });

    if (message === 'Dữ liệu gửi lên phải là danh sách (Mảng).')
        return res.status(400).json({ status: 'error', message });

    return res.status(500).json({ 
        status: 'error',
        message: `Lỗi server khi ${context}`, 
        error: message 
    });
};

// ==============================================================================
// 1. ĐỌC THÔNG TIN PORTFOLIO
// ==============================================================================

// GET /api/portfolio
exports.getFullProfile = async (req, res) => {
    try {
        const data = await PortfolioService.getFullProfile(req.user.id);
        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return handleError(res, error, 'lấy hồ sơ');
    }
};

// GET /api/portfolio/experiences
exports.getExperiences = async (req, res) => {
    try {
        const data = await PortfolioService.getExperiences(req.user.id);
        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return handleError(res, error, 'lấy danh sách kinh nghiệm');
    }
};

// GET /api/portfolio/educations
exports.getEducations = async (req, res) => {
    try {
        const data = await PortfolioService.getEducations(req.user.id);
        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return handleError(res, error, 'lấy danh sách học vấn');
    }
};

// GET /api/portfolio/skills
exports.getSkills = async (req, res) => {
    try {
        const data = await PortfolioService.getSkills(req.user.id);
        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return handleError(res, error, 'lấy danh sách kỹ năng');
    }
};

// ==============================================================================
// 2. QUẢN LÝ KINH NGHIỆM (EXPERIENCE)
// ==============================================================================

// POST /api/portfolio/experiences
exports.createExperience = async (req, res) => {
    try {
        const data = await PortfolioService.createExperience(req.user.id, req.body);
        return res.status(201).json({ message: 'Thêm kinh nghiệm thành công', data });
    } catch (error) {
        return handleError(res, error, 'thêm kinh nghiệm');
    }
};

// PUT /api/portfolio/experiences/:id
exports.updateExperience = async (req, res) => {
    try {
        const data = await PortfolioService.updateExperience(req.user.id, req.params.id, req.body);
        return res.status(200).json({ message: 'Cập nhật kinh nghiệm thành công', data });
    } catch (error) {
        return handleError(res, error, 'cập nhật kinh nghiệm');
    }
};

// DELETE /api/portfolio/experiences/:id
exports.deleteExperience = async (req, res) => {
    try {
        await PortfolioService.deleteExperience(req.user.id, req.params.id);
        return res.status(200).json({ message: 'Xóa kinh nghiệm thành công' });
    } catch (error) {
        return handleError(res, error, 'xóa kinh nghiệm');
    }
};

// DELETE /api/portfolio/experiences
exports.deleteAllExperiences = async (req, res) => {
    try {
        await PortfolioService.deleteAllExperiences(req.user.id);
        return res.status(200).json({ message: 'Xóa tất cả kinh nghiệm thành công' });
    } catch (error) {
        return handleError(res, error, 'xóa tất cả kinh nghiệm');
    }
};

// ==============================================================================
// 3. QUẢN LÝ HỌC VẤN (EDUCATION)
// ==============================================================================

// POST /api/portfolio/educations
exports.createEducation = async (req, res) => {
    try {
        const data = await PortfolioService.createEducation(req.user.id, req.body);
        return res.status(201).json({ message: 'Thêm học vấn thành công', data });
    } catch (error) {
        return handleError(res, error, 'thêm học vấn');
    }
};

// PUT /api/portfolio/educations/:id
exports.updateEducation = async (req, res) => {
    try {
        const data = await PortfolioService.updateEducation(req.user.id, req.params.id, req.body);
        return res.status(200).json({ message: 'Cập nhật học vấn thành công', data });
    } catch (error) {
        return handleError(res, error, 'cập nhật học vấn');
    }
};

// DELETE /api/portfolio/educations/:id
exports.deleteEducation = async (req, res) => {
    try {
        await PortfolioService.deleteEducation(req.user.id, req.params.id);
        return res.status(200).json({ message: 'Xóa học vấn thành công' });
    } catch (error) {
        return handleError(res, error, 'xóa học vấn');
    }
};

// DELETE /api/portfolio/educations
exports.deleteAllEducations = async (req, res) => {
    try {
        await PortfolioService.deleteAllEducations(req.user.id);
        return res.status(200).json({ message: 'Xóa tất cả học vấn thành công' });
    } catch (error) {
        return handleError(res, error, 'xóa tất cả học vấn');
    }
};

// ==============================================================================
// 4. QUẢN LÝ KỸ NĂNG (SKILLS)
// ==============================================================================

// PUT /api/portfolio/skills
exports.updateSkills = async (req, res) => {
    try {
        const { skills } = req.body;
        if (!skills || !Array.isArray(skills)) {
            return res.status(400).json({ 
                status: 'error',
                message: 'Vui lòng cung cấp danh sách kỹ năng (dạng mảng)' 
            });
        }
        const data = await PortfolioService.updateSkills(req.user.id, skills);
        return res.status(200).json({ 
            status: 'success',
            message: 'Cập nhật kỹ năng thành công', 
            data 
        });
    } catch (error) {
        return handleError(res, error, 'cập nhật kỹ năng');
    }
};

// DELETE /api/portfolio/skills/:id
exports.deleteSkill = async (req, res) => {
    try {
        await PortfolioService.deleteSkill(req.user.id, req.params.id);
        return res.status(200).json({ 
            status: 'success',
            message: 'Xóa kỹ năng thành công' 
        });
    } catch (error) {
        return handleError(res, error, 'xóa kỹ năng');
    }
};
