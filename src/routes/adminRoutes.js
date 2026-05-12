const express = require('express');
const router = express.Router();
const { getAllUsers, deleteUser, toggleLockUser } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

router.use(protect);
router.use(authorize(ROLES.ADMIN));

/**
 * @route  GET  /api/admin/users?role=candidate|recruiter&is_active=true|false
 * @desc   Lấy danh sách tất cả user (có thể lọc theo role, trạng thái)
 */
router.get('/', getAllUsers);

/**
 * @route  PATCH /api/admin/users/:id/toggle-lock
 * @desc   Khóa hoặc Mở khóa tài khoản (toggle is_active)
 */
router.patch('/:id/toggle-lock', toggleLockUser);

/**
 * @route  DELETE /api/admin/users/:id
 * @desc   Xóa vĩnh viễn tài khoản (không thể xóa Admin)
 */
router.delete('/:id', deleteUser);

module.exports = router;

