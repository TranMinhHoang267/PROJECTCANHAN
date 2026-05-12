const prisma = require('../config/prisma');
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
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!currentUser) throw new Error('User không tồn tại');

        const fileName = `avatar-${userId}-${Date.now()}.webp`;
        const savePath = path.join(UPLOAD_DIR, fileName);

        await sharp(fileBuffer)
            .resize(500, 500, { fit: 'cover', position: 'center' })
            .webp({ quality: 80 })
            .toFile(savePath);

        newFilePath = savePath;

        const dbAvatarUrl = `/uploads/avatars/${fileName}`;

        await prisma.user.update({
            where: { id: userId },
            data: { avatarUrl: dbAvatarUrl }
        });

        if (currentUser.avatarUrl && currentUser.avatarUrl.startsWith('/uploads/')) {
            const oldFileName = path.basename(currentUser.avatarUrl);
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
        if (newFilePath && fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath);
        }
        throw error;
    }
};

exports.deleteAvatar = async (userId) => {
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) throw new Error('User không tồn tại');

    if (!currentUser.avatarUrl) throw new Error('User chưa có avatar để xóa');

    if (currentUser.avatarUrl.startsWith('/uploads/')) {
        const oldFileName = path.basename(currentUser.avatarUrl);
        const oldPath = path.join(UPLOAD_DIR, oldFileName);

        if (fs.existsSync(oldPath)) {
            try {
                fs.unlinkSync(oldPath);
            } catch (err) {
                console.error('Không thể xóa file avatar:', err);
            }
        }
    }

    await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: null }
    });

    return true;
};
