const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get candidate profile by user ID
 * @param {string} userId 
 * @returns {Promise<Object>} Formatted profile data
 */
exports.getProfile = async (userId) => {
    const profile = await prisma.candidate_profile.findUnique({
        where: { user_id: userId },
        include: {
            user: {
                select: { full_name: true, phone: true, role: true, avatar_url: true }
            }
        }
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
    if (phone && !/^0\d{9}$/.test(phone)) {
        throw new Error('Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số');
    }

    if (linkedin_url && !linkedin_url.startsWith('https://')) {
        throw new Error('LinkedIn URL không hợp lệ cần thêm https://');
    }

    if (full_name !== undefined) {
        const trimmed = full_name.trim();
        if (!trimmed) throw new Error('Họ tên không được để trống');
        if (trimmed.length < 2 || trimmed.length > 50) throw new Error('Họ tên phải từ 2 đến 50 ký tự');
        if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(trimmed)) throw new Error('Họ tên chỉ được chứa chữ cái và khoảng trắng');
    }

    // Update table users
    const userUpdateData = {};
    if (full_name) userUpdateData.full_name = full_name;
    if (phone) userUpdateData.phone = phone;

    if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
            where: { id: userId },
            data: userUpdateData
        });
    }

    // Update table candidate_profile
    const profileUpdateData = {};
    if (headline !== undefined) profileUpdateData.headline = headline;
    if (bio !== undefined) profileUpdateData.bio = bio;
    if (website !== undefined) profileUpdateData.website = website;
    if (linkedin_url !== undefined) profileUpdateData.linkedin_url = linkedin_url;

    // Kiểm tra xem đã có hồ sơ chưa
    const existingProfile = await prisma.candidate_profile.findUnique({
        where: { user_id: userId }
    });

    if (existingProfile) {
        // Nếu có rồi -> Update
        if (Object.keys(profileUpdateData).length > 0) {
            await prisma.candidate_profile.update({
                where: { user_id: userId },
                data: profileUpdateData
            });
        }
    } else {
        // Nếu chưa có -> Create
        await prisma.candidate_profile.create({
            data: { user_id: userId, ...profileUpdateData }
        });
    }

    // Fetch updated data to return
    const updatedProfile = await prisma.candidate_profile.findUnique({
        where: { user_id: userId },
        include: {
            user: {
                select: { id: true, full_name: true, phone: true, avatar_url: true, email: true }
            }
        },
        select: { headline: true, bio: true, website: true, linkedin_url: true, created_at: true, updated_at: true }
    });

    // Format lại dữ liệu trả về cho đẹp
    return {
        full_name: updatedProfile.user?.full_name,
        email: updatedProfile.user?.email,
        headline: updatedProfile.headline,
        bio: updatedProfile.bio,
        website: updatedProfile.website,
        linkedin_url: updatedProfile.linkedin_url
    };
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

    await prisma.candidate_profile.update({
        where: { user_id: userId },
        data: profileUpdateData
    });

    return exports.getProfile(userId);
};
