const prisma = require('../config/prisma');
const { ROLES } = require('../constants/roles');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenUtils');
const bcrypt = require('bcryptjs');

exports.register = async (data) => {
    const email = data.email?.trim();
    const phone = data.phone?.trim();
    const fullName = data.fullName?.trim();
    const password = data.password;
    const companyName = data.companyName?.trim();
    const address = data.address?.trim();

    if (!/^[a-zA-Z0-9.]+@gmail\.com$/.test(email)) {
        throw new Error('Email không hợp lệ (Viết liền, không dấu, đuôi @gmail.com)');
    }

    if (!password || password.length < 6) {
        throw new Error('Password phải có ít nhất 6 ký tự');
    }

    if (!phone) {
        throw new Error('Số điện thoại là bắt buộc');
    }
    if (!/^0\d{9}$/.test(phone)) {
        throw new Error('Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số');
    }

    if (!fullName) {
        throw new Error('Họ tên không được để trống');
    }
    if (fullName.length < 2 || fullName.length > 50) {
        throw new Error('Họ tên phải từ 2 đến 50 ký tự');
    }
    if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(fullName)) {
        throw new Error('Họ tên chỉ được chứa chữ cái và khoảng trắng');
    }

    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email: email },
                { phone: phone }
            ]
        }
    });

    if (existingUser) {
        if (existingUser.email === email) throw new Error('Email đã được sử dụng');
        if (existingUser.phone === phone) throw new Error('Số điện thoại đã được sử dụng');
    }

    let role = ROLES.CANDIDATE;
    if (companyName || address) {
        if (!companyName) {
            throw new Error('Thiếu tên công ty. Vui lòng nhập đầy đủ thông tin công ty hoặc bỏ trống để đăng ký tài khoản ứng viên');
        }
        if (!address) {
            throw new Error('Thiếu địa chỉ công ty. Vui lòng nhập đầy đủ địa chỉ công ty hoặc bỏ trống để đăng ký tài khoản ứng viên');
        }
        role = ROLES.RECRUITER;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    try {
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    phone,
                    password: hashedPassword,
                    fullName,
                    role
                }
            });

            if (role === ROLES.CANDIDATE) {
                await tx.candidate_profile.create({
                    data: {
                        userId: user.id
                    }
                });
            }

            if (role === ROLES.RECRUITER) {
                await tx.company.create({
                    data: {
                        userId: user.id,
                        name: companyName,
                        address: address,
                        status: 'pending'
                    }
                });
            }

            const accessToken = generateAccessToken(user.id, user.role);
            const refreshToken = generateRefreshToken(user.id);

            await tx.user.update({
                where: { id: user.id },
                data: { refreshToken }
            });

            return {
                id: user.id,
                email: user.email,
                phone: user.phone,
                fullName: user.fullName,
                role: user.role,
                accessToken,
                refreshToken
            };
        });

        return result;
    } catch (error) {
        throw error;
    }
};

exports.login = async ({ email, password }) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new Error('Email hoặc mật khẩu không đúng');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Mật khẩu không đúng');
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken }
    });

    return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl || null,
        accessToken,
        refreshToken
    };
};

exports.refreshToken = async (refreshToken) => {
    try {
        const decoded = verifyRefreshToken(refreshToken);
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });

        if (!user || user.refreshToken !== refreshToken) {
            throw new Error('Refresh token không hợp lệ hoặc đã hết hạn');
        }

        return generateAccessToken(user.id, user.role);
    } catch (error) {
        throw new Error('Refresh token không hợp lệ');
    }
};

exports.logout = async (user) => {
    if (user) {
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: null }
        });
    }
};
