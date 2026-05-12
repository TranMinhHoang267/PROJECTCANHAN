const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { ROLES } = require("../constants/roles");
const JobManagementController = require("../controllers/JobManagementController");

router.use(protect);
router.use(authorize(ROLES.RECRUITER));

// ==============================================================================
// QUẢN LÝ TIN ĐĂNG - Per API.md
// ==============================================================================

/**
 * @route   POST /api/employer/jobs
 * @desc    Đăng tin tuyển dụng mới (trạng thái: pending)
 * @body    { title, description?, requirements?, benefits?, salaryMin?, salaryMax?,
 *            location?, jobType?, jobLevel?, deadline?, skills?: string[] }
 */
router.post("/", JobManagementController.createJob);

/**
 * @route   GET /api/employer/jobs?status=pending|approved|rejected|paused
 * @desc    Danh sách tất cả tin đăng của công ty (có thể lọc theo status)
 */
router.get("/", JobManagementController.getMyJobs);

/**
 * @route   PATCH /api/employer/jobs/:id/toggle-pause
 * @desc    Tạm dừng (approved → paused) hoặc Mở lại (paused → approved)
 */
router.patch("/:id/toggle-pause", JobManagementController.togglePauseJob);

module.exports = router;
