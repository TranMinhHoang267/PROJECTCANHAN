const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================================
// 1. CÁC HÀM HỖ TRỢ DÙNG CHUNG (PRIVATE HELPERS)
// ==============================================================================

// Dùng cho tất cả CRUD — không join User
const _getProfile = async (userId) => {
    const profile = await prisma.candidate_profile.findUnique({ where: { user_id: userId } });
    if (!profile) throw new Error('Hồ sơ ứng viên không tồn tại. Vui lòng tạo hồ sơ chung trước.');
    return profile;
};

// Chỉ dùng cho getFullProfile — có join User
const _getProfileWithUser = async (userId) => {
    const profile = await prisma.candidate_profile.findUnique({
        where: { user_id: userId },
        include: { user: { select: { full_name: true, avatar_url: true } } }
    });
    if (!profile) throw new Error('Hồ sơ ứng viên không tồn tại. Vui lòng tạo hồ sơ chung trước.');
    return profile;
};

// Helper: Validate Experience data
const _validateExperience = (data) => {
    const { company, title, start_date, description } = data;

    if (!company?.trim()) throw new Error('Tên công ty không được để trống');
    if (!title?.trim()) throw new Error('Vị trí công việc không được để trống');
    if (!start_date) throw new Error('Ngày bắt đầu không được để trống');
    if (!description?.trim()) throw new Error('Mô tả không được để trống');

    // Validate logic: end_date phải sau start_date
    if (data.end_date && new Date(data.end_date) < new Date(start_date)) {
        throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
    }
};

// Helper: Validate Education data
const _validateEducation = (data) => {
    const { school, degree, start_date } = data;

    if (!school?.trim()) throw new Error('Tên trường học không được để trống');
    if (!degree?.trim()) throw new Error('Bằng cấp không được để trống');
    if (!start_date) throw new Error('Ngày bắt đầu không được để trống');

    if (data.end_date && new Date(data.end_date) < new Date(start_date)) {
        throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
    }
};

// ==============================================================================
// 2. LOGIC NGHIỆP VẤ CHÍNH - ĐỌC THÔNG TIN (READ)
// ==============================================================================

// Lấy toàn bộ hồ sơ của user (bao gồm experiences, educations, skills)
exports.getFullProfile = async (userId) => {
    const profile = await _getProfileWithUser(userId);

    const [experiences, educations, skills] = await Promise.all([
        prisma.experience.findMany({
            where: { profile_id: profile.id },
            orderBy: { start_date: 'desc' }
        }),
        prisma.education.findMany({
            where: { profile_id: profile.id },
            orderBy: { start_date: 'desc' }
        }),
        exports.getSkills(userId)
    ]);

    return {
        // chỉ lấy tên và avatar
        full_name: profile.user?.full_name,
        avatar_url: profile.user?.avatar_url,
        experiences,
        educations,
        skills
    };
};

// Lấy danh sách kinh nghiệm
exports.getExperiences = async (userId) => {
    const profile = await _getProfile(userId);
    return await prisma.experience.findMany({
        where: { profile_id: profile.id },
        orderBy: { start_date: 'desc' }
    });
};

// Lấy danh sách học vấn
exports.getEducations = async (userId) => {
    const profile = await _getProfile(userId);
    return await prisma.education.findMany({
        where: { profile_id: profile.id },
        orderBy: { start_date: 'desc' }
    });
};

// Lấy danh sách kỹ năng
exports.getSkills = async (userId) => {
    const profile = await _getProfile(userId);
    const profileWithSkills = await prisma.candidate_profile.findUnique({
        where: { id: profile.id },
        include: { skills: { include: { skill: true } } }
    });
    return (profileWithSkills?.skills || []).map(cs => cs.skill);
};

// ==============================================================================
// 3. QUẢN LÝ KINH NGHIỆM (EXPERIENCE)
// ==============================================================================

exports.createExperience = async (userId, data) => {
    _validateExperience(data);
    const profile = await _getProfile(userId);
    return await prisma.experience.create({
        data: { ...data, profile_id: profile.id }
    });
};

exports.updateExperience = async (userId, expId, data) => {
    _validateExperience(data);
    const profile = await _getProfile(userId);

    const updated = await prisma.experience.updateMany({
        where: { id: expId, profile_id: profile.id },
        data
    });

    if (updated.count === 0) throw new Error('Không tìm thấy dữ liệu hoặc bạn không có quyền sửa.');
    return await prisma.experience.findUnique({ where: { id: expId } });
};

exports.deleteExperience = async (userId, expId) => {
    const profile = await _getProfile(userId);

    const deleted = await prisma.experience.deleteMany({
        where: { id: expId, profile_id: profile.id }
    });

    if (deleted.count === 0) throw new Error('Không tìm thấy dữ liệu để xóa.');
    return true;
};

exports.deleteAllExperiences = async (userId) => {
    const profile = await _getProfile(userId);
    await prisma.experience.deleteMany({ where: { profile_id: profile.id } });
    return true;
};

// ==============================================================================
// 4. QUẢN LÝ HỌC VẤN (EDUCATION)
// ==============================================================================

exports.createEducation = async (userId, data) => {
    _validateEducation(data);
    const profile = await _getProfile(userId);
    return await prisma.education.create({
        data: { ...data, profile_id: profile.id }
    });
};

exports.updateEducation = async (userId, eduId, data) => {
    _validateEducation(data);
    const profile = await _getProfile(userId);

    const updated = await prisma.education.updateMany({
        where: { id: eduId, profile_id: profile.id },
        data
    });

    if (updated.count === 0) throw new Error('Không tìm thấy dữ liệu hoặc bạn không có quyền sửa.');
    return await prisma.education.findUnique({ where: { id: eduId } });
};

exports.deleteEducation = async (userId, eduId) => {
    const profile = await _getProfile(userId);

    const deleted = await prisma.education.deleteMany({
        where: { id: eduId, profile_id: profile.id }
    });

    if (deleted.count === 0) throw new Error('Không tìm thấy dữ liệu để xóa.');
    return true;
};

exports.deleteAllEducations = async (userId) => {
    const profile = await _getProfile(userId);
    await prisma.education.deleteMany({ where: { profile_id: profile.id } });
    return true;
};

// ==============================================================================
// 5. QUẢN LÝ KỸ NĂNG (SKILLS) - Quan hệ N-N
// ==============================================================================

exports.updateSkills = async (userId, skillNames) => {
    const profile = await _getProfile(userId);

    if (!Array.isArray(skillNames)) {
        throw new Error('Dữ liệu gửi lên phải là danh sách (Mảng).');
    }

    const savedSkills = [];

    for (const name of skillNames) {
        const cleanName = name.trim();
        if (!cleanName) continue; // Bỏ qua chuỗi rỗng

        const skill = await prisma.skill.upsert({
            where: { name: cleanName },
            update: {},
            create: { name: cleanName }
        });
        savedSkills.push(skill);
    }

    // Xóa các liên kết cũ và thêm liên kết mới
    await prisma.candidate_skill.deleteMany({ where: { profile_id: profile.id } });
    if (savedSkills.length > 0) {
        await prisma.candidate_skill.createMany({
            data: savedSkills.map(skill => ({ profile_id: profile.id, skill_id: skill.id }))
        });
    }

    return savedSkills;
};

// Xóa 1 kỹ năng theo id
exports.deleteSkill = async (userId, skillId) => {
    const profile = await _getProfile(userId);

    // Kiểm tra skill này có trong hồ sơ không
    const exists = await prisma.candidate_skill.findFirst({
        where: { profile_id: profile.id, skill_id: skillId }
    });

    if (!exists) throw new Error('Kỹ năng không tồn tại trong hồ sơ của bạn.');

    // Chỉ xóa liên kết trong candidate_skills, không xóa bảng skills
    await prisma.candidate_skill.deleteMany({
        where: { profile_id: profile.id, skill_id: skillId }
    });
    return true;
};
