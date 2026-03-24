const { Candidate_profile, Experience, Education, Skill, User, sequelize } = require('../models');
// ==============================================================================
// 1. CÁC HÀM HỖ TRỢ DÙNG CHUNG (PRIVATE HELPERS)
// ==============================================================================


// Dùng cho tất cả CRUD — không join User
const _getProfile = async (userId) => {
    const profile = await Candidate_profile.findOne({ where: { user_id: userId } });
    if (!profile) throw new Error('Hồ sơ ứng viên không tồn tại. Vui lòng tạo hồ sơ chung trước.');
    return profile;
};

// Chỉ dùng cho getFullProfile — có join User
const _getProfileWithUser = async (userId) => {
    const profile = await Candidate_profile.findOne({ 
        where: { user_id: userId },
        include: [{ model: User,
        as: 'user',    
        attributes: ['full_name', 'avatar_url'] }]
    });
    if (!profile) throw new Error('Hồ sơ ứng viên không tồn tại. Vui lòng tạo hồ sơ chung trước.');
    return profile;
};


// Helper: Tạo mới item (Dùng chung cho Experience và Education)
const _createItem = async (Model, userId, data) => {
    const profile = await _getProfile(userId);
    return await Model.create({ ...data, profile_id: profile.id });
};

// Helper: Cập nhật item (Dùng chung)
const _updateItem = async (Model, userId, itemId, data) => {
    const profile = await _getProfile(userId);
    
    const [updated] = await Model.update(data, {
        where: { id: itemId, profile_id: profile.id }
    });

    if (!updated) throw new Error('Không tìm thấy dữ liệu hoặc bạn không có quyền sửa.');
    
    return await Model.findByPk(itemId);
};

// Helper: Xóa item (Dùng chung)
const _deleteItem = async (Model, userId, itemId) => {
    const profile = await _getProfile(userId);
    
    const deleted = await Model.destroy({
        where: { id: itemId, profile_id: profile.id }
    });

    if (!deleted) throw new Error('Không tìm thấy dữ liệu để xóa.');
    return true;
};

// Helper: Validate Experience data
const _validateExperience = (data) => {
    const { company_name, position, start_date, description } = data;
    
    if (!company_name?.trim()) throw new Error('Tên công ty không được để trống');
    if (!position?.trim()) throw new Error('Vị trí công việc không được để trống');
    if (!start_date) throw new Error('Ngày bắt đầu không được để trống');
    if (!description?.trim()) throw new Error('Mô tả không được để trống'); 
    // Validate logic: end_date phải sau start_date
    if (data.end_date && new Date(data.end_date) < new Date(start_date)) {
        throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
    }
};

// Helper: Validate Education data
const _validateEducation = (data) => {
    const { school_name, degree, start_date } = data;
    
    if (!school_name?.trim()) throw new Error('Tên trường học không được để trống');
    if (!degree?.trim()) throw new Error('Bằng cấp không được để trống');
    if (!start_date) throw new Error('Ngày bắt đầu không được để trống');
    
    if (data.end_date && new Date(data.end_date) < new Date(start_date)) {
        throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
    }
};

// ==============================================================================
// 2. LOGIC NGHIỆP VỤ CHÍNH - ĐỌC THÔNG TIN (READ)
// ==============================================================================

// Lấy toàn bộ hồ sơ của user (bao gồm experiences, educations, skills)
exports.getFullProfile = async (userId) => {
    const profile = await _getProfileWithUser(userId);

    const [experiences, educations, skills] = await Promise.all([
        Experience.findAll({
            where: { profile_id: profile.id },
            order: [['start_date', 'DESC']]
        }),
        Education.findAll({
            where: { profile_id: profile.id },
            order: [['start_date', 'DESC']]
        }),
        exports.getSkills(userId)
    ]);

    return {
        // chỉ lấy tên và avatar
        full_name: profile.user?.full_name,
        avatar_url: profile.user?.avatar_url,
        // headline:   profile.headline,
        // bio:        profile.bio,
        // website:    profile.website,
        // linkedin_url:   profile.linkedin_url,
        experiences,
        educations,
        skills
    };
};

// Lấy danh sách kinh nghiệm
exports.getExperiences = async (userId) => {
    const profile = await _getProfile(userId);
    return await Experience.findAll({
        where: { profile_id: profile.id },
        order: [['start_date', 'DESC']]
    });
};

// Lấy danh sách học vấn
exports.getEducations = async (userId) => {
    const profile = await _getProfile(userId);
    return await Education.findAll({
        where: { profile_id: profile.id },
        order: [['start_date', 'DESC']]
    });
};

// Lấy danh sách kỹ năng
exports.getSkills = async (userId) => {
    const profile = await _getProfile(userId);
    const profileWithSkills = await Candidate_profile.findByPk(profile.id, {
        include: [{ 
            model: Skill, 
            as: 'skills',
            through: { attributes: [] }
        }]
    });
    return profileWithSkills.skills.map(skill => ({
        id: skill.id,
        name: skill.name
    }));
};

// ==============================================================================
// 3. QUẢN LÝ KINH NGHIỆM (EXPERIENCE)
// ==============================================================================

exports.createExperience = async (userId, data) => {
    _validateExperience(data);
    return await _createItem(Experience, userId, data);
};

exports.updateExperience = async (userId, expId, data) => {
    _validateExperience(data);
    return await _updateItem(Experience, userId, expId, data);
};

exports.deleteExperience = async (userId, expId) => {
    return await _deleteItem(Experience, userId, expId);
};

exports.deleteAllExperiences = async (userId) => {
    const profile = await _getProfile(userId);
    await Experience.destroy({ where: { profile_id: profile.id } });
    return true;
};

// ==============================================================================
// 4. QUẢN LÝ HỌC VẤN (EDUCATION)
// ==============================================================================

exports.createEducation = async (userId, data) => {
    _validateEducation(data);
    return await _createItem(Education, userId, data);
};

exports.updateEducation = async (userId, eduId, data) => {
    _validateEducation(data);
    return await _updateItem(Education, userId, eduId, data);
};

exports.deleteEducation = async (userId, eduId) => {
    return await _deleteItem(Education, userId, eduId);
};

exports.deleteAllEducations = async (userId) => {
    const profile = await _getProfile(userId);
    await Education.destroy({ where: { profile_id: profile.id } });
    return true;
};


// ==============================================================================
// 5. QUẢN LÝ KỸ NĂNG (SKILLS) - Quan hệ N-N
// ==============================================================================

exports.updateSkills = async (userId, skillNames) => {
    const t = await sequelize.transaction();
    try {
        const profile = await _getProfile(userId);
        
        if (!Array.isArray(skillNames)) {
            throw new Error('Dữ liệu gửi lên phải là danh sách (Mảng).');
        }

        const skillIds = [];
        const savedSkills = [];
        
        for (const name of skillNames) {
            const cleanName = name.trim();
            if (!cleanName) continue; // Bỏ qua chuỗi rỗng
            
            const [skill] = await Skill.findOrCreate({
                where: { name: cleanName },
                defaults: { name: cleanName },
                transaction: t
            });
            skillIds.push(skill.id);
            savedSkills.push({ id: skill.id, name: skill.name });
        }

        // setSkills: Tự động xóa các liên kết cũ và thêm liên kết mới
        await profile.setSkills(skillIds, { transaction: t });
        
        await t.commit();
        return savedSkills;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// Xóa 1 kỹ năng theo id
exports.deleteSkill = async (userId, skillId) => {
    const profile = await _getProfile(userId);

    // Kiểm tra skill này có trong hồ sơ không
    const currentSkills = await profile.getSkills();
    const exists = currentSkills.some(s => s.id === skillId);

    if (!exists) throw new Error('Kỹ năng không tồn tại trong hồ sơ của bạn.');

    // Chỉ xóa liên kết trong candidate_skills, không xóa bảng skills
    await profile.removeSkill(skillId);
    return true;
};

// // Xóa tất cả kỹ năng
// exports.deleteAllSkills = async (userId) => {
//     const profile = await _getProfile(userId);
//     await profile.setSkills([]); // Xóa tất cả quan hệ trong bảng candidate_skills
//     return true;
// };