const express = require("express");
const router = express.Router();
const chat = require("../controllers/chat.controller");
const { authorize, protect } = require("../middleware/authMiddleware");
const { ROLES } = require("../constants/roles");

router.use(protect);
router.use(authorize(ROLES.CANDIDATE));

// Craete chat endpoint
router.post("/", chat.chat);
//Get all chat history of user
router.get("/", chat.chatHistory);

module.exports = router;
