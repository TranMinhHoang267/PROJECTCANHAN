const { User } = require('../models');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../uploads/avatars');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

exports.updateAvatar = async (userId, fileBuffer) => {
    let newFilePath = null;

    try {
        // 1. Tìm user
        const currentUser = await User.findByPk(userId);
        if (!currentUser) throw new Error('User không tồn tại');

        // 2. Xử lý ảnh bằng Sharp
        const fileName = `avatar-${userId}-${Date.now()}.webp`;
        const savePath = path.join(UPLOAD_DIR, fileName);

        await sharp(fileBuffer)
            .resize(500, 500, { fit: 'cover', position: 'center' })
            .webp({ quality: 80 })
            .toFile(savePath);

        newFilePath = savePath;

        // 3. Đường dẫn lưu DB
        const dbAvatarUrl = `/uploads/avatars/${fileName}`;

        // 4. Update Database
        await User.update(
            { avatar_url: dbAvatarUrl },
            { where: { id: userId } }
        );

        // 5. Xóa avatar cũ — chỉ xóa nếu là file local, không phải URL ngoài
        if (currentUser.avatar_url && currentUser.avatar_url.startsWith('/uploads/')) {
            const oldFileName = path.basename(currentUser.avatar_url);
            const oldPath = path.join(UPLOAD_DIR, oldFileName);

            if (fs.existsSync(oldPath)) {
                try {
                    fs.unlinkSync(oldPath);
                } catch (err) {
                    console.error('Không thể xóa avatar cũ:', err);
                }
            }
        }

        return dbAvatarUrl;

    } catch (error) {
        // Rollback: xóa file mới nếu lỡ tạo
        if (newFilePath && fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath);
        }
        throw error;
    }
};

// Xóa avatar
exports.deleteAvatar = async (userId) => {
    const currentUser = await User.findByPk(userId);
    if (!currentUser) throw new Error('User không tồn tại');

    if (!currentUser.avatar_url) throw new Error('User chưa có avatar để xóa');

    // Xóa file local nếu có
    if (currentUser.avatar_url.startsWith('/uploads/')) {
        const oldFileName = path.basename(currentUser.avatar_url);
        const oldPath = path.join(UPLOAD_DIR, oldFileName);

        if (fs.existsSync(oldPath)) {
            try {
                fs.unlinkSync(oldPath);
            } catch (err) {
                console.error('Không thể xóa file avatar:', err);
            }
        }
    }

    // Set avatar_url về null trong DB
    await User.update(
        { avatar_url: null },
        { where: { id: userId } }
    );

    return true;
};
