const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const uploadResumeConfig        = require('../middleware/uploadResumes');
const { protect, authorize }    = require('../middleware/authMiddleware');
const ResumeController          = require('../controllers/ResumeController');
const { ROLES }                 = require('../constants/roles');

// ==============================================================================
// MIDDLEWARE: Tất cả routes đều cần xác thực + phân quyền candidate
// ==============================================================================
router.use(protect);
router.use(authorize(ROLES.CANDIDATE));

// ==============================================================================
// ROUTES
// ==============================================================================

/**
 * @route   POST /api/resumes/upload
 * @desc    Upload file CV (PDF)
 * @body    form-data: { cv: <file.pdf> }
 * @access  Private
 */

// POST /api/resumes/upload — Upload file CV (PDF)
router.post('/upload',
    uploadResumeConfig.single('cv'),
    ResumeController.uploadResume
);

/**
 * @route   GET /api/resumes
 * @desc    Lấy danh sách tất cả CV của user
 * @access  Private
 */

// GET /api/resumes — Lấy danh sách CV
router.get('/',
    ResumeController.getResumes
);

/**
 * @route   PATCH /api/resumes/:id/default
 * @desc    Đặt CV làm CV mặc định (CV chính)
 * @access  Private
 */

// PATCH /api/resumes/:id/default — Đặt CV làm mặc định
router.patch('/:id/default',
    ResumeController.setDefault
);

/**
 * @route   DELETE /api/resumes/:id
 * @desc    Xóa một CV
 * @access  Private
 */

// DELETE /api/resumes/:id — Xóa CV
router.delete('/:id',
    ResumeController.deleteResume
);

// ==============================================================================
// XỬ LÝ LỖI MULTER
// ==============================================================================
router.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                status: 'error',
                message: 'File quá lớn. Tối đa 5MB.' 
            });
        }
        return res.status(400).json({ 
            status: 'error',
            message: `Lỗi upload: ${err.message}` 
        });
    }

    if (err.message === 'Chỉ chấp nhận file PDF!') {
        return res.status(400).json({ 
            status: 'error',
            message: err.message 
        });
    }

    if (err.message.includes('tối đa 3 CV')) {
        return res.status(400).json({ 
            status: 'error',
            message: err.message 
        });
    }

    return res.status(500).json({ 
        status: 'error',
        message: 'Lỗi server', 
        error: err.message 
    });
});

module.exports = router;