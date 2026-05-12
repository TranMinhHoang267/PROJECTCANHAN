const express = require('express');
const router = express.Router();
const PortfolioController = require('../controllers/PortfolioController');
const { protect } = require('../middleware/authMiddleware');    

// ==============================================================================
// MIDDLEWARE: Tất cả routes đều cần authentication
// ==============================================================================
router.use(protect);

// ==============================================================================
// 1. ROUTES ĐỌC THÔNG TIN (READ) - Per API.md
// ==============================================================================

/**
 * @route   GET /api/portfolio/experiences
 * @desc    Lấy danh sách kinh nghiệm
 * @access  Private
 */
router.get('/experiences', PortfolioController.getExperiences);

/**
 * @route   GET /api/portfolio/educations
 * @desc    Lấy danh sách học vấn
 * @access  Private
 */
router.get('/educations', PortfolioController.getEducations);

/**
 * @route   GET /api/portfolio/skills
 * @desc    Lấy danh sách kỹ năng
 * @access  Private
 */
router.get('/skills', PortfolioController.getSkills);

// ==============================================================================
// 2. ROUTES QUẢN LÝ KINH NGHIỆM (EXPERIENCE) - Per API.md
// ==============================================================================

/**
 * @route   POST /api/portfolio/experiences
 * @desc    Thêm kinh nghiệm mới
 * @body    { company, title, startDate, endDate?, description? }
 * @access  Private
 */
router.post('/experiences', PortfolioController.createExperience);

// ==============================================================================
// 3. ROUTES QUẢN LÝ HỌC VẤN (EDUCATION) - Per API.md
// ==============================================================================

/**
 * @route   POST /api/portfolio/educations
 * @desc    Thêm học vấn mới
 * @body    { school, degree, field?, startDate, endDate? }
 * @access  Private
 */
router.post('/educations', PortfolioController.createEducation);

// ==============================================================================
// 4. ROUTES QUẢN LÝ KỸ NĂNG (SKILLS) - Per API.md
// ==============================================================================

/**
 * @route   PUT /api/portfolio/skills
 * @desc    Cập nhật toàn bộ danh sách kỹ năng (thay thế hoàn toàn)
 * @body    { skills: ["JavaScript", "Node.js", "React"] }
 * @access  Private
 * @note    Sử dụng PUT vì thao tác này thay thế toàn bộ danh sách
 */
router.put('/skills', PortfolioController.updateSkills);

module.exports = router;