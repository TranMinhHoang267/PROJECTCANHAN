const prisma = require('../config/prisma');

const _getProfile = async (userId) => {
    const profile = await prisma.candidate_profile.findUnique({ where: { userId } });
    if (!profile) throw new Error('Hồ sơ ứng viên không tồn tại. Vui lòng tạo hồ sơ chung trước.');
    return profile;
};

const _getProfileWithUser = async (userId) => {
    const profile = await prisma.candidate_profile.findUnique({
        where: { userId },
        include: { user: { select: { fullName: true, avatarUrl: true } } }
    });
    if (!profile) throw new Error('Hồ sơ ứng viên không tồn tại. Vui lòng tạo hồ sơ chung trước.');
    return profile;
};

const _validateExperience = (data) => {
    const { company, title, startDate, description } = data;

    if (!company?.trim()) throw new Error('Tên công ty không được để trống');
    if (!title?.trim()) throw new Error('Vị trí công việc không được để trống');
    if (!startDate) throw new Error('Ngày bắt đầu không được để trống');
    if (!description?.trim()) throw new Error('Mô tả không được để trống');

    if (data.endDate && new Date(data.endDate) < new Date(startDate)) {
        throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
    }
};

const _validateEducation = (data) => {
    const { school, degree, startDate } = data;

    if (!school?.trim()) throw new Error('Tên trường học không được để trống');
    if (!degree?.trim()) throw new Error('Bằng cấp không được để trống');
    if (!startDate) throw new Error('Ngày bắt đầu không được để trống');

    if (data.endDate && new Date(data.endDate) < new Date(startDate)) {
        throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
    }
};

exports.getFullProfile = async (userId) => {
    const profile = await _getProfileWithUser(userId);

    const [experiences, educations, skills] = await Promise.all([
        prisma.experience.findMany({
            where: { profileId: profile.id },
            orderBy: { startDate: 'desc' }
        }),
        prisma.education.findMany({
            where: { profileId: profile.id },
            orderBy: { startDate: 'desc' }
        }),
        exports.getSkills(userId)
    ]);

    return {
        fullName: profile.user?.fullName,
        avatarUrl: profile.user?.avatarUrl,
        headline: profile.headline,
        summary: profile.summary,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        experiences,
        educations,
        skills
    };
};

exports.getExperiences = async (userId) => {
    const profile = await _getProfile(userId);
    return await prisma.experience.findMany({
        where: { profileId: profile.id },
        orderBy: { startDate: 'desc' }
    });
};

exports.getEducations = async (userId) => {
    const profile = await _getProfile(userId);
    return await prisma.education.findMany({
        where: { profileId: profile.id },
        orderBy: { startDate: 'desc' }
    });
};

exports.getSkills = async (userId) => {
    const profile = await _getProfile(userId);
    const profileWithSkills = await prisma.candidate_profile.findUnique({
        where: { id: profile.id },
        include: { skills: { include: { skill: true } } }
    });
    return (profileWithSkills?.skills || []).map(cs => cs.skill);
};

exports.createExperience = async (userId, data) => {
    _validateExperience(data);
    const profile = await _getProfile(userId);
    return await prisma.experience.create({
        data: { ...data, profileId: profile.id }
    });
};

exports.updateExperience = async (userId, expId, data) => {
    _validateExperience(data);
    const profile = await _getProfile(userId);

    const updated = await prisma.experience.updateMany({
        where: { id: expId, profileId: profile.id },
        data
    });

    if (updated.count === 0) throw new Error('Không tìm thấy dữ liệu hoặc bạn không có quyền sửa.');
    return await prisma.experience.findUnique({ where: { id: expId } });
};

exports.deleteExperience = async (userId, expId) => {
    const profile = await _getProfile(userId);

    const deleted = await prisma.experience.deleteMany({
        where: { id: expId, profileId: profile.id }
    });

    if (deleted.count === 0) throw new Error('Không tìm thấy dữ liệu để xóa.');
    return true;
};

exports.deleteAllExperiences = async (userId) => {
    const profile = await _getProfile(userId);
    await prisma.experience.deleteMany({ where: { profileId: profile.id } });
    return true;
};

exports.createEducation = async (userId, data) => {
    _validateEducation(data);
    const profile = await _getProfile(userId);
    return await prisma.education.create({
        data: { ...data, profileId: profile.id }
    });
};

exports.updateEducation = async (userId, eduId, data) => {
    _validateEducation(data);
    const profile = await _getProfile(userId);

    const updated = await prisma.education.updateMany({
        where: { id: eduId, profileId: profile.id },
        data
    });

    if (updated.count === 0) throw new Error('Không tìm thấy dữ liệu hoặc bạn không có quyền sửa.');
    return await prisma.education.findUnique({ where: { id: eduId } });
};

exports.deleteEducation = async (userId, eduId) => {
    const profile = await _getProfile(userId);

    const deleted = await prisma.education.deleteMany({
        where: { id: eduId, profileId: profile.id }
    });

    if (deleted.count === 0) throw new Error('Không tìm thấy dữ liệu để xóa.');
    return true;
};

exports.deleteAllEducations = async (userId) => {
    const profile = await _getProfile(userId);
    await prisma.education.deleteMany({ where: { profileId: profile.id } });
    return true;
};

exports.updateSkills = async (userId, skillNames) => {
    const profile = await _getProfile(userId);

    if (!Array.isArray(skillNames)) {
        throw new Error('Dữ liệu gửi lên phải là danh sách (Mảng).');
    }

    const savedSkills = [];

    for (const name of skillNames) {
        const cleanName = name.trim();
        if (!cleanName) continue;

        const skill = await prisma.skill.upsert({
            where: { name: cleanName },
            update: {},
            create: { name: cleanName }
        });
        savedSkills.push(skill);
    }

    await prisma.candidate_skill.deleteMany({ where: { profileId: profile.id } });
    if (savedSkills.length > 0) {
        await prisma.candidate_skill.createMany({
            data: savedSkills.map(skill => ({ profileId: profile.id, skillId: skill.id }))
        });
    }

    return savedSkills;
};

exports.deleteSkill = async (userId, skillId) => {
    const profile = await _getProfile(userId);

    const exists = await prisma.candidate_skill.findFirst({
        where: { profileId: profile.id, skillId }
    });

    if (!exists) throw new Error('Kỹ năng không tồn tại trong hồ sơ của bạn.');

    await prisma.candidate_skill.deleteMany({
        where: { profileId: profile.id, skillId }
    });
    return true;
};
