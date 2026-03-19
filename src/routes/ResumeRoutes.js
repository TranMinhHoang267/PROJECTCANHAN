const express  = require('express');
const router    = express.Router();
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const { protect, authorize } = require('../middleware/authMiddleware');
const ResumeController = require('../controllers/ResumeController');
const {ROLES} = require('../constants/roles');
// ==============================================================================
// CẤU HÌNH MULTER — Lưu file PDF vào disk
// ==============================================================================
const UPLOAD_DIR = path.join(__dirname, '../uploads/resumes');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        // Đặt tên file: resume-<timestamp>-<random>.pdf để tránh trùng
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `resume-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file PDF!'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,  // Tối đa 5MB
        files: 1                     // Mỗi lần upload 1 file
    }
});

// ==============================================================================
// MIDDLEWARE: Tất cả routes đều cần xác thực
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

router.post('/upload', 
    upload.single('cv'),
    ResumeController.uploadResume 
)
/**
 * @route   GET /api/resumes
 * @desc    Lấy danh sách tất cả CV của user
 * @access  Private
 */
router.get('/',
    ResumeController.getResumes
);

/**
 * @route   PATCH /api/resumes/:id/default
 * @desc    Đặt CV làm CV mặc định (CV chính)
 * @access  Private
 */
router.patch('/:id/default',
    ResumeController.setDefault
);

/**
 * @route   GET /api/resumes/:id/view
 * @desc    Xem trước CV (stream PDF — dùng cho PDF Viewer)
 * @access  Private
 */
router.get('/:id/view', 
    ResumeController.viewResume
)

/**
 * @route   DELETE /api/resumes/:id
 * @desc    Xóa một CV
 * @access  Private
 */
router.delete('/:id',
    ResumeController.deleteResume
);
// ==============================================================================
// XỬ LÝ LỖI MULTER (file quá lớn, sai định dạng...)
// ==============================================================================
router.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File quá lớn. Tối đa 5MB.' });
        }
        return res.status(400).json({ message: `Lỗi upload: ${err.message}` });
    }
    if (err.message === 'Chỉ chấp nhận file PDF!') {
        return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
});

module.exports = router;
