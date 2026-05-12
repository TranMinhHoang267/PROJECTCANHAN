// @ts-nocheck
const cron = require("node-cron");

const prisma = require("../config/prisma"); // Path to your Prisma client
const { processAndStoreJobVector } = require("../services/jobVector.services");
const {
  processAndStoreResumeVector,
} = require("../services/resumeVector.services");

let scheduledTask = null;
let isRuning = false;

/**

* Sets a schedule to scan Jobs that have not been successfully processed as vectors.

* @description Runs at 00:00 every day (as required, check every 24 hours).

*/
const setupVectorSchedule = () => {
  // Structure: 'minutes hour days month day of the week'

  // '0 0 * * *' corresponds to 00:00 daily
  scheduledTask = cron.schedule("*/30 * * * *", async () => {
    if (isRuning) return;
    isRuning = true;
    console.log(
      "[SCHEDULE] Start scanning for faulty or unprocessed vector Jobs...",
    );

    try {
      // Find Jobs with PENDING or FAILED status
      const incompleteJobs = await prisma.job.findMany({
        where: {
          OR: [{ vectorStatus: "PENDING" }, { vectorStatus: "FAILED" }],
        },
        take: 5,
      });

      console.log(
        `[SCHEDULE] Found ${incompleteJobs.length} Job that needs reprocessing.`,
      );

      for (const job of incompleteJobs) {
        // Re-processing (Do not use await to avoid loop bottleneck if a job fails)
        processAndStoreJobVector(job)
          .then(() => console.log(`[SCHEDULE] Re-processed Job ID: ${job.id}`))

          .catch((err) =>
            console.error(`[SCHEDULE] Error re-processing Job ${job.id}:`, err),
          );
      }
    } catch (error) {
      console.error(
        "[SCHEDULE] Fatal error while executing Cron Job:",

        error,
      );
    }

    console.log(
      "[SCHEDULE] Start scanning for faulty or unprocessed vector Resumes...",
      // Find Resumes with PENDING or FAILED status
    );
    const incompleteResumes = await prisma.resume.findMany({
      where: {
        OR: [{ vectorStatus: "PENDING" }, { vectorStatus: "FAILED" }],
      },
      select: {
        id: true,
        userId: true,
        fileUrl: true,
      },
    });

    console.log(
      `[SCHEDULE] Found ${incompleteResumes.length} Job that needs reprocessing.`,
    );

    for (const job of incompleteResumes) {
      // Re-processing (Do not use await to avoid loop bottleneck if a job fails)
      processAndStoreResumeVector(job, job.userId)
        .then(() => console.log(`[SCHEDULE] Re-processed Job ID: ${job.id}`))

        .catch((err) =>
          console.error(`[SCHEDULE] Error re-processing Job ${job.id}:`, err),
        );
    }
  });

  console.log(
    "[SYSTEM] Vectorization Schedule has been triggered (00:00 daily).",
  );
};

const stopVectorSchedule = () => {
  if (scheduledTask) {
    scheduledTask.stop();

    scheduledTask = null;
    console.log("[SYSTEM] Vectorization Schedule has been disabled.");
  }
};

module.exports = { setupVectorSchedule, stopVectorSchedule };
