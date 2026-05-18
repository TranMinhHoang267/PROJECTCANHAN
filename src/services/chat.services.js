const prisma = require("../config/prisma");
const { geminiGeneration } = require("../lib/providers/gemini.providers");
const { cleaningText } = require("../utils/preprocessing/textCleaner");
const { textEmbedding } = require("../utils/preprocessing/textEmbedding");
const {
  textStandardization,
} = require("../utils/preprocessing/textStandardization");
const process = require("node:process");
const { TYPE, messageResponse } = require("../utils/format/response.format");
const MIN_SIMILARITY_SCORE = parseFloat(
  process.env.MIN_SIMILARITY_SCORE || "0.3",
); // You can adjust this threshold based on your needs
/**
 * This service will:
 * - Clean and standardize question from client (user).
 * - Semantic searching to find the most relevant job descriptions and other relevant information from the database.
 * - Packing and send all to model to generate answer.
 * - Return the answer to client.
 * The main goal of this service is to handle all the logic related to job chat, including processing user queries, retrieving relevant job information, and generating responses based on that information. This service will act as a bridge between the user's input and the underlying data and models that power the job chat functionality.
 */

/**
 * This function is the main function to handle the job chat, it will receive the question from client, then process it and return the answer.
 * @param {String} question
 * @param {String} userId
 * @returns {Promise<Record<String,String>>}
 */
exports.chat = async (question, userId) => {
  //first, we need to  determine whether question is belongs to a specific category

  const historyChat = await _getNewestAnswerFromHistory(userId);
  const prompt = `
  Lịch sử chat trước đó: ${historyChat ? JSON.stringify(historyChat) : "Không có"}.
  Câu hỏi: ${question}`;

  /**
   * the cateogry below will return a json structure like this
   * {
    "group": number,
    "type": "JOB" | "COMPANY" | "CV_VS_JOB" | "GENERAL",
    "refined_question": "string",
    "entities": ["string"]
  }
   */
  const result = await geminiGeneration(prompt, 1);
  console.log("Category:", result);

  if (result.type === "SUCCESS") {
    try {
      // @ts-ignore
      const { group, type, refined_question, entities } = result.data;
      switch (group) {
        case 1:
          return await _handleJobSearch(refined_question);
        case 2:
          return await _handleJobSearchByCV(refined_question, userId);
        case 3:
          return await _handleComparison(
            refined_question,
            entities,
            type,
            userId,
          );
        case 4:
          return await _handleResearch(refined_question, type, entities);
        case 5:
          return await _handleGreeting(refined_question);
        case 6:
          return messageResponse(TYPE.success, refined_question);
        default:
          return messageResponse(
            TYPE.failed,
            "Tính năng này đang được phát triển. Vui lòng thử lại sau.",
          );
      }
    } catch (error) {
      console.error("Error parsing category response:", error);
      return messageResponse(TYPE.failed, "Đã có lỗi xảy ra");
    }
  } else return result;
};

/**
 * This function is to get the chat history of the user, which includes all the questions asked and answers received in the past.
 * @param {String} userId
 * @returns {Promise<Record<String,String>>}
 */
exports.history = async (userId) => {
  const history = await prisma.userChat.findMany({
    where: { userId: userId },
    select: {
      id: true,
      question: true,
      answer: true,
      template: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let isFrozen = false;
  if (history.length > 0) {
    const lastChatTime = new Date(history[0].createdAt).getTime();
    const currentTime = new Date().getTime();
    const diffHours = (currentTime - lastChatTime) / (1000 * 60 * 60);

    if (diffHours > 24) {
      isFrozen = true;
    }
  }
  return messageResponse(TYPE.success, "Lịch sử chat của bạn", {
    history,
    isFrozen,
  });
};

/**
 * This function is to get job suggestions based on the user's filters.
 * @param {String} userId
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
exports.getJobSuggestions = async (userId, filters) => {
  const { keyword, location, jobType, jobLevel, salary } = filters;
  // We will build the prompt for the model to generate suggestions based on the filters and keyword.
  const prompt = {
    keyword,
    location,
    jobType,
    jobLevel,
    salary,
  };
  const refined_question = await geminiGeneration(JSON.stringify(prompt), 5);
  if (refined_question.type === "SUCCESS") {
    // Now we will search for jobs based on the refined question.
    const cleaned_question = cleaningText(refined_question.message);
    const embedding = await textEmbedding(
      textStandardization(cleaned_question),
    );
    if (!embedding) {
      return messageResponse(
        TYPE.failed,
        "Xin lỗi, tôi không thể xử lý yêu cầu của bạn ngay bây giờ. Vui lòng thử lại sau.",
      );
    }
    const embeddingString = `${JSON.stringify(embedding)}`;
    const queryResults = await prisma.$queryRaw`
      SELECT DISTINCT ON (j.id) 
          j.id,
          1 - (v.embedding <=> ${embeddingString}::vector) AS similarity
      FROM "jobs" j
      JOIN "job_vectors" v ON j.id = v.job_id
      WHERE 1 - (v.embedding <=> ${embeddingString}::vector) > ${MIN_SIMILARITY_SCORE}
      ORDER BY j.id, (1 - (v.embedding <=> ${embeddingString}::vector)) DESC
      LIMIT 10;
    `;

    if (queryResults.length === 0) {
      return messageResponse(
        TYPE.failed,
        "Xin lỗi, tôi không tìm thấy công việc nào phù hợp với yêu cầu của bạn. Vui lòng thử lại với các tiêu chí khác hoặc giảm bớt một số tiêu chí để có nhiều kết quả hơn.",
      );
    }
    const jobs = await prisma.job.findMany({
      where: {
        id: {
          in: queryResults.map((result) => result.id),
        },
      },
      select: {
        id: true,
        title: true,
        location: true,
        jobType: true,
        jobLevel: true,
        benefits: true,
        description: true,
        requirements: true,
        skills: {
          select: {
            id: true,
            skill: true,
          },
        },
        salaryMin: true,
        salaryMax: true,
        deadline: true,
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            city: true,
            address: true,
          },
        },
      },
    });
    return messageResponse(
      TYPE.success,
      "Đây là những công việc phù hợp với yêu cầu của bạn:",
      { jobs },
    );
  } else {
    return messageResponse(TYPE.failed, refined_question.message);
  }
};

/**
 * This function is process for comparison among entities
 * @param {*} refined_question
 * @param {*} entities
 * @param {*} type
 * @param {*} userId
 */
const _handleComparison = async (refined_question, entities, type, userId) => {
  if (type === "COMPANY") {
    const results = await prisma.company.findMany({
      where: {
        // @ts-ignore
        OR: entities.map((name) => ({
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

    const titleKeywords = entities[1]
      ? entities[1].trim().split(/\s+/).join(".+")
      : "";
    const companyKeywords = entities[2]
      ? entities[2].trim().split(/\s+/).join(".+")
      : "";
    // console.log("Title keywords regex:", titleKeywords);
    // console.log("Company keywords regex:", companyKeywords);
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
      JOIN "job_skills" js ON j.id = js.job_id
      JOIN "skills" s ON js.skill_id = s.id
      WHERE 
          j.title ~* ${titleKeywords}
          AND c.name ~* ${companyKeywords}
          
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
    // @ts-ignore
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
        1 - (v.embedding <=> ${embeddingString}::vector) AS similarity
    FROM "jobs" j
    JOIN "job_vectors" v ON j.id = v.job_id
    JOIN "companies" c ON j.company_id = c.id
    WHERE 1 - (v.embedding <=> ${embeddingString}::vector) > ${MIN_SIMILARITY_SCORE} AND j.status='approved' AND j.deadline > NOW()
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
    "Địa điểm": `${job.companyAddress ?? ""}, ${job.companyCity ?? ""}`,
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
