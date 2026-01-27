const { User, Candidate_profile, sequelize } = require('../models');

/**
 * Get candidate profile by user ID
 * @param {string} userId 
 * @returns {Promise<Object>} Formatted profile data
 */
exports.getProfile = async (userId) => {
    const profile = await Candidate_profile.findOne({
        where: { user_id: userId },
        include: [
            {
                model: User,
                attributes: ['full_name', 'phone', 'role', 'avatar_url']
            }]
    });

    if (!profile) {
        return null; // Or throw custom error
    }

    // Return formatted data (DTO-like)
    return {
        full_name: profile.User?.full_name,
        phone: profile.User?.phone,
        role: profile.User?.role,
        avatar_url: profile.User?.avatar_url,
        headline: profile.headline,
        bio: profile.bio,
        website: profile.website,
        linkedin: profile.linkedin || profile.linkedin_url,
        created_at: profile.created_at,
        updated_at: profile.updated_at
    };
};

/**
 * Update candidate profile and user info
 * @param {string} userId 
 * @param {Object} data - fields to update
 * @returns {Promise<Object>} Updated profile
 * @param {Array<string>} fieldsToDelete - Array of field names to delete
 */
exports.updateProfile = async (userId, data) => {
    const {
        full_name, phone, bio,
        website, headline, linkedin_url, avatar_url
    } = data;

    // Validation (Logic business)
    if (phone && !/^\d{10,11}$/.test(phone)) {
        throw new Error('Số điện thoại không hợp lệ');
    }

    if (linkedin_url && !linkedin_url.startsWith('https://linkedin.com/')) {
        throw new Error('LinkedIn URL không hợp lệ');
    }

    const t = await sequelize.transaction();

    try {
        // Update table users
        const userUpdateData = {};
        if (full_name) userUpdateData.full_name = full_name;
        if (phone) userUpdateData.phone = phone;
        if (avatar_url) userUpdateData.avatar_url = avatar_url;

        if (Object.keys(userUpdateData).length > 0) {
            await User.update(userUpdateData, {
                where: { id: userId },
                transaction: t
            });
        }

        // Update table candidate_profile
        const profileUpdateData = {
            user_id: userId,
            ...(headline !== undefined && { headline }),
            ...(bio !== undefined && { bio }),
            ...(website !== undefined && { website }),
            ...(linkedin_url !== undefined && { linkedin_url }) // Assuming strict check, or use nullish coalescing if needed
        };

        await Candidate_profile.upsert(profileUpdateData, {
            transaction: t
        });

        await t.commit();

        // Fetch updated data to return
        const updatedProfile = await Candidate_profile.findOne({
            where: { user_id: userId },
            include: [{
                model: User,
                attributes: ['id', 'full_name', 'phone', 'avatar_url', 'email']
            }],
            attributes: ['headline', 'bio', 'website', 'linkedin_url', 'created_at', 'updated_at']
        });

        return updatedProfile;

    } catch (error) {
        await t.rollback();
        throw error;
    }
};

exports.deleteProfile = async (userId, fieldsToDelete) => {
    // Danh sách các trường hợp lệ có thể xóa
    const ALLOWED_PROFILE_FIELDS = ['headline', 'bio', 'website', 'linkedin_url'];
    const ALLOWED_USER_FIELDS = ['avatar_url'];

    // Nếu không truyền mảng hoặc mảng rỗng thì return luôn
    if (!Array.isArray(fieldsToDelete) || fieldsToDelete.length === 0) {
        throw new Error('Danh sách trường cần xóa không hợp lệ');
    }

    const t = await sequelize.transaction();

    try {
        // 1. Chuẩn bị dữ liệu để update bảng User (avatar_url)
        const userUpdateData = {};
        fieldsToDelete.forEach(field => {
            if (ALLOWED_USER_FIELDS.includes(field)) {
                userUpdateData[field] = null; // Set về null để xóa
            }
        });

        // 2. Chuẩn bị dữ liệu để update bảng Candidate_profile
        const profileUpdateData = {};
        fieldsToDelete.forEach(field => {
            if (ALLOWED_PROFILE_FIELDS.includes(field)) {
                profileUpdateData[field] = null; // Set về null để xóa
            }
        });

        // 3. Thực hiện update bảng User (nếu có trường cần xóa)
        if (Object.keys(userUpdateData).length > 0) {
            await User.update(userUpdateData, {
                where: { id: userId },
                transaction: t
            });
        }

        // 4. Thực hiện update bảng Candidate_profile (nếu có trường cần xóa)
        if (Object.keys(profileUpdateData).length > 0) {
            await Candidate_profile.update(profileUpdateData, {
                where: { user_id: userId },
                transaction: t
            });
        }

        await t.commit();

        // 5. Trả về dữ liệu mới nhất sau khi xóa
        // Tận dụng hàm getProfile có sẵn hoặc query lại
        return exports.getProfile(userId);

    } catch (error) {
        await t.rollback();
        throw error;
    }
};