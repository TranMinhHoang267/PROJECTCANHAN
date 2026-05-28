const express = require("express");
const router = express.Router();
const smartController = require("../controllers/smart.controllers");
const { authorize, protect } = require("../middleware/authMiddleware");
const { ROLES } = require("../constants/roles");

router.use(protect);
router.use(authorize(ROLES.RECRUITER));

router.post("/scoring-cv", smartController.smartScoringCV);
module.exports = router;
