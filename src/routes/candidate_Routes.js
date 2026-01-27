const express = require('express');
const router = express.Router();
const  candidate_profile = require('../controllers/candidateProfile');  
const { protect } = require('../middleware/authMiddleware');

router.get('/profile', protect, candidate_profile.getMyProfile);
router.put('/profile', protect, candidate_profile.updateProfile);
router.delete('/profile', protect, candidate_profile.deleteProfile);

module.exports = router;