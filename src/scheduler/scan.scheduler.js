const cron = require("node-cron");
const prisma = require("../config/prisma");
const { pdfReader } = require("../utils/reader/docs.reader");
const {
  geminiGeneration,
  TEMPLATE_TYPE,
} = require("../lib/providers/gemini.providers");

let isSummaryScanRunning = false;
let summaryScanTask = null;

async function scanAndFixNullSummaries() {
  if (isSummaryScanRunning) {
    console.log("[SUMMARY-SCAN] ⏳ Lần quét trước chưa kết thúc, bỏ qua chu kỳ này.");
    return;
  }

  isSummaryScanRunning = true;

  try {
    // Dùng query raw để an toàn với kiểu Json nullable của Prisma
    const nullResumes = await prisma.$queryRaw`
      SELECT id, file_url as "fileUrl"
      FROM resumes
      WHERE summary IS NULL
      LIMIT 10
    `;

    if (!nullResumes || nullResumes.length === 0) {
      // Bỏ qua log nếu không có gì để tránh trôi log
      return;
    }

    console.log(`\n[SUMMARY-SCAN] 📋 Tìm thấy ${nullResumes.length} Resume bị null summary. Bắt đầu xử lý...`);
    
    for (const resume of nullResumes) {
      console.log(`[SUMMARY-SCAN] ⚙️  Đang xử lý tạo lại summary cho Resume ID: ${resume.id}`);
      
      try {
        const rawText = await pdfReader(resume.fileUrl);
        const prompt = `Đây là thông tin về một CV ứng tuyển:\n\n${rawText}`;
        const result = await geminiGeneration(prompt, 0, TEMPLATE_TYPE.internal);

        if (result.title === "FAILED") {
          console.warn(
            `[SUMMARY-SCAN] ❌ Gemini failed to process Resume ${resume.id} for summary generation. Error: ${result.message}`
          );
          // Trả về null hoặc bỏ qua để lần sau quét lại
          continue; 
        }
        
        await prisma.resume.update({
          where: { id: resume.id },
          data: { summary: result },
        });
        
        console.log(`[SUMMARY-SCAN] ✅ Cập nhật summary thành công cho Resume ID: ${resume.id}`);
      } catch (error) {
        console.error(`[SUMMARY-SCAN] ❌ Lỗi khi xử lý Resume ID ${resume.id}:`, error.message);
      }
    }
  } catch (err) {
    console.error("[SUMMARY-SCAN] ❌ Lỗi không mong đợi trong quá trình quét:", err.message);
  } finally {
    isSummaryScanRunning = false;
  }
}

const setupScanSummarySchedule = () => {
  // Chạy mỗi 1 phút
  summaryScanTask = cron.schedule("*/1 * * * *", () => {
    scanAndFixNullSummaries();
  });
  console.log("[SYSTEM] Summary Scan Schedule (quét summary NULL) đã được kích hoạt (mỗi 1 phút).");
};

const stopScanSummarySchedule = () => {
  if (summaryScanTask) {
    summaryScanTask.stop();
    summaryScanTask = null;
    console.log("[SYSTEM] Summary Scan Schedule đã dừng.");
  }
};

module.exports = {
  setupScanSummarySchedule,
  stopScanSummarySchedule,
};
