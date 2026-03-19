const avatarService = require('../services/avatar_service');

// ================================================================
// Upload avatar lần đầu
// ================================================================
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng chọn file ảnh hợp lệ'
            });
        }

        const userId = req.user.id;
        const newAvatarUrl = await avatarService.updateAvatar(userId, req.file.buffer);

        return res.status(200).json({
            status: 'success',
            message: 'Upload avatar thành công',
            data: { avatar_url: newAvatarUrl }
        });

    } catch (error) {
        console.error('Lỗi upload avatar:', error);

        if (error.message === 'User không tồn tại') {
            return res.status(404).json({
                status: 'error',
                message: 'User không tồn tại'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi upload avatar',
            error: error.message
        });
    }
};

// ================================================================
// Cập nhật avatar — logic giống Upload, dùng chung service
// ================================================================
exports.updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng chọn file ảnh hợp lệ'
            });
        }

        const userId = req.user.id;
        const newAvatarUrl = await avatarService.updateAvatar(userId, req.file.buffer);

        return res.status(200).json({
            status: 'success',
            message: 'Cập nhật avatar thành công',
            data: { avatar_url: newAvatarUrl }
        });

    } catch (error) {
        console.error('Lỗi cập nhật avatar:', error);

        if (error.message === 'User không tồn tại') {
            return res.status(404).json({
                status: 'error',
                message: 'User không tồn tại'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi cập nhật avatar',
            error: error.message
        });
    }
};

// ================================================================
// Xóa avatar
// ================================================================
exports.deleteAvatar = async (req, res) => {
    try {
        const userId = req.user.id;
        await avatarService.deleteAvatar(userId);

        return res.status(200).json({
            status: 'success',
            message: 'Xóa avatar thành công'
        });

    } catch (error) {
        console.error('Lỗi xóa avatar:', error);

        if (error.message === 'User không tồn tại') {
            return res.status(404).json({
                status: 'error',
                message: 'User không tồn tại'
            });
        }

        if (error.message === 'User chưa có avatar để xóa') {
            return res.status(400).json({
                status: 'error',
                message: 'User chưa có avatar để xóa'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi xóa avatar',
            error: error.message
        });
    }
};