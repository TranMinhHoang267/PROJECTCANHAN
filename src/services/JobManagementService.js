const prisma = require("../config/prisma");
const JobVectorService = require("./jobVector.services");
const _getApprovedCompany = async (userId) => {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) throw new Error("Bạn chưa có hồ sơ công ty.");
  if (company.status !== "approved")
    throw new Error(
      "Hồ sơ công ty chưa được Admin duyệt. Bạn chưa thể đăng tin.",
    );
  return company;
};

const _getOwnJob = async (userId, jobId) => {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) throw new Error("Bạn chưa có hồ sơ công ty.");

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: company.id },
    include: {
      skills: {
        include: { skill: { select: { id: true, name: true } } },
      },
      company: true,
    },
  });
  if (!job)
    throw new Error(
      "Không tìm thấy tin đăng hoặc bạn không có quyền thao tác.",
    );

  job.skills = job.skills.map((js) => js.skill);
  return job;
};

const _attachSkills = async (jobId, skills) => {
  const skillIds = [];
  for (const name of skills) {
    const cleanName = name.trim();
    if (!cleanName) continue;
    const skill = await prisma.skill.upsert({
      where: { name: cleanName },
      update: {},
      create: { name: cleanName },
    });
    skillIds.push({ skillId: skill.id });
  }

  await prisma.job_skill.deleteMany({ where: { jobId } });
  if (skillIds.length > 0) {
    await prisma.job_skill.createMany({
      data: skillIds.map((s) => ({ jobId, skillId: s.skillId })),
    });
  }
};

exports.createJob = async (userId, data) => {
  const company = await _getApprovedCompany(userId);

  const {
    title,
    description,
    requirements,
    benefits,
    salaryMin,
    salaryMax,
    location,
    jobType,
    jobLevel,
    deadline,
    skills = [],
  } = data;

  if (!title?.trim()) throw new Error("Tiêu đề công việc không được để trống.");

  const job = await prisma.job.create({
    data: {
      companyId: company.id,
      title: title.trim(),
      description: description?.trim() || null,
      requirements: requirements?.trim() || null,
      benefits: benefits?.trim() || null,
      salaryMin: salaryMin || null,
      salaryMax: salaryMax || null,
      location: location?.trim() || null,
      jobType: jobType?.trim() || null,
      jobLevel: jobLevel?.trim() || null,
      deadline: deadline || null,
      status: "pending",
      vectorStatus: "PENDING",
    },
  });

  /**
   * Warning: In development env,
   * We will use the feature called 'fire and forget'.
   * When job created and store in database, we will immediately return response to client without waiting for the embedding process to complete.
   * The embedding process will be handled asynchronously in the background.
   * This approach allows us to provide a faster response time to the client, improving the user experience.
   * However, it also means that there may be a delay before the job's embedding is available for use in features like job matching or search.
   * In production, we might want to implement a more robust solution, such as using a message queue to handle the embedding process and ensure reliability.
   */

  /**
   * But first, we need to check  if job created successfully or not
   */

  if (job) {
    // We will not await this function, it will run in the background
    global.setImmediate(async () => {
      try {
        console.log(
          `[Background Job] Starting embedding process for Job ID: ${job.id}`,
        );
        await JobVectorService.processAndStoreJobVector(job);
      } catch (err) {
        console.error(
          `[Background Job] Error occurred while processing embedding for Job ID: ${job.id}`,
          err,
        );
        await prisma.job.update({
          where: { id: job.id },
          data: { vectorStatus: "FAILED" },
        });
        throw err;
      }
    });
  }

  if (skills.length > 0) {
    await _attachSkills(job.id, skills);
  }

  return await _getOwnJob(userId, job.id);
};

exports.getMyJobs = async (userId, filters = {}) => {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) throw new Error("Bạn chưa có hồ sơ công ty.");

  const pageSize = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
  const pageNumber = Math.max(1, parseInt(filters.page) || 1);
  const skip = (pageNumber - 1) * pageSize;

  const where = { companyId: company.id };
  if (filters.status) where.status = filters.status;

  const [count, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      include: {
        skills: {
          include: { skill: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
  ]);

  const transformedJobs = jobs.map((job) => ({
    ...job,
    skills: job.skills.map((js) => js.skill),
  }));

  return {
    total_items: count,
    total_pages: Math.ceil(count / pageSize),
    current_page: pageNumber,
    jobs: transformedJobs,
  };
};

exports.getJobDetail = async (userId, jobId) => {
  return await _getOwnJob(userId, jobId);
};

exports.updateJob = async (userId, jobId, data) => {
  const job = await _getOwnJob(userId, jobId);

  if (job.status === "rejected") {
    throw new Error("Tin đăng đã bị từ chối. Vui lòng tạo tin đăng mới.");
  }

  const {
    title,
    description,
    requirements,
    benefits,
    salaryMin,
    salaryMax,
    location,
    jobType,
    jobLevel,
    deadline,
    skills,
  } = data;

  if (title !== undefined && !title?.trim()) {
    throw new Error("Tiêu đề công việc không được để trống.");
  }

  const updateData = {};
  if (title !== undefined) updateData.title = title.trim();
  if (description !== undefined)
    updateData.description = description?.trim() || null;
  if (requirements !== undefined)
    updateData.requirements = requirements?.trim() || null;
  if (benefits !== undefined) updateData.benefits = benefits?.trim() || null;
  if (salaryMin !== undefined) updateData.salaryMin = salaryMin;
  if (salaryMax !== undefined) updateData.salaryMax = salaryMax;
  if (location !== undefined) updateData.location = location?.trim() || null;
  if (jobType !== undefined) updateData.jobType = jobType?.trim() || null;
  if (jobLevel !== undefined) updateData.jobLevel = jobLevel?.trim() || null;
  if (deadline !== undefined) updateData.deadline = deadline;

  if (Object.keys(updateData).length > 0 && job.status !== "paused") {
    updateData.status = "pending";
    updateData.rejectionReason = null;
  }

  const updatedJob = await prisma.job.update({
    where: { id: jobId },
    data: updateData,
  });

  /**
   * Warning: In development env,
   * We will use the feature called 'fire and forget'.
   * When job created and store in database, we will immediately return response to client without waiting for the embedding process to complete.
   * The embedding process will be handled asynchronously in the background.
   * This approach allows us to provide a faster response time to the client, improving the user experience.
   * However, it also means that there may be a delay before the job's embedding is available for use in features like job matching or search.
   * In production, we might want to implement a more robust solution, such as using a message queue to handle the embedding process and ensure reliability.
   */

  /**
   * But first, we need to check  if job created successfully or not
   */

  if (updatedJob) {
    // We will not await this function, it will run in the background
    global.setImmediate(async () => {
      try {
        console.log(
          `[Background Job] Starting embedding process for Job ID: ${updatedJob.id}`,
        );
        await JobVectorService.processAndStoreJobVector(updatedJob);
      } catch (err) {
        console.error(
          `[Background Job] Error occurred while processing embedding for Job ID: ${updatedJob.id}`,
          err,
        );
        await prisma.job.update({
          where: { id: updatedJob.id },
          data: { vectorStatus: "FAILED" },
        });
      }
    });
  }

  if (Array.isArray(skills) && skills.length > 0) {
    await _attachSkills(jobId, skills);
  }

  return await _getOwnJob(userId, jobId);
};

exports.togglePauseJob = async (userId, jobId) => {
  const job = await _getOwnJob(userId, jobId);

  if (job.status === "pending")
    throw new Error("Tin đang chờ duyệt. Không thể tạm dừng lúc này.");
  if (job.status === "rejected")
    throw new Error("Tin đã bị từ chối. Không thể tạm dừng.");

  if (job.status === "paused") {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "approved" },
    });
    return { status: "approved", message: "Đã mở lại tin tuyển dụng." };
  } else {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "paused" },
    });
    return { status: "paused", message: "Đã tạm dừng tin tuyển dụng." };
  }
};

exports.deleteJob = async (userId, jobId) => {
  // eslint-disable-next-line no-unused-vars
  const job = await _getOwnJob(userId, jobId);
  await prisma.job.delete({ where: { id: jobId } });
  return true;
};
