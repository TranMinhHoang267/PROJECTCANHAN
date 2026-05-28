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

/**
 * @route   GET /api/applications/:id
 * @desc    Chi tiết một đơn ứng tuyển
 * @access  Private
 */
router.get('/:id', ApplicationController.getApplicationDetail);

/**
 * @route   DELETE /api/applications/:id/rejected
 * @desc    Xóa đơn ứng tuyển đã bị từ chối (chỉ khi status = "rejected")
 * @access  Private
 */
router.delete('/:id/rejected', ApplicationController.deleteRejectedApplication); 


/**
 * @route   DELETE /api/applications/:id
 * @desc    Rút đơn ứng tuyển (chỉ khi status = "submitted")
 * @access  Private
 */
router.delete('/:id', ApplicationController.withdrawApplication);

/**
 * @route   GET /api/applications/job/:jobId/previous
 * @desc    Lấy đơn ứng tuyển đã rút trước đó
 * @access  Private
 */
router.get('/job/:jobId/previous', ApplicationController.getPreviousApplication);

module.exports = router;
