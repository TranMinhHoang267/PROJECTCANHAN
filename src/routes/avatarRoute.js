const express = require('express');
const router = express.Router();
const avatarController = require('../controllers/avatarController');
const { protect, authorize } = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Chỉ chấp nhận file ảnh JPG, PNG, WEBP'), false);
        }
        cb(null, true);
    }
});

// POST   /api/avatar/upload  — Upload lần đầu
router.post(
    '/upload',
    protect,
    upload.single('avatar'),
    avatarController.uploadAvatar
);

// PUT    /api/avatar          — Cập nhật avatar mới
router.put(
    '/',
    protect,
    upload.single('avatar'),
    avatarController.updateAvatar
);

// DELETE /api/avatar          — Xóa avatar
router.delete(
    '/',
    protect,
    avatarController.deleteAvatar
);

module.exports = router;