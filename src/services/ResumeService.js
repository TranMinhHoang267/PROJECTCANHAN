const prisma = require("../config/prisma");
const path = require("path");
const fs = require("fs");
const ResumeVectorService = require("./resumeVector.services");
const process = require("process");

const UPLOAD_DIR = path.join(process.cwd(), "src", "uploads", "resumes");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 *
 * @param {*} userId
 * @param {*} file
 * @returns
 */
exports.uploadResume = async (userId, file) => {
  const count = await prisma.resume.count({ where: { userId } });

  const fileUrl = `/uploads/resumes/${file.filename}`;

  const resume = await prisma.resume.create({
    data: {
      userId,
      title: file.originalname,
      fileUrl,
      isDefault: count === 0,
    },
  });

  //when storing success, we will process the content of file to embedding
  if (resume) {
    global.setImmediate(async () => {
      try {
        console.log(
          `[Background Job] Starting embedding process for Resume ID: ${resume.id}`,
        );
        await ResumeVectorService.processAndStoreResumeVector(resume, userId);
      } catch (err) {
        console.error(
          `[Background Job] Error occurred while processing embedding for Job ID: ${resume.id}`,
          err,
        );
        await prisma.resume.update({
          where: { id: resume.id },
          data: { vectorStatus: "FAILED" },
        });
      }
    });
  }

  return resume;
};

exports.getResumes = async (userId) => {
  return await prisma.resume.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      fileUrl: true,
      isDefault: true,
      createdAt: true,
    },
  });
};

exports.setDefault = async (userId, resumeId) => {
  await prisma.resume.updateMany({
    where: { userId },
    data: { isDefault: false },
  });

  const updated = await prisma.resume.updateMany({
    where: { id: resumeId, userId },
    data: { isDefault: true },
  });

  if (updated.count === 0) {
    throw new Error("Không tìm thấy CV hoặc bạn không có quyền thay đổi.");
  }

  return await prisma.resume.findUnique({ where: { id: resumeId } });
};

exports.deleteResume = async (userId, resumeId) => {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
  });

  if (!resume) {
    throw new Error("Không tìm thấy CV hoặc bạn không có quyền xóa.");
  }

  const filePath = path.join(process.cwd(), "src", resume.fileUrl);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Không thể xóa file CV:", err.message);
    }
  }

  await prisma.resume.delete({ where: { id: resumeId } });

  if (resume.isDefault) {
    const latest = await prisma.resume.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      await prisma.resume.update({
        where: { id: latest.id },
        data: { isDefault: true },
      });
    }
  }

  return true;
};

exports.getFilePath = async (userId, resumeId) => {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
  });
  if (!resume) {
    throw new Error("Không tìm thấy CV hoặc bạn không có quyền xem.");
  }
  const relativePath = resume.fileUrl.replace(/^\//, "");
  const pathsToTry = [
    path.join(process.cwd(), "src", relativePath),
    path.join(process.cwd(), relativePath),
    path.join(__dirname, "..", "..", "src", relativePath),
    path.join(__dirname, "..", "..", relativePath)
  ];

  let filePath = null;
  for (const p of pathsToTry) {
    const resolvedPath = path.resolve(p);
    if (fs.existsSync(resolvedPath)) {
      filePath = resolvedPath;
      break;
    }
  }

  if (!filePath) {
    throw new Error("File CV không tồn tại trên server.");
  }
  return { filePath, fileName: resume.title };
};