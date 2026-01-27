const authService = require('../services/authService');
const ROLES = require('../constants/roles');

exports.register = async (req, res) => {
    try {
        const { email, password, full_name, phone } = req.body;
        
        // Basic Input Validation
        if (!email || !password || !full_name || !phone) {
            return res.status(400).json({ 
                message: 'Email, password, họ tên và số điện thoại là bắt buộc' 
            });
        }
        
        const result = await authService.register(req.body);
        
        return res.status(201).json({
            status: 'success',
            data: result
        });

    } catch (error) {
        console.error('Lỗi trong quá trình đăng ký:', error);
        
        // Handle specific service errors
        const clientErrors = [
            'Email phải có đuôi @gmail.com',
            'Password phải có ít nhất 6 ký tự',
            'Email đã được sử dụng',
            'Số điện thoại đã sử dụng'
        ];

        if (clientErrors.includes(error.message)) {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({ 
            message: 'Đã xảy ra lỗi khi đăng ký',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await authService.login({ email, password });

        return res.status(200).json({
            status: 'success',
            data: result
        });

    } catch (error) {
        console.error(error);
        
        if (error.message === 'Email hoặc mật khẩu không đúng' || error.message === 'Mật khẩu không đúng') {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
        }

        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Vui lòng cung cấp Refresh Token' });
    }

    try {
        const accessToken = await authService.refreshToken(refreshToken);

        res.status(200).json({
            accessToken
        });
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: 'Refresh token không hợp lệ' });
    }
};

exports.logout = async (req, res) => {
    try {
        if (req.user) {
            await authService.logout(req.user);
            return res.status(200).json({ message: 'Đăng xuất thành công' });
        }

        res.status(400).json({ message: 'User not found' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

