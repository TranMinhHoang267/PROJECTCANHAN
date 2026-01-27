const ROLES = {
    ADMIN: 'admin',
    CANDIDATE: 'candidate',
    RECRUITER: 'recruiter'
};

// Tạo mảng chứa các giá trị: ['admin', 'candidate', 'recruiter']
// Dùng để validate input đầu vào nhanh chóng
const ROLE_LIST = Object.values(ROLES);

module.exports = {
    ROLES,
    ROLE_LIST
};