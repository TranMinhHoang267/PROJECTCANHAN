const express = require('express');
const router = express.Router();
const PortfolioController = require('../controllers/PortfolioController');
const { protect } = require('../middleware/authMiddleware');    

// ==============================================================================
// MIDDLEWARE: Tất cả routes đều cần authentication
// ==============================================================================
router.use(protect);

// ==============================================================================
// 1. ROUTES ĐỌC THÔNG TIN (READ)
// ==============================================================================

/**
 * @route   GET /api/portfolio
 * @desc    Lấy toàn bộ hồ sơ (bao gồm experiences, educations, skills)
 * @access  Private (Yêu cầu đăng nhập)
 */
router.get('/', PortfolioController.getFullProfile);

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
// 2. ROUTES QUẢN LÝ KINH NGHIỆM (EXPERIENCE)
// ==============================================================================

/**
 * @route   POST /api/portfolio/experiences
 * @desc    Thêm kinh nghiệm mới
 * @body    { company_name, position, start_date, end_date?, description? }
 * @access  Private
 */
router.post('/experiences', PortfolioController.createExperience);

/**
 * @route   PUT /api/portfolio/experiences/:id
 * @desc    Cập nhật kinh nghiệm
 * @params  id - ID của kinh nghiệm
 * @body    { company_name?, position?, start_date?, end_date?, description? }
 * @access  Private
 */
router.put('/experiences/:id', PortfolioController.updateExperience);

/**
 * @route   DELETE /api/portfolio/experiences/:id
 * @desc    Xóa một kinh nghiệm
 * @params  id - ID của kinh nghiệm
 * @access  Private
 */
router.delete('/experiences/:id', PortfolioController.deleteExperience);

/**
 * @route   DELETE /api/portfolio/experiences
 * @desc    Xóa tất cả kinh nghiệm (cẩn thận!)
 * @access  Private
 */
router.delete('/experiences', PortfolioController.deleteAllExperiences);

// ==============================================================================
// 3. ROUTES QUẢN LÝ HỌC VẤN (EDUCATION)
// ==============================================================================

/**
 * @route   POST /api/portfolio/educations
 * @desc    Thêm học vấn mới
 * @body    { school_name, degree, start_date, end_date? }
 * @access  Private
 */
router.post('/educations', PortfolioController.createEducation);

/**
 * @route   PUT /api/portfolio/educations/:id
 * @desc    Cập nhật học vấn
 * @params  id - ID của học vấn
 * @body    { school_name?, degree?, start_date?, end_date? }
 * @access  Private
 */
router.put('/educations/:id', PortfolioController.updateEducation);

/**
 * @route   DELETE /api/portfolio/educations/:id
 * @desc    Xóa một học vấn
 * @params  id - ID của học vấn
 * @access  Private
 */
router.delete('/educations/:id', PortfolioController.deleteEducation);

/**
 * @route   DELETE /api/portfolio/educations
 * @desc    Xóa tất cả học vấn (cẩn thận!)
 * @access  Private
 */
router.delete('/educations', PortfolioController.deleteAllEducations);

// ==============================================================================
// 4. ROUTES QUẢN LÝ KỸ NĂNG (SKILLS)
// ==============================================================================

/**
 * @route   PUT /api/portfolio/skills
 * @desc    Cập nhật toàn bộ danh sách kỹ năng (thay thế hoàn toàn)
 * @body    { skills: ["JavaScript", "Node.js", "React"] }
 * @access  Private
 * @note    Sử dụng PUT vì thao tác này thay thế toàn bộ danh sách
 */
router.put('/skills', PortfolioController.updateSkills);

/**
 * @route   DELETE /api/portfolio/skills/:id
 * @desc    Xóa một kỹ năng
 * @params  id - ID của kỹ năng
 * @access  Private
 */
router.delete('/skills/:id', PortfolioController.deleteSkill);
// /**
//  * @route   DELETE /api/portfolio/skills
//  * @desc    Xóa tất cả kỹ năng (cẩn thận!)
//  * @access  Private
//  */
// router.delete('/skills', PortfolioController.deleteAllSkills);

module.exports = router;