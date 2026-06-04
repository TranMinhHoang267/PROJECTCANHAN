// @ts-nocheck
/**
 * vectorScan.scheduler.js
 *
 * Scheduler RIÊNG - chạy MỖI 1 PHÚT.
 * Mục đích: Quét tìm các bản ghi Job và Resume có vectorStatus = 'PENDING' hoặc 'FAILED',
 *           sau đó trigger lại quá trình xử lý vector cho từng bản ghi.
 *
 * ĐỂ KIỂM THỬ THỦ CÔNG:
 *   1. Tạo thủ công 1 bản ghi job/resume trong DB với vectorStatus = 'FAILED' hoặc 'PENDING'
 *      và summary = null (đối với resume).
 *   2. Chờ tối đa 1 phút → Scheduler sẽ nhặt bản ghi này và xử lý lại.
 *   3. Kiểm tra xem vectorStatus đã đổi thành 'COMPLETED' chưa
 *      và summary đã được cập nhật chưa (đối với resume).
 *
 
 */

const cron = require("node-cron");
const prisma = require("../config/prisma");
const { processAndStoreJobVector } = require("../services/jobVector.services");
const { processAndStoreResumeVector } = require("../services/resumeVector.services");

// --- Trạng thái chống chạy đè ---
let isScanRunning = false;

// --- Hàm quét và xử lý lại Job vectors ---
async function scanAndRetryJobs() {
  console.log("[VECTOR-SCAN] 🔍 Đang quét Jobs có vectorStatus PENDING/FAILED...");

  const failedJobs = await prisma.job.findMany({
    where: {
      OR: [{ vectorStatus: "PENDING" }, { vectorStatus: "FAILED" }],
    },
    include: {
      company: {
        select: { userId: true },
      },
    },
    take: 10, // Tối đa 10 bản ghi mỗi lần quét để tránh quá tải
  });

  if (failedJobs.length === 0) {
    console.log("[VECTOR-SCAN] ✅ Không tìm thấy Job nào cần xử lý lại.");
    return;
  }

  console.log(`[VECTOR-SCAN] 📋 Tìm thấy ${failedJobs.length} Job cần xử lý lại.`);

  for (const job of failedJobs) {
    const userId = job.company?.userId;
    if (!userId) {
      console.warn(`[VECTOR-SCAN] ⚠️  Job ID ${job.id} không có userId của company, bỏ qua.`);
      continue;
    }

    console.log(`[VECTOR-SCAN] ⚙️  Đang xử lý lại Job ID: ${job.id} (title: "${job.title}")`);

    // Không dùng await ở đây để tránh block loop khi 1 job bị lỗi
    processAndStoreJobVector(job, userId)
      .then(() => {
        console.log(`[VECTOR-SCAN] ✅ Hoàn thành xử lý vector Job ID: ${job.id}`);
      })
      .catch((err) => {
        console.error(`[VECTOR-SCAN] ❌ Lỗi khi xử lý vector Job ID ${job.id}:`, err.message);
      });
  }
}

// --- Hàm quét và xử lý lại Resume vectors ---
async function scanAndRetryResumes() {
  console.log("[VECTOR-SCAN] 🔍 Đang quét Resumes có vectorStatus PENDING/FAILED...");

  const failedResumes = await prisma.resume.findMany({
    where: {
      OR: [{ vectorStatus: "PENDING" }, { vectorStatus: "FAILED" }],
    },
    select: {
      id: true,
      userId: true,
      fileUrl: true,
      summary: true,       // Dùng để log kiểm tra xem summary có null không
      vectorStatus: true,
    },
    take: 10, // Tối đa 10 bản ghi mỗi lần quét
  });

  if (failedResumes.length === 0) {
    console.log("[VECTOR-SCAN] ✅ Không tìm thấy Resume nào cần xử lý lại.");
    return;
  }

  console.log(`[VECTOR-SCAN] 📋 Tìm thấy ${failedResumes.length} Resume cần xử lý lại.`);

  for (const resume of failedResumes) {
    console.log(
      `[VECTOR-SCAN] ⚙️  Đang xử lý lại Resume ID: ${resume.id} | summary: ${resume.summary === null ? "NULL (sẽ được cập nhật)" : "đã có"} | status: ${resume.vectorStatus}`
    );

    // Không dùng await ở đây để tránh block loop khi 1 resume bị lỗi
    processAndStoreResumeVector(resume)
      .then(() => {
        console.log(`[VECTOR-SCAN] ✅ Hoàn thành xử lý vector Resume ID: ${resume.id}`);
      })
      .catch((err) => {
        console.error(`[VECTOR-SCAN] ❌ Lỗi khi xử lý vector Resume ID ${resume.id}:`, err.message);
      });
  }
}

// --- Hàm chính: chạy cả 2 trigger trong 1 lần schedule ---
async function runScan() {
  if (isScanRunning) {
    console.log("[VECTOR-SCAN] ⏳ Lần quét trước chưa kết thúc, bỏ qua chu kỳ này.");
    return;
  }

  isScanRunning = true;
  const startTime = new Date().toISOString();
  console.log(`\n[VECTOR-SCAN] ===== BẮT ĐẦU QUÉT LÚC ${startTime} =====`);

  try {
    // Trigger 1: Xử lý lại Job vectors
    await scanAndRetryJobs();

    // Trigger 2: Xử lý lại Resume vectors (kèm cập nhật summary nếu null)
    await scanAndRetryResumes();
  } catch (err) {
    console.error("[VECTOR-SCAN] ❌ Lỗi không mong đợi trong quá trình quét:", err.message);
  } finally {
    isScanRunning = false;
    console.log(`[VECTOR-SCAN] ===== KẾT THÚC QUÉT =====\n`);
  }
}

// --- Khởi động Scheduler ---
let scanTask = null;

/**
 * Đăng ký cron job chạy MỖI 1 PHÚT.
 * Gọi hàm này trong server.js hoặc nơi khởi động app:
 *   const { setupVectorScanSchedule } = require('./src/scheduler/vectorScan.scheduler');
 *   setupVectorScanSchedule();
 */
const setupVectorScanSchedule = () => {
  if (scanTask) {
    console.warn("[VECTOR-SCAN] ⚠️  Scheduler đã được khởi động trước đó, bỏ qua.");
    return;
  }

  // Cron: '* * * * *' = mỗi 1 phút
  scanTask = cron.schedule("* * * * *", runScan);

  console.log("[VECTOR-SCAN] 🚀 Vector Scan Scheduler đã khởi động — chạy MỖI 1 PHÚT.");
  console.log("[VECTOR-SCAN] 📌 Để kiểm thử: Tạo thủ công bản ghi Job/Resume với vectorStatus='FAILED' trong DB,");
  console.log("[VECTOR-SCAN]    sau đó chờ tối đa 1 phút và kiểm tra xem vectorStatus='COMPLETED' và summary đã cập nhật chưa.");
};

const stopVectorScanSchedule = () => {
  if (scanTask) {
    scanTask.stop();
    scanTask = null;
    console.log("[VECTOR-SCAN] 🛑 Vector Scan Scheduler đã dừng.");
  }
};

module.exports = { setupVectorScanSchedule, stopVectorScanSchedule };
