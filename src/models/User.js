const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');
const ROLES = require('../constants/roles');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    full_name: {
        type: DataTypes.STRING
    },
    role: {
        type: DataTypes.STRING, 
        defaultValue: ROLES.CANDIDATE
    },
    avatar_url: {
        type: DataTypes.STRING
    },
    phone: {
        type: DataTypes.STRING, // Nên để STRING để giữ số 0 ở đầu (VD: 098...)
        allowNull: false,       // Không được phép để trống
        unique: true,           // <--- QUAN TRỌNG: Đảm bảo không trùng lặp trong DB
        validate: {
        notEmpty: { msg: "Số điện thoại không được để trống" },
        is: {
            args: /^[0-9]{10,11}$/, // Regex: Chỉ chấp nhận số, độ dài 10-11 ký tự
            msg: "Số điện thoại phải bao gồm 10-11 chữ số"
        }
    } 
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Method to compare password
User.prototype.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = User;