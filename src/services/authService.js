const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const Candidate_profile = require('../models/Candidate_profile');
const ROLES = require('../constants/roles');
const sequelize = require('../config/database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenUtils');
const { Op } = require('sequelize');
/**
 * Register a new user
 * @param {Object} data - Registration data
 * @returns {Promise<Object>} Created user and tokens
 */
exports.register = async (data) => {
    const { email, password, phone, full_name, company_name, address } = data;

    // Business Logic Validation
    if (!email.endsWith('@gmail.com')) {
        throw new Error('Email phải có đuôi @gmail.com');
    }

    if (password.length < 6) {
        throw new Error('Password phải có ít nhất 6 ký tự');
    }
    if(phone.length< 10){
        throw new Error('Số điện thoại ít nhất 10 ký tự và phải là số');
    }
    
    // LOGIC REGISTRATION
    const existingUser = await User.findOne({
        where: {
            [Op.or]: [
                { email: email },
                { phone: phone }
            ]
        }
    });

    if (existingUser) {
        if (existingUser.email === email) {
            throw new Error('Email đã được sử dụng');
        }
        if (existingUser.phone === phone) {
            throw new Error('Số điện thoại đã được sử dụng');
        }
    }    
    
    // Determine role
    let role = ROLES.CANDIDATE;
    if (company_name && address) {
        role = ROLES.RECRUITER;
    }

    const t = await sequelize.transaction();

    try {
        // Create user
        const user = await User.create({
            email,
            phone,
            password,
            full_name,
            role: role
        }, { transaction: t });

        // Create profile based on role
        if (role === ROLES.CANDIDATE) {
            await Candidate_profile.create({
                user_id: user.id,
                headline: 'Chưa cập nhật',
                bio: 'Chưa cập nhật',
                website: 'Chưa cập nhật',
                linkedin: 'Chưa cập nhật'
            }, { transaction: t });
        }

        if (role === ROLES.RECRUITER) {
            await Company.create({
                name: company_name,
                address: address,
                user_id: user.id
            }, { transaction: t });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        // Save refresh token
        user.refresh_token = refreshToken;
        await user.save({ transaction: t });

        await t.commit();

        return {
            id: user.id,
            email: user.email,
            phone: user.phone,
            full_name: user.full_name,
            role: user.role,
            company_name: role === ROLES.RECRUITER ? company_name : undefined,
            address: role === ROLES.RECRUITER ? address : undefined,
            accessToken,
            refreshToken
        };

    } catch (error) {
        await t.rollback();
        throw error;
    }
};

/**
 * Login user
 * @param {Object} credentials - email and password
 * @returns {Promise<Object>} User info and tokens
 */
exports.login = async ({ email, password }) => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new Error('Email hoặc mật khẩu không đúng');
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        throw new Error('Mật khẩu không đúng');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token to DB
    user.refresh_token = refreshToken;
    await user.save();

    return {
        id: user.id,
        phone: user.phone,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        company_name: user.company_name, // Note: user.company_name might not exist solely on User model unless joined or virtual. Controller used it, so keeping assuming it's available or undefined.
        address: user.address,           // Same as above
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
        const user = await User.findByPk(decoded.id);

        if (!user || user.refresh_token !== refreshToken) {
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
        user.refresh_token = null;
        await user.save();
    }
};
