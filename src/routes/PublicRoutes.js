const express = require('express');
const router = express.Router();

const publicController = require('../controllers/PublicController');
const suggestion = require("../controllers/chat.controller");



// Xem chi tiết công việc (Public)


// GET /api/public/jobs/:id
router.get('/jobs/:id', publicController.getJobDetail);
// GET /api/public/jobs (lấy danh sách công việc public)
router.get('/jobs', publicController.getAllJobs);

// Xem chi tiết công ty (Public)
// GET /api/public/companies/:id    
router.get('/companies/:id', publicController.getCompanyDetail);
// GET /api/public/companies (lấy danh sách công ty public)
router.get('/companies', publicController.getAllCompanies);

//Get job suggestions based on keyword and filters
router.get("/job-suggestions", suggestion.getJobSuggestions);

// Export router
module.exports = router;
