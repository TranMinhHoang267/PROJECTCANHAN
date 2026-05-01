const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

    // Đếm số CV hiện tại để tự đặt is_default nếu đây là CV đầu tiên
    const count = await prisma.resume.count({ where: { user_id: userId } });

    const fileUrl = `/uploads/resumes/${file.filename}`;
    const fileSizeKB = Math.round(file.size / 1024);

    const resume = await prisma.resume.create({
        data: {
            user_id:   userId,
            title: file.originalname,
            file_url:  fileUrl,
            file_size: fileSizeKB,
            is_default: count === 0   // CV đầu tiên → mặc định là default
        }
    });

    return resume;
};

// ==============================================================================
// 2. LẤY DANH SÁCH CV
// ==============================================================================
exports.getResumes = async (userId) => {
    return await prisma.resume.findMany({
        where: { user_id: userId },
        orderBy: [
            { is_default: 'desc' },  // CV default lên đầu
            { created_at: 'desc' }
        ],
        select: { id: true, title: true, file_url: true, file_size: true, is_default: true, created_at: true }
    });
};

// ==============================================================================
// 3. ĐẶT CV LÀM DEFAULT
// ==============================================================================
exports.setDefault = async (userId, resumeId) => {
    // Bỏ default tất cả CV hiện tại của user
    await prisma.resume.updateMany({
        where: { user_id: userId },
        data: { is_default: false }
    });

    // Đặt default cho CV được chọn (đồng thời verify CV đó thuộc về user này)
    const updated = await prisma.resume.updateMany({
        where: { id: resumeId, user_id: userId },
        data: { is_default: true }
    });

    if (updated.count === 0) {
        throw new Error('Không tìm thấy CV hoặc bạn không có quyền thay đổi.');
    }

    return await prisma.resume.findUnique({ where: { id: resumeId } });
};

// ==============================================================================
// 4. XÓA CV
// ==============================================================================
exports.deleteResume = async (userId, resumeId) => {
    const resume = await prisma.resume.findFirst({ where: { id: resumeId, user_id: userId } });

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

    await prisma.resume.delete({ where: { id: resumeId } });

    // Nếu CV bị xóa là default thì tự động set CV mới nhất còn lại làm default
    if (resume.is_default) {
        const latest = await prisma.resume.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });
        if (latest) {
            await prisma.resume.update({
                where: { id: latest.id },
                data: { is_default: true }
            });
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
    const resume = await prisma.resume.findFirst({ where: { id: resumeId, user_id: userId } });
    if (!resume) {
        throw new Error('Không tìm thấy CV hoặc bạn không có quyền xem.');
    }
    const filePath = path.join(__dirname, '..', resume.file_url);
    if (!fs.existsSync(filePath)) {
        throw new Error('File CV không tồn tại trên server.');
    }
    return { filePath, fileName: resume.title };
};
