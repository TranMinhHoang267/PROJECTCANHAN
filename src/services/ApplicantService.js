const prisma = require("../config/prisma");
const path = require("path");
const fs = require("fs");
const process = require("process");

const _getCompanyId = async (userId) => {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) throw new Error("Bạn chưa có hồ sơ công ty.");
  return company.id;
};

const _getJobIds = async (companyId) => {
  const myJobs = await prisma.job.findMany({
    where: { companyId },
    select: { id: true },
  });
  return myJobs.map((j) => j.id);
};

exports.getApplicantsByJob = async (userId, jobId, filters = {}) => {
  const companyId = await _getCompanyId(userId);

  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job)
    throw new Error(
      "Tin tuyển dụng không tồn tại hoặc không thuộc công ty bạn.",
    );

  const pageSize = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
  const pageNumber = Math.max(1, parseInt(filters.page) || 1);
  const skip = (pageNumber - 1) * pageSize;

  const where = { jobId };
  if (filters.status) where.status = filters.status;

  const [count, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      select: {
        id: true,
        status: true,
        coverLetter: true,
        createdAt: true,
        resume: {
          select: {
            id: true,
            fileUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            candidateProfile: {
              select: {
                headline: true,
                summary: true,
                address: true,
                city: true,
                dateOfBirth: true,
                gender: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
  ]);

  return {
    total_items: count,
    total_pages: Math.ceil(count / pageSize),
    current_page: pageNumber,
    applications: applications.map((app) => ({
      id: app.id,
      applicationId: app.id,
      status: app.status,
      coverLetter: app.coverLetter,
      resumeUrl: app.resume?.fileUrl,
      appliedAt: app.createdAt,
      candidate: {
        id: app.user?.id,
        fullName: app.user?.fullName,
        email: app.user?.email,
        phone: app.user?.phone,
        avatarUrl: app.user?.avatarUrl,
        headline: app.user?.candidateProfile?.headline,
        summary: app.user?.candidateProfile?.summary,
        address: app.user?.candidateProfile?.address,
        city: app.user?.candidateProfile?.city,
        dateOfBirth: app.user?.candidateProfile?.dateOfBirth,
        gender: app.user?.candidateProfile?.gender,
      },
    })),
  };
};

exports.getAllApplicants = async (userId, filters = {}) => {
  const companyId = await _getCompanyId(userId);
  const jobIds = await _getJobIds(companyId);

  const pageSize = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
  const pageNumber = Math.max(1, parseInt(filters.page) || 1);
  const skip = (pageNumber - 1) * pageSize;

  if (jobIds.length === 0) {
    return {
      total_items: 0,
      total_pages: 0,
      current_page: pageNumber,
      applications: [],
    };
  }

  const where = { jobId: { in: jobIds } };
  if (filters.status) where.status = filters.status;

  const [count, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      select: {
        id: true,
        status: true,
        createdAt: true,
        resume: {
          select: {
            id: true,
            fileUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            candidateProfile: {
              include: {
                experiences: true,
                educations: true,
                skills: {
                  include: {
                    skill: true,
                  },
                },
              },
            },
          },
        },
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
  ]);

  return {
    total_items: count,
    total_pages: Math.ceil(count / pageSize),
    current_page: pageNumber,
    applications: applications.map((app) => ({
      applicationId: app.id,
      status: app.status,
      resumeUrl: app.resume?.fileUrl || null,
      appliedAt: app.createdAt,
      job: { id: app.job?.id, title: app.job?.title },
      candidate: {
        id: app.user?.id,
        fullName: app.user?.fullName,
        email: app.user?.email,
        phone: app.user?.phone,
        avatarUrl: app.user?.avatarUrl,
        candidateProfile: app.user?.candidateProfile
          ? {
              ...app.user.candidateProfile,
              skills: app.user.candidateProfile.skills.map((cs) => cs.skill),
            }
          : null,
      },
    })),
  };
};

exports.getApplicationDetail = async (userId, applicationId) => {
  const companyId = await _getCompanyId(userId);
  const jobIds = await _getJobIds(companyId);

  const app = await prisma.application.findFirst({
    where: { id: applicationId, jobId: { in: jobIds } },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          candidateProfile: {
            select: {
              id: true,
              summary: true,
              phone: true,
              city: true,
              gender: true,
              experiences: true,
              educations: true,
              skills: { include: { skill: true } },
            },
          },
        },
      },
      job: { select: { id: true, title: true, location: true, jobType: true } },
    },
  });

  if (!app)
    throw new Error(
      "Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền xem.",
    );

  if (app.user?.candidateProfile?.skills) {
    app.user.candidateProfile.skills = app.user.candidateProfile.skills.map(
      (cs) => cs.skill,
    );
  }

  return {
    applicationId: app.id,
    status: app.status,
    coverLetter: app.coverLetter,
    resumeUrl: app.resumeUrl,
    appliedAt: app.createdAt,
    job: app.job,
    candidate: {
      id: app.user?.id,
      fullName: app.user?.fullName,
      email: app.user?.email,
      phone: app.user?.phone,
      avatarUrl: app.user?.avatarUrl,
      candidateProfile: app.user?.candidateProfile || null,
    },
  };
};

exports.getCvFile = async (userId, applicationId, mode = "view") => {
  const companyId = await _getCompanyId(userId);
  const jobIds = await _getJobIds(companyId);

  const app = await prisma.application.findFirst({
    where: { id: applicationId, jobId: { in: jobIds } },
  });

  if (!app)
    throw new Error(
      "Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền xem.",
    );
  if (!app.resume) throw new Error("Ứng viên này chưa đính kèm CV.");

  if (
    app.resume.fileUrl.startsWith("http://") ||
    app.resume.fileUrl.startsWith("https://")
  ) {
    return {
      fileUrl: app.resume.fileUrl,
      fileName: path.basename(app.resume.fileUrl),
      mode,
      isRemote: true,
    };
  }

  const relativePath = app.resumeUrl.replace(/^\//, "");

  // Danh sách các khả năng đường dẫn tuyệt đối để tìm file
  const pathsToTry = [
    path.join(process.cwd(), "src", relativePath),
    path.join(process.cwd(), relativePath),
    path.join(__dirname, "..", "..", "src", relativePath),
    path.join(__dirname, "..", "..", relativePath),
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
    console.error("--- CV FILE NOT FOUND ---");
    console.log("Tried these absolute paths:");
    pathsToTry.forEach((p) => console.log(" -", path.resolve(p)));
    console.log("Database URL:", app.resumeUrl);
    throw new Error("File CV không tồn tại trên server.");
  }

  return { filePath, fileName: path.basename(filePath), mode };
};

// ==============================================================================
// 5. CẬP NHẬT TRẠNG THÁI ĐƠN ỨNG TUYỂN
const VALID_TRANSITIONS = {
  submitted: ["under_review", "accepted", "rejected"],
  under_review: ["interview", "accepted", "rejected"],
  interview: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
};

exports.updateApplicationStatus = async (userId, applicationId, status) => {
  const validStatuses = Object.keys(VALID_TRANSITIONS);
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(", ")}`,
    );
  }

  const companyId = await _getCompanyId(userId);
  const jobIds = await _getJobIds(companyId);

  const app = await prisma.application.findFirst({
    where: { id: applicationId, jobId: { in: jobIds } },
  });
  if (!app)
    throw new Error(
      "Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền thao tác.",
    );

  const allowedNext = VALID_TRANSITIONS[app.status];

  // Trạng thái cuối không thể thay đổi
  if (allowedNext.length === 0) {
    throw new Error(
      `Đơn ứng tuyển đã ở trạng thái "${app.status}", không thể thay đổi.`,
    );
  }

  // Không nằm trong danh sách cho phép
  if (!allowedNext.includes(status)) {
    throw new Error(`Không thể chuyển từ "${app.status}" sang "${status}".`);
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { status },
  });

  return await prisma.application.findUnique({ where: { id: applicationId } });
};

// ==============================================================================
// 6. XÓA ĐƠN ỨNG TUYỂN
// ==============================================================================
exports.deleteApplication = async (userId, applicationId) => {
  const companyId = await _getCompanyId(userId);
  const jobIds = await _getJobIds(companyId);

  const app = await prisma.application.findFirst({
    where: {
      id: applicationId,
      jobId: { in: jobIds },
    },
  });

  if (!app) {
    throw new Error(
      "Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền thao tác.",
    );
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { isDeleted: true },
  });

  return true;
};
