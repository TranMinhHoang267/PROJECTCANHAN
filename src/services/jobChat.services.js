const prisma = require("../config/prisma");
const { textGeneration } = require("../lib/models/connect.models");
const { cleaningText } = require("../utils/preprocessing/textCleaner");
const { textEmbedding } = require("../utils/preprocessing/textEmbedding");
const {
  textStandardization,
} = require("../utils/preprocessing/textStandardization");

/**
 * This service will:
 * - Clean and standardize question from client (user).
 * - Semantic searching to find the most relevant job descriptions and other relevant information from the database.
 * - Packing and send all to model to generate answer.
 * - Return the answer to client.
 *
 * The main goal of this service is to handle all the logic related to job chat, including processing user queries, retrieving relevant job information, and generating responses based on that information. This service will act as a bridge between the user's input and the underlying data and models that power the job chat functionality.
 */

/**
 *
 * @param {String} question
 */
exports.chat = async (question) => {
  /**
   * first, we will clean and standardize the question from client (user).
   */

  const vectorizationQuestion = await textEmbedding(
    textStandardization(cleaningText(question)),
  );

  /**
   * Now we will search in the database by raw SQL.
   * and join with full information.
   */
  const MIN_SIMILARITY_SCORE = 0.4; // You can adjust this threshold based on your needs
  const results = await prisma.$queryRaw`
        SELECT j.*,1 - (v.embedding <=> ${vectorizationQuestion}::vector) AS similarity
        FROM "jobs"j
        JOIN "job_vectors" v ON j.id = v.job_id
        WHERE 1 - (v.embedding <=> ${vectorizationQuestion}::vector) > ${MIN_SIMILARITY_SCORE}
        ORDER BY v.embedding <=> ${vectorizationQuestion}::vector ASC
        LIMIT 3;
    `;
  if (results.length === 0) {
    return "Xin lỗi, tôi không tìm thấy thông tin nào liên quan đến câu hỏi của bạn. Vui lòng thử lại với câu hỏi khác hoặc cung cấp thêm chi tiết.";
  }

  const prompt = `Ngữ cảnh:\n${results}\n\nCâu hỏi:\n${question}\n\n`;
  const response = await textGeneration(prompt);
  return response;
};

exports.history = async (userId) => {
  const history = await prisma.userChat.findMany({
    where: { userId: userId },
    orderBy: { createdAt: "desc" },
  });
  return history;
};
