const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ApplicationController = require('../controllers/ApplicationController');

router.use(protect);

/**
 * @route   POST /api/applications
 * @desc    Nộp đơn ứng tuyển một công việc
 * @body    { jobId, resumeId?, coverLetter? }
 * @access  Private
 */
router.post('/', ApplicationController.applyJob);

/**
 * @route   GET /api/applications
 * @desc    Danh sách tất cả đơn ứng tuyển + trạng thái tiến trình
 * @access  Private
 */
router.get('/', ApplicationController.getMyApplications);

module.exports = router;
