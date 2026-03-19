const path = require('path');
const fs = require('fs');
const { Resume, sequelize } = require('../models');

// Thư mục lưu file PDF
const UPLOAD_DIR = path.join(__dirname, '../uploads/resumes');

// Tạo thư mục nếu chưa có
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ==============================================================================
// 1. UPLOAD CV MỚI
// ==============================================================================
/**
 * Lưu metadata của file CV vào DB sau khi multer đã lưu file vào disk
 * @param {string} userId
 * @param {{ originalname, filename, size }} file  — object từ multer
 */
exports.uploadResume = async (userId, file) => {
    const fileUrl = `/uploads/resumes/${file.filename}`;
    const fileSizeKB = Math.round(file.size / 1024);

    // Đếm số CV hiện tại để tự đặt is_default nếu đây là CV đầu tiên
    const count = await Resume.count({ where: { user_id: userId } });

    const resume = await Resume.create({
        user_id:   userId,
        file_name: file.originalname,
        file_url:  fileUrl,
        file_size: fileSizeKB,
        is_default: count === 0   // CV đầu tiên → mặc định là default
    });

    return resume;
};

// ==============================================================================
// 2. LẤY DANH SÁCH CV
// ==============================================================================
exports.getResumes = async (userId) => {
    return await Resume.findAll({
        where: { user_id: userId },
        order: [
            ['is_default', 'DESC'],  // CV default lên đầu
            ['created_at', 'DESC']
        ],
        attributes: ['id', 'file_name', 'file_url', 'file_size', 'is_default', 'created_at']
    });
};

// ==============================================================================
// 3. ĐẶT CV LÀM DEFAULT
// ==============================================================================
exports.setDefault = async (userId, resumeId) => {
    const t = await sequelize.transaction();
    try {
        // Bỏ default tất cả CV hiện tại của user
        await Resume.update(
            { is_default: false },
            { where: { user_id: userId }, transaction: t }
        );

        // Đặt default cho CV được chọn (đồng thời verify CV đó thuộc về user này)
        const [updated] = await Resume.update(
            { is_default: true },
            { where: { id: resumeId, user_id: userId }, transaction: t }
        );

        if (!updated) {
            throw new Error('Không tìm thấy CV hoặc bạn không có quyền thay đổi.');
        }

        await t.commit();
        return await Resume.findByPk(resumeId);
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// ==============================================================================
// 4. XÓA CV
// ==============================================================================
exports.deleteResume = async (userId, resumeId) => {
    const resume = await Resume.findOne({ where: { id: resumeId, user_id: userId } });

    if (!resume) {
        throw new Error('Không tìm thấy CV hoặc bạn không có quyền xóa.');
    }

    // Xóa file vật lý trên disk
    const filePath = path.join(__dirname, '..', resume.file_url);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            console.error('Không thể xóa file CV:', err.message);
        }
    }

    await resume.destroy();

    // Nếu CV bị xóa là default thì tự động set CV mới nhất còn lại làm default
    if (resume.is_default) {
        const latest = await Resume.findOne({
            where: { user_id: userId },
            order: [['created_at', 'DESC']]
        });
        if (latest) {
            await latest.update({ is_default: true });
        }
    }

    return true;
};

// ==============================================================================
// 5. LẤY ĐƯỜNG DẪN FILE ĐỂ STREAM (PDF VIEWER)
// ==============================================================================
/**
 * Trả về absolute path của file PDF để controller dùng res.sendFile()
 */
exports.getFilePath = async (userId, resumeId) => {
    const resume = await Resume.findOne({ where: { id: resumeId, user_id: userId } });
    if (!resume) {
        throw new Error('Không tìm thấy CV hoặc bạn không có quyền xem.');
    }
    const filePath = path.join(__dirname, '..', resume.file_url);
    if (!fs.existsSync(filePath)) {
        throw new Error('File CV không tồn tại trên server.');
    }
    return { filePath, fileName: resume.file_name };
};
