const avatarService = require('../services/avatar.service');

exports.uploadAvatar = async (req, res) => {
    try {
        // 1. Validate file từ Multer
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn file ảnh hợp lệ' });
        }

        const userId = req.user.id; // Lấy từ token

        // 2. Gọi Service
        // req.file.buffer có được nhờ cấu hình memoryStorage bên multer
        const newAvatarUrl = await avatarService.updateAvatar(userId, req.file.buffer);

        return res.status(200).json({
            status: 'success',
            message: 'Cập nhật avatar thành công',
            data: {
                avatar_url: newAvatarUrl
            }
        });

    } catch (error) {
        console.error('Lỗi upload avatar:', error);
        return res.status(500).json({
            message: 'Lỗi server khi upload avatar',
            error: error.message
        });
    }
};
