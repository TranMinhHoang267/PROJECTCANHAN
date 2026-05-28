const multer = require("multer");
const path = require("path");
const fs = require("fs");
const prisma = require("../config/prisma");
const process = require("process");
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "resumes");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `resume-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = async (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Chỉ chấp nhận file PDF!"), false);
  }

  try {
    const count = await prisma.resume.count({ where: { userId: req.user.id } });
    if (count >= 3) {
      return cb(
        new Error(
          "Bạn chỉ được upload tối đa 3 CV. Vui lòng xóa CV cũ trước khi upload mới.",
        ),
        false,
      );
    }
    cb(null, true);
  } catch (error) {
    cb(error, false);
  }
};

const uploadResumeConfig = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

module.exports = uploadResumeConfig;
