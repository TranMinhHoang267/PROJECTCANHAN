const prisma = require("../config/prisma");
const crypto = require("crypto");
/**
 * Service contains logic for:
 * - Chunking (data after cleaning).
 * - Vectorization (using SBERT).
 * - Storing and retrieving vectors from the database.
 */

const { cleaningText } = require("../utils/preprocessing/textCleaner");
const { textChunking } = require("../utils/preprocessing/textChunking");
const { textEmbedding } = require("../utils/preprocessing/textEmbedding");
const {
  textStandardization,
} = require("../utils/preprocessing/textStandardization");
const { pdfReader } = require("../utils/reader/docs.reader");
const {
  geminiGeneration,
  TEMPLATE_TYPE,
} = require("../lib/providers/gemini.providers");

/**
 *
 * @param {*} resumeId
 * @param {*} userId
 * @param {*} processedChunks
 */
async function _storeNewResumeVector(resumeId, userId, processedChunks) {
  if (
    !resumeId ||
    !userId ||
    !processedChunks ||
    !Array.isArray(processedChunks)
  ) {
    throw new Error("Invalid input for storeJobVector");
  }

  /**
   * Storing each chunk and its embedding in the database. We use a transaction to ensure that all chunks for a job are stored together, maintaining data integrity.
   * Each chunk is associated with the job ID, and we also store the index to keep track of the original order of the chunks. This will be important for reconstructing the text or for any operations that require understanding the sequence of the chunks.
   * The embedding is stored as a JSON string since it is an array of numbers, which allows us to easily retrieve and use it later for similarity searches or other vector-based operations.
   */

  try {
    await prisma.$transaction(async (tx) => {
      for (const chunk of processedChunks) {
        const vectorStr = `[${chunk.embedding.join(",")}]`;
        const id = crypto.randomUUID(); // Generate a unique ID for each chunk
        await tx.$executeRaw`
          INSERT INTO "resume_vectors" ("id", "user_id","resume_id", content, embedding,created_at,updated_at)
          VALUES ( ${id},${userId},${resumeId}, ${chunk.content}, ${vectorStr}::vector, NOW(), NOW())
        `;
      }
      await tx.resume.update({
        where: { id: resumeId },
        data: { vectorStatus: "COMPLETED" },
      });
    });
  } catch (error) {
    console.error(`Lỗi vector hóa Resume ${resumeId}:`, error);
    await prisma.resume.update({
      where: { id: resumeId },
      data: { vectorStatus: "FAILED" },
    });
    throw error;
  }
}

/**
 *
 * @param {*} resume
 * @param {String} userId
 */
async function processAndStoreResumeVector(resume) {
  // Step 1: Clean the job data to remove noise and irrelevant information

  const rawText = await pdfReader(resume.fileUrl);

  const cleanedText = cleaningText(rawText);
  if (!cleanedText) {
    console.warn(
      `Job has insufficient content after cleaning. Skipping vectorization.`,
    );
    return null;
  }
  // Step 2: Standardize the cleaned text to ensure consistent representation, especially for Vietnamese text
  const standardizedText = textStandardization(cleanedText);
  // Step 3: Chunk the standardized text into smaller pieces suitable for embedding generation
  let chunks = textChunking(standardizedText);
  if (chunks.length === 0) {
    console.warn(
      `Resume ${resume.id} has no valid chunks after chunking. Skipping vectorization.`,
    );
  }
  // Step 4: Generate embeddings for each chunk using the embedding model
  let chunkEmbeddings = [];
  for (const chunk of chunks) {
    const embedding = await textEmbedding(chunk);
    if (!embedding) {
      throw new Error(
        `Failed to generate embedding for a chunk in Resume ${resume.id}`,
      );
    }
    chunkEmbeddings.push(embedding);
  }
  // Step 5: Create processed chunks with embeddings
  const processedChunks = chunks.map((chunk, index) => {
    // Handle the case where the embedding might be returned as a Tensor (e.g., from Transformers.js) instead of a plain array. We convert it to an array if necessary to ensure consistent storage in the database.
    const embeddingArray = Array.isArray(chunkEmbeddings[index])
      ? chunkEmbeddings[index]
      : // @ts-ignore
        Array.from(chunkEmbeddings[index].data); // if is is a Tensor from Transformers.js, convert it to array

    return {
      content: chunk,
      embedding: embeddingArray,
      index,
    };
  });

  const prompt = `Đây là thông tin về một CV ứng tuyển:\n\n${rawText}`;
  const result = await geminiGeneration(prompt, 0, TEMPLATE_TYPE.internal);

  if (result.title === "FAILED") {
    console.warn(
      `Gemini failed to process Resume ${resume.id} for summary generation. Error: ${result.message}`,
    );
    return null;
  }
  await prisma.resume.update({
    where: { id: resume.id },
    data: { summary: result },
  });

  // Step 6: Store the processed chunks and their embeddings in the database
  await _storeNewResumeVector(resume.id, resume.userId, processedChunks);
}

module.exports = {
  processAndStoreResumeVector,
};