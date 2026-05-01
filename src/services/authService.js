const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { ROLES } = require('../constants/roles');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenUtils');
const bcrypt = require('bcryptjs');
const { Op } = require('@prisma/client'); // Not used in Prisma, removing dependency

/**
 * Register a new user
 * @param {Object} data - Registration data
 * @returns {Promise<Object>} Created user and tokens
 */
exports.register = async (data) => {
    // 1. CHUẨN HÓA DỮ LIỆU ĐẦU VÀO (Làm sạch 1 lần, dùng cho toàn bộ file)
    const email = data.email?.trim();
    const phone = data.phone?.trim();
    const full_name = data.full_name?.trim();
    const password = data.password;
    const company_name = data.company_name?.trim();
    const address = data.address?.trim();

    // 2. VALIDATE EMAIL
    if (!/^[a-zA-Z0-9.]+@gmail\.com$/.test(email)) {
        throw new Error('Email không hợp lệ (Viết liền, không dấu, đuôi @gmail.com)');
    }

    // 3. VALIDATE PASSWORD
    if (!password || password.length < 6) {
        throw new Error('Password phải có ít nhất 6 ký tự');
    }

    // 4. VALIDATE PHONE
    if (!phone) {
        throw new Error('Số điện thoại là bắt buộc');
    }
    if (!/^0\d{9}$/.test(phone)) {
        throw new Error('Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số');
    }   

    // 5. VALIDATE FULL NAME
    if (!full_name) {
        throw new Error('Họ tên không được để trống');
    }
    if (full_name.length < 2 || full_name.length > 50) {
        throw new Error('Họ tên phải từ 2 đến 50 ký tự');
    }
    if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(full_name)) {
        throw new Error('Họ tên chỉ được chứa chữ cái và khoảng trắng');
    }
    
    // Check conflicts (Email or Phone) - Prisma equivalent of Op.or
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
    
    // Determine role
    let role = ROLES.CANDIDATE;
    // Nếu có nhập bất kỳ thông tin công ty nào
    if (company_name || address) {
        // Validate: Phải nhập đủ cả 2
        if (!company_name) {
            throw new Error('Thiếu tên công ty. Vui lòng nhập đầy đủ thông tin công ty hoặc bỏ trống để đăng ký tài khoản ứng viên');
        }
        if (!address) {
            throw new Error('Thiếu địa chỉ công ty. Vui lòng nhập đầy đủ địa chỉ công ty hoặc bỏ trống để đăng ký tài khoản ứng viên');
        }
        role = ROLES.RECRUITER;
    }

    // Hash password manually (replacing Sequelize beforeCreate hook)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    try {
        // Use Prisma transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
                data: {
                    email,
                    phone,
                    password: hashedPassword,
                    fullName: full_name,
                    role: role
                }
            });

            // Create profile based on role
            if (role === ROLES.CANDIDATE) {
                await tx.candidateProfile.create({
                    data: {
                        userId: user.id
                    }
                });
            }

            if (role === ROLES.RECRUITER) {
                await tx.company.create({
                    data: {
                        userId: user.id,
                        name: company_name,
                        address: address,
                        status: 'pending'
                    }
                });
            }

            // Generate tokens
            const accessToken = generateAccessToken(user.id, user.role);
            const refreshToken = generateRefreshToken(user.id);

            // Save refresh token
            await tx.user.update({
                where: { id: user.id },
                data: { refreshToken: refreshToken }
            });

            return {
                id: user.id,
                email: user.email,
                phone: user.phone,
                full_name: user.fullName,
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

/**
 * Login user
 * @param {Object} credentials - email and password
 * @returns {Promise<Object>} User info and tokens
 */
exports.login = async ({ email, password }) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new Error('Email hoặc mật khẩu không đúng');
    }

    // Replace instance method matchPassword with direct bcrypt.compare
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw new Error('Mật khẩu không đúng');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token to DB (replacing user.save())
    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: refreshToken }
    });

    return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        full_name: user.fullName,
        role: user.role,
        avatar_url: user.avatarUrl || null,
        accessToken,
        refreshToken
    };
};

/**
 * Refresh access token
 * @param {string} refreshToken 
 * @returns {Promise<string>} New access token
 */
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

/**
 * Logout user
 * @param {Object} user - User instance from request
 * @returns {Promise<void>}
 */
exports.logout = async (user) => {
    if (user) {
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: null }
        });
    }
};
