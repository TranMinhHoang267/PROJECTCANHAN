const prisma = require('../config/prisma');

exports.getProfile = async (userId) => {
    const profile = await prisma.candidate_profile.findUnique({
        where: { userId },
        include: {
            user: {
                select: { fullName: true, phone: true, role: true, avatarUrl: true }
            }
        }
    });

    if (!profile) {
        return null;
    }

    return {
        fullName: profile.user?.fullName,
        phone: profile.user?.phone,
        role: profile.user?.role,
        avatarUrl: profile.user?.avatarUrl,
        headline: profile.headline,
        summary: profile.summary,
        address: profile.address,
        city: profile.city,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
    };
};

exports.updateProfile = async (userId, data) => {
    const { fullName, phone, summary, address, city, dateOfBirth, gender, headline, linkedinUrl } = data;

    if (phone && !/^0\d{9}$/.test(phone)) {
        throw new Error('Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số');
    }

    if (linkedinUrl && !linkedinUrl.startsWith('https://')) {
        throw new Error('LinkedIn URL không hợp lệ cần thêm https://');
    }

    if (fullName !== undefined) {
        const trimmed = fullName.trim();
        if (!trimmed) throw new Error('Họ tên không được để trống');
        if (trimmed.length < 2 || trimmed.length > 50) throw new Error('Họ tên phải từ 2 đến 50 ký tự');
        if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(trimmed)) throw new Error('Họ tên chỉ được chứa chữ cái và khoảng trắng');
    }

    const userUpdateData = {};
    if (fullName) userUpdateData.fullName = fullName;
    if (phone) userUpdateData.phone = phone;

    if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
            where: { id: userId },
            data: userUpdateData
        });
    }

    const profileUpdateData = {};
    if (headline !== undefined) profileUpdateData.headline = headline;
    if (summary !== undefined) profileUpdateData.summary = summary;
    if (address !== undefined) profileUpdateData.address = address;
    if (city !== undefined) profileUpdateData.city = city;
    if (dateOfBirth !== undefined) profileUpdateData.dateOfBirth = dateOfBirth;
    if (gender !== undefined) profileUpdateData.gender = gender;

    const existingProfile = await prisma.candidate_profile.findUnique({
        where: { userId }
    });

    if (existingProfile) {
        if (Object.keys(profileUpdateData).length > 0) {
            await prisma.candidate_profile.update({
                where: { userId },
                data: profileUpdateData
            });
        }
    } else {
        await prisma.candidate_profile.create({
            data: { userId, ...profileUpdateData }
        });
    }

    const updatedProfile = await prisma.candidate_profile.findUnique({
        where: { userId },
        include: {
            user: {
                select: { id: true, fullName: true, phone: true, avatarUrl: true, email: true }
            }
        },
        select: { headline: true, summary: true, address: true, city: true, dateOfBirth: true, gender: true, createdAt: true, updatedAt: true }
    });

    return {
        fullName: updatedProfile.user?.fullName,
        email: updatedProfile.user?.email,
        headline: updatedProfile.headline,
        summary: updatedProfile.summary,
        address: updatedProfile.address,
        city: updatedProfile.city,
        dateOfBirth: updatedProfile.dateOfBirth,
        gender: updatedProfile.gender
    };
};

exports.deleteProfile = async (userId, fieldsToDelete) => {
    const ALLOWED_PROFILE_FIELDS = ['headline', 'summary', 'address', 'city', 'dateOfBirth', 'gender'];

    if (!Array.isArray(fieldsToDelete) || fieldsToDelete.length === 0) {
        throw new Error('Danh sách trường cần xóa không hợp lệ');
    }

    const profileUpdateData = {};
    fieldsToDelete.forEach(field => {
        if (ALLOWED_PROFILE_FIELDS.includes(field)) {
            profileUpdateData[field] = null;
        }
    });

    if (Object.keys(profileUpdateData).length === 0) {
        throw new Error('Không có trường hợp lệ nào để xóa');
    }

    await prisma.candidate_profile.update({
        where: { userId },
        data: profileUpdateData
    });

    return exports.getProfile(userId);
};
