const { User, sequelize } = require('../models'); // Import Model theo cách của bạn
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Định nghĩa thư mục lưu
const UPLOAD_DIR = path.join(__dirname, '../uploads/avatars');

// Tạo thư mục nếu chưa có
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Upload và cập nhật Avatar
 * @param {string} userId 
 * @param {Buffer} fileBuffer 
 */
exports.updateAvatar = async (userId, fileBuffer) => {
    let newFilePath = null; // Biến lưu đường dẫn file mới để tiện xóa nếu lỗi

    try {
        // 1. Tìm user để check tồn tại & lấy avatar cũ
        const currentUser = await User.findByPk(userId);
        if (!currentUser) {
            throw new Error('User không tồn tại');
        }

        // 2. Xử lý ảnh bằng Sharp (Resize 500x500 + WebP)
        const fileName = `avatar-${userId}-${Date.now()}.webp`;
        const savePath = path.join(UPLOAD_DIR, fileName);
        
        await sharp(fileBuffer)
            .resize(500, 500, { fit: 'cover', position: 'center' })
            .webp({ quality: 80 })
            .toFile(savePath);

        newFilePath = savePath; // Đánh dấu là đã tạo file này

        // 3. Đường dẫn lưu DB (Luôn dùng dấu / để chuẩn URL)
        const dbAvatarUrl = `/uploads/avatars/${fileName}`;

        // 4. Update Database
        await User.update(
            { avatar_url: dbAvatarUrl }, // Chú ý: tên cột trong DB bạn là avatar hay avatar_url? (check lại model)
            { where: { id: userId } }
        );

        // 5. Dọn dẹp: Xóa avatar CŨ (nếu có và file đó tồn tại)
        if (currentUser.avatar_url) {
            // Chuyển đường dẫn URL thành đường dẫn file hệ thống
            // Ví dụ: /uploads/avatars/abc.webp -> C:\project\uploads\avatars\abc.webp
            const oldFileName = path.basename(currentUser.avatar_url);
            const oldPath = path.join(UPLOAD_DIR, oldFileName);
            
            if (fs.existsSync(oldPath)) {
                try {
                    fs.unlinkSync(oldPath);
                } catch (err) {
                    console.error('Không thể xóa avatar cũ:', err);
                    // Không throw lỗi ở đây để tránh crash luồng chính
                }
            }
        }

        return dbAvatarUrl;

    } catch (error) {
        // --- ROLLBACK QUAN TRỌNG ---
        // Nếu lỗi DB (bước 4) hoặc logic khác, mà file mới đã lỡ tạo (bước 2)
        // Thì phải xóa file mới đi để không bị rác server
        if (newFilePath && fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath);
        }
        
        throw error;
    }
};