const express           = require('express');
const router            = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { ROLES }         = require('../constants/roles');
const EmployerController = require('../controllers/EmployerController');
const uploadLogoConfig  = require('../middleware/logoCompany');
const multer            = require('multer');
router.use(protect);
router.use(authorize(ROLES.RECRUITER));

// PROFILE
//router.post('/profile', EmployerController.createCompany);
router.get('/',  EmployerController.getMyCompany);
router.put('/',  EmployerController.updateCompany);

// LOGO
router.put('/logo',
    uploadLogoConfig.single('logo'),
    EmployerController.updateLogo
);
router.delete('/logo', EmployerController.deleteLogo);

// Xử lý lỗi Multer
router.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ status: 'error', message: 'File quá lớn. Tối đa 5MB.' });
        }
        return res.status(400).json({ status: 'error', message: `Lỗi upload: ${err.message}` });
    }
    if (err.message === 'Chỉ chấp nhận file ảnh!') {
        return res.status(400).json({ status: 'error', message: err.message });
    }
    return res.status(500).json({ status: 'error', message: 'Lỗi server', error: err.message });
});

module.exports = router;