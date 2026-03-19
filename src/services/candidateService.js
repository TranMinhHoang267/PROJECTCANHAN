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
                as: 'user',
                attributes: ['full_name', 'phone', 'role', 'avatar_url']
            }]
    });

    if (!profile) {
        return null; // Or throw custom error
    }

    // Return formatted data (DTO-like)
    return {
        full_name: profile.user?.full_name,
        phone: profile.user?.phone,
        role: profile.user?.role,
        avatar_url: profile.user?.avatar_url,
        headline: profile.headline,
        bio: profile.bio,
        website: profile.website,
        linkedin_url: profile.linkedin_url,
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

    const { full_name, phone, bio, website, headline, linkedin_url } = data;

    // Validation (Logic business)
    if (phone && !/^\d{10,11}$/.test(phone)) {
        throw new Error('Số điện thoại không hợp lệ');
    }

    if (linkedin_url && !linkedin_url.startsWith('https://')) {
        throw new Error('LinkedIn URL không hợp lệ cần thêm https://');
    }

    const t = await sequelize.transaction();

    try {
        // Update table users
        const userUpdateData = {};
        if (full_name) userUpdateData.full_name = full_name;
        if (phone) userUpdateData.phone = phone;
        // if (avatar_url) userUpdateData.avatar_url = avatar_url;

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

        // Kiểm tra xem đã có hồ sơ chưa
        const existingProfile = await Candidate_profile.findOne({ 
            where: { user_id: userId },
            transaction: t 
        });

        if (existingProfile) {
            // Nếu có rồi -> Update
            await Candidate_profile.update(profileUpdateData, {
                where: { user_id: userId },
                transaction: t
            });
        } else {
            // Nếu chưa có -> Create
            await Candidate_profile.create(profileUpdateData, {
                transaction: t
            });
        }

        await t.commit();

        // Fetch updated data to return
        const updatedProfile = await Candidate_profile.findOne({
            where: { user_id: userId },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'phone', 'avatar_url', 'email']
            }],
            attributes: ['headline', 'bio', 'website', 'linkedin_url', 'created_at', 'updated_at']
        });

        // Format lại dữ liệu trả về cho đẹp (đổi .User thành .user)
        return {
            full_name: updatedProfile.user?.full_name,
            // phone: updatedProfile.user?.phone,
            email: updatedProfile.user?.email,
            // avatar_url: updatedProfile.user?.avatar_url,
            headline: updatedProfile.headline,
            bio: updatedProfile.bio,
            website: updatedProfile.website,
            linkedin_url: updatedProfile.linkedin_url
        };

    } catch (error) {
        if (!t.finished) {
            await t.rollback();
        }
        throw error;
    }
};

exports.deleteProfile = async (userId, fieldsToDelete) => {
    // Chỉ cho phép xóa các trường của candidate_profile
    // avatar_url phải xóa qua avatar_controller riêng
    const ALLOWED_PROFILE_FIELDS = ['headline', 'bio', 'website', 'linkedin_url'];

    if (!Array.isArray(fieldsToDelete) || fieldsToDelete.length === 0) {
        throw new Error('Danh sách trường cần xóa không hợp lệ');
    }

    // Lọc ra các trường hợp lệ
    const profileUpdateData = {};
    fieldsToDelete.forEach(field => {
        if (ALLOWED_PROFILE_FIELDS.includes(field)) {
            profileUpdateData[field] = null;
        }
    });

    // Nếu không có trường hợp lệ nào thì báo lỗi luôn
    if (Object.keys(profileUpdateData).length === 0) {
        throw new Error('Không có trường hợp lệ nào để xóa');
    }

    const t = await sequelize.transaction();

    try {
        await Candidate_profile.update(profileUpdateData, {
            where: { user_id: userId },
            transaction: t
        });

        await t.commit();

        return exports.getProfile(userId);

    } catch (error) {
        if (!t.finished) {
            await t.rollback();
        }
        throw error;
    }
};