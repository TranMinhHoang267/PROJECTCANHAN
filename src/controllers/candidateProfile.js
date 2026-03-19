const candidateService = require('../services/candidateService');

// ================================================================
// GET profile
// ================================================================
exports.getMyProfile = async (req, res) => {
    try {
        const user_id = req.user.id;
        const profile = await candidateService.getProfile(user_id);

        if (!profile) {
            return res.status(404).json({
                status: 'error',
                message: 'Profile không tồn tại'
            });
        }

        return res.status(200).json({
            status: 'success',
            data: profile
        });

    } catch (error) {
        console.error('Lỗi khi lấy thông tin profile:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi lấy thông tin profile',
            error: error.message
        });
    }
};

// ================================================================
// UPDATE profile
// ================================================================
exports.updateProfile = async (req, res) => {
    try {
        const user_id = req.user.id;
        const updateData = req.body;

        const updatedProfile = await candidateService.updateProfile(user_id, updateData);

        return res.status(200).json({
            status: 'success',
            message: 'Cập nhật thông tin thành công',
            data: updatedProfile
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật thông tin:', error);

        // Khớp đúng message từ service
        if (
            error.message === 'Số điện thoại không hợp lệ' ||
            error.message === 'LinkedIn URL không hợp lệ cần thêm https://'
        ) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi cập nhật thông tin',
            error: error.message
        });
    }
};

// ================================================================
// DELETE specific profile fields
// ================================================================
exports.deleteProfile = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { fields } = req.body;

        if (!fields || !Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng cung cấp danh sách tên các trường cần xóa (dạng mảng)'
            });
        }

        const updatedProfile = await candidateService.deleteProfile(user_id, fields);

        return res.status(200).json({
            status: 'success',
            message: 'Xóa thông tin thành công',
            data: updatedProfile
        });

    } catch (error) {
        console.error('Lỗi khi xóa thông tin profile:', error);

        if (
            error.message === 'Danh sách trường cần xóa không hợp lệ' ||
            error.message === 'Không có trường hợp lệ nào để xóa'
        ) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi xóa thông tin profile',
            error: error.message
        });
    }
};