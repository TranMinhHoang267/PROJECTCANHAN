/**
 * using @xenova/transformers to generate text embeddings for job descriptions and other relevant information. 
 * This will allow us to create a vector representation of the job data, which can be used for various downstream tasks such as similarity search, clustering, or as input features for machine learning models.
 * The textEmbedding function takes a text input, processes it through the feature extraction pipeline using a pre-trained model (in this case, 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'), and returns the resulting embedding as an array of numbers.
 * This embedding can then be stored in a database or used directly for tasks like job matching or recommendation systems.
 */
require('dotenv').config();
const process = require('process');
const { InferenceClient } = require("@huggingface/inference");

// Khởi tạo client với Token từ Hugging Face (nên để trong .env)
const client = new InferenceClient(process.env.HF_TOKEN);

/**
 * 
 * @param {String} text 
 * @returns 
 */

const textEmbedding = async (text) => {
  if (!text) return null;

  const maxRetries = 3;
  const baseDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const output = await client.featureExtraction({
        model: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        inputs: text,
      });
      return output;
    } catch (error) {
      // @ts-ignore
      console.error(`Lỗi gọi Hugging Face API (lần ${attempt}/${maxRetries}):`, error.message);
      if (attempt < maxRetries) {
        const backoff = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }

  console.error("Đã thử lại 3 lần, không thể lấy embedding.");
  return null;
};

module.exports = {
  textEmbedding,
};