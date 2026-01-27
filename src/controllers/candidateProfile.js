const candidateService = require('../services/candidateService');

// get my profile 
exports.getMyProfile = async (req, res) => {
    try {
        const user_id = req.user.id;
        const profile = await candidateService.getProfile(user_id);

        if (!profile) {
            return res.status(404).json({ message: 'Profile không tồn tại' });
        }

        return res.status(200).json({
            status: 'success',
            data: profile
        });
    } catch (error) {
        console.error('Lỗi khi lấy thông tin profile:', error);
        return res.status(500).json({
            message: 'Lỗi server khi lấy thông tin profile',
            error: error.message
        });
    }
};

// update profile
exports.updateProfile = async (req, res) => {
    try {
        const user_id = req.user.id;
        const updateData = req.body;

        const updatedProfile = await candidateService.updateProfile(user_id, updateData);

        return res.status(200).json({
            message: 'Cập nhật thông tin thành công',
            data: updatedProfile
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật thông tin', error);
        
        // Handle specific business logic errors from service if needed (e.g. invalid phone/linkedin)
        if (error.message === 'Số điện thoại không hợp lệ' || error.message === 'LinkedIn URL không hợp lệ') {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({
            message: 'Lỗi server khi cập nhật thông tin',
            error: error.message
        });
    }
};

// delete specific profile fields
exports.deleteProfile = async (req, res) => {
    try {
        const user_id = req.user.id;
        
        // Lấy danh sách các trường cần xóa từ body
        // Client sẽ gửi dạng JSON: { "fields": ["bio", "website", "avatar_url"] }
        const { fields } = req.body;

        // Validation cơ bản: Kiểm tra xem fields có phải là mảng và có dữ liệu không
        if (!fields || !Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({ 
                message: 'Vui lòng cung cấp danh sách tên các trường cần xóa (dạng mảng)' 
            });
        }

        // Gọi service để xử lý logic xóa
        const updatedProfile = await candidateService.deleteProfile(user_id, fields);

        return res.status(200).json({
            message: 'Xóa thông tin thành công',
            data: updatedProfile
        });

    } catch (error) {
        console.error('Lỗi khi xóa thông tin profile:', error);
        
        // Bắt lỗi nếu người dùng gửi tên trường không hợp lệ (nếu service có throw lỗi này)
        if (error.message === 'Danh sách trường cần xóa không hợp lệ') {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({
            message: 'Lỗi server khi xóa thông tin profile',
            error: error.message
        });
    }
};




