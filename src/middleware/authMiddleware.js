const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET chưa được cấu hình!');
            }

            const decoded = jwt.verify(token, secret);

            const currentUser = await prisma.user.findUnique({ where: { id: decoded.id } });

            if (!currentUser) {
                return res.status(401).json({
                    message: 'User thuộc token này không còn tồn tại.'
                });
            }

            req.user = currentUser;

            return next();
        } catch (error) {
            console.error('Auth Error:', error.message);
            return res.status(401).json({
                message: 'Token không hợp lệ hoặc đã hết hạn.'
            });
        }
    }

    if (!token) {
        console.error('Error: No token provided');
        return res.status(401).json({
            message: 'Bạn chưa đăng nhập (Thiếu Token).'
        });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User chưa được xác thực.' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Bạn không có quyền truy cập (Yêu cầu quyền: ${roles.join(', ')})`
            });
        }

        next();
    };
};
