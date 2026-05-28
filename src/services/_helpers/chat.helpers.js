const { messageResponse, TYPE } = require("../../utils/format/response.format");
const { geminiGeneration } = require("../../lib/providers/gemini.providers");
const prisma = require("../../config/prisma");
const { textEmbedding } = require("../../utils/preprocessing/textEmbedding");
const { cleaningText } = require("../../utils/preprocessing/textCleaner");
const {
  textStandardization,
} = require("../../utils/preprocessing/textStandardization");
const MIN_SIMILARITY_SCORE = parseFloat(
  process.env.MIN_SIMILARITY_SCORE || "0.3",
); // You can adjust this threshold based on your needs

/**
 * This function is process for comparison among entities
 * @param {*} refined_question
 * @param {*} entities
 * @param {*} type
 * @param {*} userId
 */
const _handleComparison = async (refined_question, entities, type, userId) => {
  if (type === "COMPANY") {
    const companyNames = entities[2]
      ? entities[2]
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
      : [];
    const results = await prisma.company.findMany({
      where: {
        OR: companyNames.map((name) => ({
          name: { contains: name, mode: "insensitive" },
        })),
      },
      select: {
        id: true,
        name: true,
        description: true,
        website: true,
        address: true,
        city: true,
        size: true,
      },
    });

    console.log("Results from vector search:", results);

    const cleanResults = results.map((company, index) => ({
      "Công ty số:": index + 1,
      id: company.id,
      Tên: company.name,
      "Mô tả": company.description,
      Website: company.website,
      "Địa chỉ": company.address,
      "Thành phố": company.city,
      "Kích thước": company.size,
    }));
    const prompt = `Danh sách công ty (Dưới dạng JSON):\n${JSON.stringify(cleanResults, null, 2)}\n\nCâu hỏi của người dùng:\n${refined_question}\n\n`;
    const response = await geminiGeneration(prompt, 0);
    return response;
  }
  if (type === "JOB") {
    const jobs = await prisma.job.findMany({
      where: {
        // @ts-ignore
        OR: entities.map((name) => ({
          title: { contains: name, mode: "insensitive" },
        })),
      },
      select: {
        id: true,
        company: {
          select: {
            name: true,
          },
        },
        title: true,
        description: true,
        benefits: true,
        salary_min: true,
        salary_max: true,
        location: true,
        job_type: true,
        jobLevel: true,
        skills: {
          select: {
            skill: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const cleanResults = jobs.map((job, index) => ({
      "Công việc số:": index + 1,
      id: job.id,
      "Vị trí": job.title,
      "Công ty": job.company.name,
      "Mức lương": `${job.salary_min} - ${job.salary_max} USD`,
      "Địa điểm": `${job.location}`,
      "Mô tả": job.description,
      "Loại việc làm": job.job_type,
      "Trình độ": job.jobLevel,
      "Kỹ năng": job.skills.map((skill) => skill),
    }));
    const prompt = `Danh sách công việc (Dưới dạng JSON):\n${JSON.stringify(cleanResults, null, 2)}\n\nCâu hỏi của người dùng:\n${refined_question}\n\n`;
    const response = await geminiGeneration(prompt, 0);
    return response;
  }
  if (type === "CV_VS_JOB") {
    const resume = await prisma.resume.findFirst({
      where: { userId: userId },
      select: { id: true, vectorStatus: true },
    });

    if (!resume || resume.vectorStatus !== "COMPLETED") {
      return messageResponse(
        TYPE.failed,
        "CV của bạn đang được xử lý hoặc chưa được tải lên. Vui lòng đợi trong giây lát.",
      );
    }

    const listJob = entities[1].split(",");
    const listCompany = entities[2].split(",");

    const jobKey = listJob.map((value) => {
      return value.trim().split(/\s+/).join(".+");
    });

    const companyKey = listCompany.map((value) => {
      return value.trim().split(/\s+/).join(".+");
    });

    console.log("Title keywords regex:", jobKey);
    console.log("Company keywords regex:", companyKey);
    const job = await prisma.$queryRaw`
      SELECT 
          j.id, 
          j.title, 
          j.description, 
          j.salary_min as "salaryMin", 
          j.salary_max as "salaryMax", 
          j.location, 
          j.job_type as "jobType",
          s.name as "skills"
      FROM "jobs" j
      JOIN "companies" c ON j.company_id = c.id 
      LEFT JOIN "job_skills" js ON j.id = js.job_id
      LEFT JOIN "skills" s ON js.skill_id = s.id
      WHERE 
          j.title ~* ANY(${jobKey})
          AND c.name ~* ANY(${companyKey})
          
          AND j.status = 'approved'
          AND j.deadline >= NOW()
`;

    console.log("Job found for CV comparison:", job);
    if (!job)
      return messageResponse(
        TYPE.failed,
        "Không tìm thấy thông tin công việc cụ thể để đánh giá. Vui lòng cung cấp nhiều thông tin hơn.",
      );

    // 3. SO SÁNH VECTOR: Lấy các đoạn CV liên quan nhất đến Job này (Sửa lỗi H3)
    // Giả sử bạn đã có vector của Job (đã lưu lúc tạo Job hoặc tạo mới tại đây)
    const jobVectors = await prisma.$queryRaw`
      SELECT embedding::text FROM "job_vectors" 
      WHERE job_id = ${job[0].id}
  `;

    // @ts-ignore
    if (!jobVectors || jobVectors.length === 0) {
      return messageResponse(
        TYPE.failed,
        "Không tìm thấy dữ liệu vector cho công việc này.",
      );
    }
    const relevantChunks = [];
    for (const jv of jobVectors) {
      const chunks = await prisma.$queryRaw`
        SELECT content, 1 - (embedding <=> ${jv.embedding}::vector) AS similarity
        FROM "resume_vectors"
        WHERE resume_id = ${resume.id}
        ORDER BY similarity DESC
        LIMIT 1
      `;
      if (chunks[0] && chunks[0].similarity > 0.4) {
        relevantChunks.push(chunks[0].content);
      }
    }

    // 3. Gộp các đoạn CV tìm được để gửi cho AI đánh giá
    const context = Array.from(new Set(relevantChunks)).join("\n---\n");

    const cleanResults = {
      "Vị trí": job[0].title,
      "Công ty": job[0].companyName,
      "Yêu cầu & Mô tả": job[0].description,
      "Kỹ năng yêu cầu": job[0].skills,
    };

    // 4. Tạo Prompt an toàn về Token
    const prompt = `
    YÊU CẦU CÔNG VIỆC:\n\n
    ${JSON.stringify(cleanResults, null, 2)}\n\n
    CÁC PHẦN LIÊN QUAN TRONG CV NGƯỜI DÙNG:\n\n
  ${context}\n\n
    CÂU HỎI: ${refined_question}\n\n
    Hãy trả lời ngắn gọn, tập trung vào sự khớp nhau về kỹ năng và kinh nghiệm.`;

    const response = await geminiGeneration(prompt, 3);
    return response;
  }
  return messageResponse(
    TYPE.failed,
    "Có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại sau.",
  );
};

/**
 * get the newest answer from history chat
 * @param {String} userId
 */
const _getNewestAnswerFromHistory = async (userId) => {
  if (!userId) return null;
  const history = await prisma.userChat.findMany({
    where: { userId: userId },
    select: {
      question: true,
      answer: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (!history) return null;

  const cleanHistory = history
    .filter((h) => {
      const lastChatTime = new Date(h.createdAt).getTime();
      const currentTime = new Date().getTime();
      const diffHours = (currentTime - lastChatTime) / (1000 * 60 * 60);
      return diffHours < 24; // Chỉ giữ lại các bản ghi trong vòng 24h
    })
    .map((h) => {
      const cleanAnswer = h.answer
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        question: h.question,
        answer: cleanAnswer,
      };
    });
  return cleanHistory;
};

/**
 * This function will search all job by the question
 * @param {String} question

 * @returns
 */
const _handleJobSearch = async (question) => {
  const vectorizationQuestion = await textEmbedding(
    textStandardization(cleaningText(question)),
  );
  //console.log("Vectorization question:", vectorizationQuestion);

  if (!vectorizationQuestion) {
    return messageResponse(
      TYPE.failed,
      "Xin lỗi, tôi không thể xử lý câu hỏi của bạn. Vui lòng thử lại sau.",
    );
  }
  /**
   * Now we will search in the database by raw SQL.
   * and join with full information.
   */
  const embeddingString = JSON.stringify(vectorizationQuestion);
  //console.log("embedding string:", embeddingString);
  const queryResults = await prisma.$queryRaw`
    SELECT DISTINCT ON (j.id) 
        j.id, 
        j.title, 
        j.description, 
        j.salary_min as "salaryMin", 
        j.salary_max as "salaryMax", 
        j.location, 
        j.job_type as "jobType",
        c.name as "companyName", 
        c.address as "companyAddress",
        c.city as "companyCity",
        (1 - (v.embedding <=> ${embeddingString}::vector)) AS similarity
    FROM "jobs" j
    JOIN "job_vectors" v ON j.id = v.job_id
    JOIN "companies" c ON j.company_id = c.id
    WHERE (1 - (v.embedding <=> ${embeddingString}::vector)) > ${MIN_SIMILARITY_SCORE} AND j.status='approved' AND j.deadline > NOW()
    ORDER BY j.id, (1 - (v.embedding <=> ${embeddingString}::vector)) DESC
    LIMIT 5;
  `;

  if (queryResults.length === 0) {
    return messageResponse(
      TYPE.failed,
      "Xin lỗi, tôi không tìm thấy thông tin nào liên quan đến câu hỏi của bạn. Vui lòng thử lại với câu hỏi khác hoặc cung cấp thêm chi tiết.",
    );
  }
  const uniqueResults = Array.from(
    new Map(queryResults.map((item) => [item.id, item])).values(),
  );
  console.log("Results from vector search:", queryResults);
  // @ts-ignore

  //clean the results to make it more readable for the model.
  // @ts-ignore
  const cleanResults = uniqueResults.map((job, index) => ({
    "Công việc số:": index + 1,
    id: job.id,
    "Vị trí": job.title,
    "Công ty": job.companyName,
    "Mức lương": `${job.salaryMin} - ${job.salaryMax} USD`,
    "Nơi làm việc": `${job.location} (${job.jobType})`,
    "Trụ sở công ty": `${job.companyAddress ?? ""}, ${job.companyCity ?? ""}`,
    "Mô tả": job.description,
    "Độ phù hợp": Math.round(job.similarity * 100) + "%",
  }));
  const prompt = `Danh sách công việc (Dưới dạng JSON):\n${JSON.stringify(cleanResults, null, 2)}\n\nCâu hỏi của người dùng:\n${question}\n\n`;
  const response = await geminiGeneration(prompt, 0);
  console.log("Response from Gemini for job search:", response);
  return response;
};

/**
 * When searching by using CV, if user has many CV (as least one, too), we need to ask user to choose which CV they want to use.
 *  After that, we will use the selected CV to search for relevant jobs.
 * @param {*} question
 * @param {*} userId
 */
const _handleJobSearchByCV = async (question, userId) => {
  //first, we need to get the user's CV as vector embedding
  const resume = await prisma.resume.findFirst({
    where: { userId: userId, isDefault: true },
    select: {
      id: true,
      vectorStatus: true,
    },
  });

  if (!resume) {
    return messageResponse(
      TYPE.failed,
      "Không có CV mặc định hoặc đã bị xóa. Vui lòng tải lên CV mới.",
    );
  }
  if (
    resume.vectorStatus === "PENDING" ||
    resume.vectorStatus === "PROCESSING"
  ) {
    return messageResponse(
      TYPE.failed,
      "CV đang được xử lý. Vui lòng đợi trong giây lát ",
    );
  }

  if (resume.vectorStatus === "FAILED") {
    return messageResponse(
      TYPE.failed,
      "Quá trình phân tích CV gặp lỗi. Bạn hãy thử upload lại bản CV.",
    );
  }

  const vectors = await prisma.$queryRaw`
    SELECT embedding::text
    FROM "resume_vectors"
    WHERE user_id = ${userId} AND resume_id = ${resume.id}
  `;

  // @ts-ignore
  if (vectors.length === 0) {
    return messageResponse(
      TYPE.failed,
      "CV đang được xử lý. Vui lòng đợi trong giây lát ",
    );
  }
  /**
   * now we will searching with resume_vectors
   */
  // @ts-ignore
  const resumeEmbeddings = vectors.map((v) => v.embedding);
  const results = await prisma.$queryRaw`
  SELECT DISTINCT ON (j.id) 
    j.id, j.title, j.salary_min as "salaryMin", j.salary_max as "salaryMax", 
    j.location, j.description, j.job_type,
    j.job_level, 
    c.name as "companyName", 
    c.address as "companyAddress", 
    c.city as "companyCity",      
    jv.similarity
  FROM jobs j
  CROSS JOIN LATERAL (
    SELECT MAX(1 - (jv.embedding <=> rv.embedding)) AS similarity
    FROM job_vectors jv
    CROSS JOIN LATERAL unnest(${resumeEmbeddings}::vector[]) AS rv(embedding)
    WHERE jv.job_id = j.id
  ) jv
  JOIN "companies" c ON j.company_id = c.id
  WHERE jv.similarity > ${MIN_SIMILARITY_SCORE}  AND j.status='approved' AND j.deadline > NOW()
  ORDER BY j.id, jv.similarity DESC
  LIMIT 5;
`;

  // if (results.length === 0) {
  //   return messageResponse(
  //     TYPE.failed,
  //     "Xin lỗi, tôi không tìm thấy công việc nào phù hợp với CV của bạn."
  //   )
  // }

  console.log("Results from vector search:", results);

  // @ts-ignore
  const cleanResults = results.map((job, index) => ({
    "Công việc số:": index + 1,
    id: job.id,
    "Vị trí": job.title,
    "Loại công việc": job.job_type,
    "Trình độ": job.job_level,
    "Công ty": job.companyName,
    "Mức lương": `${job.salaryMin} - ${job.salaryMax} USD`,
    "Địa điểm": `${job.location ?? ""}`,
    "Địa chỉ": `${job.companyAddress ?? ""}, ${job.companyCity ?? ""}`,
    "Mô tả": job.description,
    "Độ phù hợp": Math.round(job.similarity * 100) + "%",
  }));
  const prompt = `Danh sách công việc (Dưới dạng JSON):\n${JSON.stringify(cleanResults, null, 2)}\n\nCâu hỏi của người dùng:\n${question}\n\n`;
  const response = await geminiGeneration(prompt, 0);
  return response;
};
/**
 * This function is to handle the research about company,
 * when user ask about information of a company,
 * we will find all information about that company in database,
 * then re-format and send to model to generate answer.
 * @param {*} refined_question
 * @param {*} entities
 * @param {*} type
 * @returns {Promise<Record<String,String>>}
 */
const _handleResearch = async (refined_question, type, entities) => {
  if (type === "COMPANY") {
    //find all information of the company

    const whereClause = {};
    if (entities[2] && entities[2].trim() !== "") {
      whereClause.name = { contains: entities[2], mode: "insensitive" };
    }
    if (entities[3] && entities[3].trim() !== "") {
      whereClause.city = { contains: entities[3], mode: "insensitive" };
    }

    const company = await prisma.company.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        website: true,
        address: true,
        city: true,
      },
    });

    if (!company) {
      return messageResponse(
        TYPE.failed,
        "Không tìm thấy thông tin về công ty.",
      );
    }
    //now re-format result
    const cleanCompanyInfo = {
      id: company.id,
      Tên: company.name,
      "Mô tả": company.description,
      Website: company.website,
      "Địa chỉ": company.address,
      "Thành phố": company.city ?? " Không rõ",
    };

    const prompt = `Thông tin công ty (Dưới dạng JSON):\n${JSON.stringify(
      cleanCompanyInfo,
      null,
      2,
    )}\n\nCâu hỏi của người dùng:\n${refined_question}\n\n`;

    return await geminiGeneration(prompt, 4);
  }
  if (type === "JOB") {
    const job = await prisma.job.findFirst({
      where: {
        title: { contains: entities[1] ?? "", mode: "insensitive" },
        company: {
          name: { contains: entities[2] ?? "", mode: "insensitive" },
        },
        location: { contains: entities[3] ?? "", mode: "insensitive" },
      },
      select: {
        id: true,
        title: true,
        description: true,
        benefits: true,
        salaryMin: true,
        salaryMax: true,
        location: true,
        jobType: true,
        jobLevel: true,
        skills: {
          select: {
            skill: {
              select: {
                name: true,
              },
            },
          },
        },
        company: {
          select: {
            name: true,
            address: true,
            city: true,
            website: true,
          },
        },
      },
    });

    if (!job) {
      return messageResponse(
        TYPE.failed,
        "Không tìm thấy thông tin về công việc.",
      );
    }

    const cleanJobInfo = {
      id: job.id,
      "Vị trí": job.title,
      "Công ty": job.company.name,
      "Mức lương": `${job.salaryMin} - ${job.salaryMax} USD`,
      "Địa điểm": job.location,
      "Mô tả": job.description,
      "Loại việc làm": job.jobType,
      "Trình độ": job.jobLevel,
      "Kỹ năng": job.skills.map((s) => s.skill.name).join(", "),
      Website: job.company.website,
      "Địa chỉ": job.company.address,
      "Thành phố": job.company.city ?? " Không rõ",
    };

    const prompt = `Thông tin công việc (Dưới dạng JSON):\n${JSON.stringify(
      cleanJobInfo,
      null,
      2,
    )}\n\nCâu hỏi của người dùng:\n${refined_question}\n\n`;

    return await geminiGeneration(prompt, 4);
  }
};

/**
 * This function is to handle the greeting, when user ask about greeting,
 * @param {*} refined_question
 * @returns
 */
const _handleGreeting = async (refined_question) => {
  const prompt = `Câu hỏi của người dùng:\n${refined_question}`;
  const response = await geminiGeneration(prompt, 2);
  return response;
};

module.exports = {
  _handleComparison,
  _getNewestAnswerFromHistory,
  _handleJobSearch,
  _handleJobSearchByCV,
  _handleResearch,
  _handleGreeting,
};
