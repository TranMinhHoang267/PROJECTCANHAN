const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Đảm bảo import đúng model Sequelize

exports.protect = async (req, res, next) => {
    let token;

    // 1. Kiểm tra header xem có token không
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Lấy token từ header
            token = req.headers.authorization.split(' ')[1];

            // 2. Giải mã token
            // Lưu ý: Tuyệt đối không để fallback là chuỗi rỗng ''
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET chưa được cấu hình!');
            }

            const decoded = jwt.verify(token, secret);

            // 3. Tìm user trong DB (Dùng findByPk cho Sequelize)
            const currentUser = await User.findByPk(decoded.id);

            // 4. Kiểm tra user còn tồn tại không (Trường hợp user bị xóa nhưng token chưa hết hạn)
            if (!currentUser) {
                return res.status(401).json({ 
                    message: 'User thuộc token này không còn tồn tại.' 
                });
            }

            // 5. Gán user vào req để dùng ở các middleware sau
            req.user = currentUser;
            
            // Cho phép đi tiếp
            return next();

        } catch (error) {
            console.error('Auth Error:', error.message);
            return res.status(401).json({ 
                message: 'Token không hợp lệ hoặc đã hết hạn.' 
            });
        }
    }

    // Nếu không có token ngay từ đầu
    if (!token) {
        return res.status(401).json({ 
            message: 'Bạn chưa đăng nhập (Thiếu Token).' 
        });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        // req.user đã có từ hàm protect chạy trước đó
        if (!req.user) {
            return res.status(401).json({ message: 'User chưa được xác thực.' });
        }

        // Kiểm tra Role
        // Lưu ý: req.user.role phải khớp với enum trong DB (admin, candidate...)
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: `Bạn không có quyền truy cập (Yêu cầu quyền: ${roles.join(', ')})` 
            });
        }
        
        next();
    };
};