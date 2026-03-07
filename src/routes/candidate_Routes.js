const express = require('express');
const router = express.Router();
const candidate_profile = require('../controllers/candidateProfile');  
const { protect } = require('../middleware/authMiddleware');


router.use(protect);

router.get('/profile', candidate_profile.getMyProfile);
router.put('/profile', candidate_profile.updateProfile);
router.delete('/profile', candidate_profile.deleteProfile);


module.exports = router;