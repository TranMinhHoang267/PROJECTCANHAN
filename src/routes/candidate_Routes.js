const express = require('express');
const router = express.Router();
const candidate_profile = require('../controllers/candidateProfile');  
const { protect, authorize } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
// Chỉ candidate mới được cập nhật
router.use(protect);
router.use(authorize(ROLES.CANDIDATE));


router.get('/profile', candidate_profile.getMyProfile);
router.put('/profile', candidate_profile.updateProfile);

module.exports = router;