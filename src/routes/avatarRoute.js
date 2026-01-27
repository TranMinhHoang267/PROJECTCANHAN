const express = require('express');
const router = express.Router();
const avatarController = require('../controllers/avatarController');
const { uploadAvatarConfig } = require('../config/multer');


// Middleware xác thực (đảm bảo file auth.middleware.js của bạn đã đúng)
// const { verifyToken } = require('../middlewares/auth.middleware'); 
// Tạm thời mình comment verifyToken, bạn nhớ bỏ comment khi test xong nhé
const { protect } = require('../middleware/authMiddleware');


// Định nghĩa API: POST /api/avatar/upload
router.post('/upload', 
    protect, // <--- QUAN TRỌNG: Phải đặt biến 'protect' vào đây thì mới chặn được user chưa login
    uploadAvatarConfig.single('avatar'), 
    avatarController.uploadAvatar
);

module.exports = router;