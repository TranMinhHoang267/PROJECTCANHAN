const { messageResponse, TYPE } = require("../utils/format/response.format");

const prisma = require("../config/prisma");
const {
  geminiGeneration,
  TEMPLATE_TYPE,
} = require("../lib/providers/gemini.providers");

/**
 * @description This file is for recruiter services, using for filtering by AI.
 * When use this function, the system will colect all CVs that applied for the job, then send to AI to analytics and filtering by request (optional)
 * @param {String} jobId
 * @param {String|null|undefined} [reqOpt]
 * @return {Promise<Record<String,String>>}
 */
exports.smartScoringCV = async (jobId, reqOpt = null) => {
  //check if jobId is valid and
  //collect all CVs that applied for the job
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      description: true,
      salaryMin: true,
      salaryMax: true,
      jobType: true,
      jobLevel: true,
      skills: {
        select: {
          skill: true,
        },
      },
      applications: {
        select: {
          resume: {
            select: {
              id: true,
              summary: true,
            },
          },
        },
      },
    },
  });
  if (!job) {
    return messageResponse(TYPE.error, "Job not found");
  }

  const cleanResult = {
    jobId: job.id,
    jobTitle: job.title,
    jobDescription: job.description,
    jobSalaryMin: job.salaryMin,
    jobSalaryMax: job.salaryMax,
    jobType: job.jobType,
    jobLevel: job.obLevel,
    jobSkills: job.skills.map((s) => s.skill),
    applications: job.applications.map((app) => ({
      resumeId: app.resume.id,
      resumeSummary: app.resume.summary,
    })),
  };

  const prompt = `${JSON.stringify(cleanResult)}\n
  Yêu cầu: ${reqOpt ?? "Không"}`;
  const result = await geminiGeneration(prompt, 0, TEMPLATE_TYPE.recruiter);
  if (result.title === "FAILED") {
    return messageResponse(TYPE.failed, result.message);
  }

  console.log("Raw AI Result:", result);
  const sorted = result.data.sort((a, b) => b.score - a.score);

  return messageResponse(
    TYPE.success,
    "Scoring completed successfully",
    sorted,
  );
};
