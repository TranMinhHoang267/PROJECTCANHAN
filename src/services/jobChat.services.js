const prisma = require("../config/prisma");
const { textGeneration } = require("../lib/models/connect.models");
const { cleaningText } = require("../utils/preprocessing/textCleaner");
const { textEmbedding } = require("../utils/preprocessing/textEmbedding");
const {
  textStandardization,
} = require("../utils/preprocessing/textStandardization");
const process = require("node:process");
/**
 * This service will:
 * - Clean and standardize question from client (user).
 * - Semantic searching to find the most relevant job descriptions and other relevant information from the database.
 * - Packing and send all to model to generate answer.
 * - Return the answer to client.
 * The main goal of this service is to handle all the logic related to job chat, including processing user queries, retrieving relevant job information, and generating responses based on that information. This service will act as a bridge between the user's input and the underlying data and models that power the job chat functionality.
 */

/**
 * we have 6 categories:
 * 1. Group 1: Job-related questions (e.g., "I want a job in ReactJS," "Are there jobs available in Hanoi?", "What is the salary for this job?").
 * 2. Group 2: Questions about jobs that match the user's CV (e.g., "Which jobs match my CV?", "Which jobs should I apply for?", "Which jobs match my experience?").
 * 3. Group 3: Questions related to the work environment (e.g., "I need information about this company," "What is the work environment like at this company?", "Is this company good?").
 * 4. Group 4: Other questions (those not belonging to the three groups above).
 * We will use the model to determine which category the question belongs to, and then we will handle it accordingly.
 */

/**
 *
 * @param {String} question
 * @param {String} userId
 * @param { * } resumeId
 * @returns {Promise<String>}
 */
exports.chat = async (question, userId, resumeId) => {
  /**first, we need to  determine whether question is belongs to a specific category
   */

  const historyChat = await _getNewestAnswerFromHistory(userId);
  const prompt = `
  Lịch sử: ${historyChat ? JSON.stringify(historyChat) : "Không có"}.
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
  const category = await textGeneration(prompt, 1);
  console.log("Category:", category);

  try {
    // @ts-ignore
    const { group, type, refined_question, entities } = JSON.parse(category);
    switch (group) {
      case 1:
        return await _handleJobSearch(refined_question);
      case 2:
        return await _handleJobSearchByCV(refined_question, userId, resumeId);
      case 3:
        return await _handleComparison(
          refined_question,
          entities,
          type,
          userId,
        );
      case 4:
        return await _handleResearchCompany(refined_question, entities);
      case 5:
        return await _handleGeeting(refined_question);
      default:
        return "Tính năng này đang được phát triển. Vui lòng thử lại sau.";
    }
  } catch (error) {
    console.error("Error parsing category response:", error);
    return "Xin lỗi, tôi không thể hiểu câu hỏi của bạn. Vui lòng thử lại với câu hỏi khác hoặc cung cấp thêm chi tiết.";
  }
};

/**
 *
 * @param {String} userId
 * @returns
 */
exports.history = async (userId) => {
  const history = await prisma.userChat.findMany({
    where: { userId: userId },
    orderBy: { createdAt: "desc" },
  });
  return history;
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
    const response = await textGeneration(prompt, 0);
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
    const response = await textGeneration(prompt, 0);
    return response;
  }
  if (type === "CV_VS_JOB") {
    const resume = await prisma.resume.findFirst({
      where: { userId: userId },
      select: { id: true, vectorStatus: true },
    });

    if (!resume || resume.vectorStatus !== "COMPLETED") {
      return "CV của bạn đang được xử lý hoặc chưa được tải lên. Vui lòng đợi trong giây lát.";
    }

    // 2. Tìm Job mục tiêu
    const job = await prisma.job.findFirst({
      where: {
        // @ts-ignore
        OR: entities.map((name) => ({
          title: { contains: name, mode: "insensitive" }, // Dùng contains thay vì in: (Sửa lỗi H2)
        })),
      },
      include: { company: true, skills: { include: { skill: true } } },
    });

    if (!job) return "Không tìm thấy thông tin công việc cụ thể để đánh giá.";

    // 3. SO SÁNH VECTOR: Lấy các đoạn CV liên quan nhất đến Job này (Sửa lỗi H3)
    // Giả sử bạn đã có vector của Job (đã lưu lúc tạo Job hoặc tạo mới tại đây)
    const jobVectors = await prisma.$queryRaw`
    SELECT embedding::text FROM "job_vectors" 
    WHERE job_id = ${job.id}
  `;

    // @ts-ignore
    if (!jobVectors || jobVectors.length === 0) {
      return "Không tìm thấy dữ liệu vector cho công việc này.";
    }
    // @ts-ignore
    const jobParsedEmbeddings = jobVectors.map((jv) =>
      JSON.parse(jv.embedding.replace("[", "[").replace("]", "]")),
    );

    // @ts-ignore
    const jobEmbedding = jobParsedEmbeddings[0].map(
      // @ts-ignore
      (_, i) =>
        // @ts-ignore
        jobParsedEmbeddings.reduce((sum, v) => sum + v[i], 0) /
        jobParsedEmbeddings.length,
    );

    // Gọi hàm lấy chunk CV liên quan
    const relevantCvText = await _getRelevantResumeChunks(
      resume.id,
      jobEmbedding,
    );

    const cleanResults = {
      "Vị trí": job.title,
      "Công ty": job.company.name,
      "Yêu cầu & Mô tả": job.description,
      "Kỹ năng yêu cầu": job.skills.map((s) => s.skill.name).join(", "),
    };

    // 4. Tạo Prompt an toàn về Token
    const prompt = `
    YÊU CẦU CÔNG VIỆC:\n\n
    ${JSON.stringify(cleanResults, null, 2)}\n\n
    CÁC PHẦN LIÊN QUAN TRONG CV NGƯỜI DÙNG:\n\n
    ${relevantCvText}\n\n
    CÂU HỎI: ${refined_question}\n\n
    Hãy trả lời ngắn gọn, tập trung vào sự khớp nhau về kỹ năng và kinh nghiệm.`;

    const response = await textGeneration(prompt, 3);
    return response;
  }
  return "Có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại sau.";
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
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return history;
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

  if (!vectorizationQuestion) {
    return "Xin lỗi, tôi không thể xử lý câu hỏi của bạn. Vui lòng thử lại sau.";
  }
  /**
   * Now we will search in the database by raw SQL.
   * and join with full information.
   */
  const MIN_SIMILARITY_SCORE = parseFloat(
    process.env.MIN_SIMILARITY_SCORE || "0.3",
  ); // You can adjust this threshold based on your needs
  const embeddingString = `[${vectorizationQuestion.join(",")}]`;
  const results = await prisma.$queryRaw`
    SELECT 
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
    WHERE 1 - (v.embedding <=> ${embeddingString}::vector) > ${MIN_SIMILARITY_SCORE}
    ORDER BY v.embedding <=> ${embeddingString}::vector ASC
    LIMIT 3;
`;

  console.log("Results from vector search:", results);
  // @ts-ignore
  if (results.length === 0) {
    return "Xin lỗi, tôi không tìm thấy thông tin nào liên quan đến câu hỏi của bạn. Vui lòng thử lại với câu hỏi khác hoặc cung cấp thêm chi tiết.";
  }

  //clean the results to make it more readable for the model.
  // @ts-ignore
  const cleanResults = results.map((job, index) => ({
    "Công việc số:": index + 1,
    id: job.id,
    "Vị trí": job.title,
    "Công ty": job.companyName,
    "Mức lương": `${job.salaryMin} - ${job.salaryMax} USD`,
    "Địa điểm": `${job.companyAddress ?? ""}, ${job.companyCity}`,
    "Mô tả": job.description,
    "Độ phù hợp": Math.round(job.similarity * 100) + "%",
  }));
  const prompt = `Danh sách công việc (Dưới dạng JSON):\n${JSON.stringify(cleanResults, null, 2)}\n\nCâu hỏi của người dùng:\n${question}\n\n`;
  const response = await textGeneration(prompt, 0);
  return response;
};

/**
 * When searching by using CV, if user has many CV (as least one, too), we need to ask user to choose which CV they want to use.
 *  After that, we will use the selected CV to search for relevant jobs.
 * @param {*} question
 * @param {*} userId
 * @param {*} resumeId
 */
const _handleJobSearchByCV = async (question, userId, resumeId) => {
  if (!resumeId) {
    return "Vui lòng chọn một CV để tiếp tục.";
  }
  //first, we need to get the user's CV as vector embedding
  const resume = await prisma.resume.findFirst({
    where: { userId: userId },
    select: {
      vectorStatus: true,
    },
  });

  if (!resume) {
    return "CV không tồn tại hoặc đã bị xóa";
  }
  if (
    resume.vectorStatus === "PENDING" ||
    resume.vectorStatus === "PROCESSING"
  ) {
    return "CV đang được xử lý. Vui lòng đợi trong giây lát ";
  }

  if (resume.vectorStatus === "FAILED") {
    return "Quá trình phân tích CV gặp lỗi. Bạn hãy thử upload lại bản CV khác xem sao.";
  }

  const vectors = await prisma.$queryRaw`
    SELECT embedding::text
    FROM "resume_vectors"
    WHERE user_id = ${userId} AND resume_id = ${resumeId}
  `;

  // @ts-ignore
  if (vectors.length === 0) {
    return "Xin lỗi, tôi không thể tìm thấy thông tin CV của bạn. Vui lòng thử lại sau.";
  }
  /**
   * now we will searching with resume_vectors
   */
  const MIN_SIMILARITY_SCORE = parseFloat(
    process.env.MIN_SIMILARITY_SCORE || "0.3",
  ); // You can adjust this threshold based on your needs
  // @ts-ignore
  const resumeEmbeddings = vectors.map((v) => `[${v.embedding.join(",")}]`);
  const results = await prisma.$queryRaw`
  SELECT DISTINCT ON (j.id) 
    j.id, j.title, j.salary_min as "salaryMin", j.salary_max as "salaryMax", 
    j.location, j.description, j.job_type,
    j.location, j.job_level, 
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
  ) jv ON true
  JOIN "companies" c ON j.company_id = c.id
  WHERE jv.similarity > ${MIN_SIMILARITY_SCORE}
  ORDER BY j.id, jv.similarity DESC
  LIMIT 5;
`;
  // @ts-ignore
  const cleanResults = results.map((job, index) => ({
    "Công việc số:": index + 1,
    id: job.id,
    "Vị trí": job.title,
    "Loại công việc": job.job_type,
    "Trình độ": job.job_level,
    "Công ty": job.companyName,
    "Mức lương": `${job.salaryMin} - ${job.salaryMax} USD`,
    "Địa điểm": `${job.locaion ?? ""}`,
    "Địa chỉ": `${job.companyAddress ?? ""}, ${job.companyCity}`,
    "Mô tả": job.description,
    "Độ phù hợp": Math.round(job.similarity * 100) + "%",
  }));
  const prompt = `Danh sách công việc (Dưới dạng JSON):\n${JSON.stringify(cleanResults, null, 2)}\n\nCâu hỏi của người dùng:\n${question}\n\n`;
  const response = await textGeneration(prompt, 0);
  return response;
};
/**
 *
 * @param {*} refined_question
 * @param {*} entities
 * @returns
 */
const _handleResearchCompany = async (refined_question, entities) => {
  //find all information of the company
  const company = await prisma.company.findFirst({
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
      jobs: {
        select: {
          id: true,
          title: true,
          description: true,
        },
      },
    },
  });

  if (!company) {
    return "Không tìm thấy thông tin về công ty.";
  }
  //now re-format result
  const cleanCompanyInfo = {
    id: company.id,
    Tên: company.name,
    "Mô tả": company.description,
    Website: company.website,
    "Địa chỉ": company.address,
    "Thành phố": company.city,
  };
  const cleanJobs = company.jobs.map((job, index) => ({
    "Công việc số:": index + 1,
    id: job.id,
    "Vị trí": job.title,
    "Mô tả": job.description,
  }));
  const prompt = `Thông tin công ty (Dưới dạng JSON):\n${JSON.stringify(
    cleanCompanyInfo,
    null,
    2,
  )}\n\nDanh sách tuyển dụng và đãi ngộ (Dưới dạng JSON):\n${JSON.stringify(
    cleanJobs,
    null,
    2,
  )}\n\nCâu hỏi của người dùng:\n${refined_question}\n`;

  const response = await textGeneration(prompt, 0);
  return response;
};

/**
 *
 * @param {*} refined_question
 * @returns
 */
const _handleGeeting = async (refined_question) => {
  const prompt = `Câu hỏi của người dùng:\n${refined_question}`;
  const response = await textGeneration(prompt, 2);
  return response;
};

/**
 *
 * @param {*} resumeId
 * @param {*} jobEmbedding
 * @param {*} topK
 * @returns
 */
async function _getRelevantResumeChunks(resumeId, jobEmbedding, topK = 3) {
  const resumeVectors = await prisma.$queryRaw`
    SELECT content, embedding::text FROM "resume_vectors" 
    WHERE resume_id = ${resumeId}
  `;

  // @ts-ignore
  if (resumeVectors.length === 0) return "";

  // @ts-ignore
  const scoredChunks = resumeVectors.map((chunk) => {
    const vecA =
      typeof chunk.embedding === "string"
        ? JSON.parse(chunk.embedding)
        : chunk.embedding;

    return {
      content: chunk.content,
      score: cosineSimilarity(vecA, jobEmbedding),
    };
  });

  return scoredChunks
    .filter((c) => !isNaN(c.score) && c.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((c) => c.content)
    .join("\n---\n");
}

/**
 * Tính toán độ tương đồng Cosine giữa hai vector
 * @param {number[]} vecA
 * @param {number[]} vecB
 */
function cosineSimilarity(vecA, vecB) {
  // Kiểm tra đầu vào có phải là mảng hợp lệ không
  if (
    !Array.isArray(vecA) ||
    !Array.isArray(vecB) ||
    vecA.length !== vecB.length
  ) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    // Ép kiểu số để chắc chắn không bị lỗi coerce từ ký tự
    const valA = Number(vecA[i]);
    const valB = Number(vecB[i]);

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
