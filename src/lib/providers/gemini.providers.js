require("dotenv").config();
const djson = require("dirty-json");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const promptTemplate = require("./_prompt.models");
const { messageResponse, TYPE } = require("../../utils/format/response.format");

const key = process.env.GG_API_KEY;
if (!key) {
  console.error("GEMINI_API_KEY is not set in environment variables.");
  process.exit(1);
}
console.log("GEMINI_API_KEY is set, proceeding with initialization.", {
  key,
});

// Khởi tạo SDK với Key của Hào

async function geminiGeneration(prompt, templateIndex) {
  try {
    const genAI = new GoogleGenerativeAI(key);

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: { responseMimeType: "application/json" },
    });
    // Kết hợp template và prompt của Hào
    const systemInstruction = promptTemplate[templateIndex || 0].content;
    const finalPrompt = `${systemInstruction}\n\nUser request: ${prompt}`;

    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const text = response.text();

    console.log(
      "Raw response from Geminiconst djson = require('dirty-json'); API:",
      text,
    );
    try {
      // Thử parse bằng JSON chuẩn trước
      const formatResult = JSON.parse(text);
      return messageResponse(TYPE.success, templateIndex, formatResult);
    } catch (standardError) {
      console.warn(
        "JSON chuẩn thất bại, đang cố gắng cứu vãn bằng dirty-json...",
        standardError,
      );

      // dirty-json sẽ tự động thêm dấu ngoặc kép vào key và sửa trailing comma
      const fixedResult = djson.parse(text);
      return messageResponse(TYPE.success, "", fixedResult);
    }
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error);
    return messageResponse(
      TYPE.failed,
      "Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.",
    );
  }
}

module.exports = {
  geminiGeneration,
};
