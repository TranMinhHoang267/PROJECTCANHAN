const multer = require('multer');

// Cấu hình lưu tạm vào RAM (Memory Storage)
const storage = multer.memoryStorage();

// Bộ lọc chỉ chấp nhận file ảnh
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh!'), false);
    }
};

const uploadAvatarConfig = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn 5MB
});

module.exports = { uploadAvatarConfig };