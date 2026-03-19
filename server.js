require('dotenv').config();
const sequelize = require('./src/config/database'); // Kết nối Database
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// import thư viện
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');


// Cấu hình Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' } // Cho phép load file tĩnh từ origin khác (PDF Viewer)
}));
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// Serve file tĩnh (avatar, CV PDF...)
app.use('/uploads', express.static(require('path').join(__dirname, 'src/uploads')));


// CRUD-methods , create-post, read-get, update-put, delete-delete
// route mặc đinh
// Import routes
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const candidate_profile = require('./src/routes/candidate_Routes');
const avatarRoutes = require('./src/routes/avatarRoute');
const portfolioRoutes = require('./src/routes/PortfolioRoutes');
const resumeRoutes = require('./src/routes/ResumeRoutes');
const applicationRoutes    = require('./src/routes/ApplicationRoutes');
const bookmarkRoutes       = require('./src/routes/BookmarkRoutes');
const jobSuggestionRoutes  = require('./src/routes/JobSuggestionRoutes');
const employerRoutes       = require('./src/routes/EmployerRoutes');
const jobManagementRoutes  = require('./src/routes/JobManagementRoutes');
const applicantRoutes      = require('./src/routes/ApplicantRoutes');
const dashboardRoutes      = require('./src/routes/DashboardRoutes');
const adminCompanyRoutes   = require('./src/routes/AdminCompanyRoutes');
const adminJobRoutes       = require('./src/routes/AdminJobRoutes');
const adminReportRoutes    = require('./src/routes/AdminReportRoutes');
const searchJobRoutes      = require('./src/routes/Search_jobRoutes');
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/candidate', candidate_profile);
app.use('/api/avatar', avatarRoutes);   
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/applications',      applicationRoutes);
app.use('/api/bookmarks',         bookmarkRoutes);
app.use('/api/suggestions',       jobSuggestionRoutes);
app.use('/api/search-jobs',       searchJobRoutes); 
// --- Employer ---
app.use('/api/employer',            employerRoutes);
app.use('/api/employer/jobs',       jobManagementRoutes);
app.use('/api/employer/applicants', applicantRoutes);
app.use('/api/employer/dashboard',  dashboardRoutes);
// --- Admin ---
app.use('/api/admin/companies',     adminCompanyRoutes);
app.use('/api/admin/jobs',          adminJobRoutes);
app.use('/api/admin/reports',       adminReportRoutes);


app.get('/', (req, res) => {
    res.status(200).json({
        status: 'Ok',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});



// Đồng bộ Database và khởi động Server
sequelize.sync({ alter: true }).then(() => {
    console.log('✅ Database & Tables synced!');
    app.listen(PORT, () => {
        console.log(`✅ Server is running on port: http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ Failed to sync database:', err);
});

