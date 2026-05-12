const express = require("express");
const router = express.Router();
const jobChatController = require("../controllers/jobChat.controllers");
const { authorize, protect } = require("../middleware/authMiddleware");
const { ROLES } = require("../constants/roles");

router.use(protect);
router.use(authorize(ROLES.CANDIDATE));

// Craete chat endpoint
router.post("/chat", jobChatController.chat);
//Get all chat history of user
router.get("/chat-history", jobChatController.history);
module.exports = router;
