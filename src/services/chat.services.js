const prisma = require("../config/prisma");
const { geminiGeneration } = require("../lib/providers/gemini.providers");
const { cleaningText } = require("../utils/preprocessing/textCleaner");
const { textEmbedding } = require("../utils/preprocessing/textEmbedding");
const {
  textStandardization,
} = require("../utils/preprocessing/textStandardization");
const process = require("node:process");
const { TYPE, messageResponse } = require("../utils/format/response.format");
const {
  _getNewestAnswerFromHistory,
  _handleComparison,
  _handleJobSearch,
  _handleJobSearchByCV,
  _handleResearch,
  _handleGreeting,
} = require("./_helpers/chat.helpers");
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
          return messageResponse(TYPE.success, 6, {
            refined_question: refined_question,
          });
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
