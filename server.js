require("dotenv").config();
const process = require("process");
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// export the app and server for testing

// import thư viện
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
// const rateLimit = require('express-rate-limit');

// Cấu hình Middleware
app.use(
  helmet.default({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Cho phép load file tĩnh từ origin khác (PDF Viewer)
  }),
);
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

// Serve file tĩnh (avatar, CV PDF...)
// src/uploads là nơi multer thực sự lưu file (khớp với volume mount trong Docker)
app.use("/uploads", express.static(path.join(process.cwd(), "src", "uploads")));
// CRUD-methods , create-post, read-get, update-put, delete-delete
// route mặc đinh
// Import routes
const authRoutes = require("./src/routes/authRoutes");
const candidate_profile = require("./src/routes/candidate_Routes");
const avatarRoutes = require("./src/routes/avatarRoute");
const portfolioRoutes = require("./src/routes/PortfolioRoutes");
const resumeRoutes = require("./src/routes/ResumeRoutes");
const applicationRoutes = require("./src/routes/ApplicationRoutes");
const bookmarkRoutes = require("./src/routes/BookmarkRoutes");
const jobSuggestionRoutes = require("./src/routes/JobSuggestionRoutes");
const employerRoutes = require("./src/routes/EmployerRoutes");
const jobManagementRoutes = require("./src/routes/JobManagementRoutes");
const applicantRoutes = require("./src/routes/ApplicantRoutes");
const dashboardRoutes = require("./src/routes/DashboardRoutes");
const adminCompanyRoutes = require("./src/routes/AdminCompanyRoutes");
const adminJobRoutes = require("./src/routes/AdminJobRoutes");
const adminReportRoutes = require("./src/routes/AdminReportRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const searchJobRoutes = require("./src/routes/Search_jobRoutes");
const chat = require("./src/routes/chat.routers");
const {
  setupVectorSchedule,
} = require("./src/scheduler/vectorRetry.scheduler");
const smartRoutes = require("./src/routes/smart.routers");
// Router công khai
const publicRoutes = require("./src/routes/PublicRoutes");
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/candidate", candidate_profile);
app.use("/api/avatar", avatarRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/suggestions", jobSuggestionRoutes);
app.use("/api/search-jobs", searchJobRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/smart", smartRoutes);

// --- Employer ---
app.use("/api/employer", employerRoutes);
app.use("/api/employer/jobs", jobManagementRoutes);
app.use("/api/employer/applicants", applicantRoutes);
app.use("/api/employer/dashboard", dashboardRoutes);
app.use("/api/chat", chat);

// --- Admin ---
app.use("/api/admin/companies", adminCompanyRoutes);
app.use("/api/admin/jobs", adminJobRoutes);
app.use("/api/admin/reports", adminReportRoutes);
app.use("/api/admin/users", adminRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    status: "Ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

setupVectorSchedule(); // Kích hoạt lịch quét vector hàng ngày

// Khởi động Server (Database migrations handled via: npx prisma db push)
const server = app.listen(PORT, () => {
  console.log(`✅ Server is running on port: http://localhost:${PORT}`);
});

// Export app and server for testing cleanup
// For backward compatibility, also export app directly
module.exports = app;
module.exports.app = app;
module.exports.server = server;