const express = require("express");
const router = express.Router();
const suggestion = require("../controllers/chat.controller");
const { authorize, protect } = require("../middleware/authMiddleware");
const { ROLES } = require("../constants/roles");

router.use(protect);
router.use(authorize(ROLES.CANDIDATE));

// Craete chat endpoint
router.post("/chat", suggestion.chat);
//Get all chat history of user
router.get("/chat-history", suggestion.chatHistory);

module.exports = router;
