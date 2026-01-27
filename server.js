require ('dotenv').config();
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
app.use(helmet());
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());


// CRUD-methods , create-post, read-get, update-put, delete-delete
// route mặc đinh
// Import routes
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const candidate_profile = require('./src/routes/candidate_Routes');
const avatarRoutes = require('./src/routes/avatarRoute');
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/candidate', candidate_profile);
app.use('/api/avatar', avatarRoutes);   

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

