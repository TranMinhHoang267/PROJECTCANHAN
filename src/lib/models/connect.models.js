const { Ollama } = require("ollama");

//create new connection to ollama server at localhost:11434
const ollama = new Ollama({
  host: "http://localhost:11434",
});

/**
 *
 * @param {String} prompt
 * @returns String
 */
async function textGeneration(prompt) {
  try {
    const response = await ollama.chat({
      model: "qwen2.5:3b",
      messages: [
        {
          role: "system",
          content:
            "Bạn là trợ lý của hệ thống tuyển dụng JobConnect. Chỉ dùng thông tin dưới đây để trả lời câu hỏi liên quan đến việc làm. Nếu câu hổi không liên quan, hãy từ chối lịch sự Câu trả lời bắt buộc phải dùng tiếng Việt.",
        },
        { role: "user", content: prompt },
      ],
      options: {
        temperature: 0.7,
        num_ctx: 8192,
      },
    });
    return response.message.content;
  } catch (error) {
    console.error("Lỗi khi gọi Ollama API:", error);
    return "Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.";
  }
}

module.exports = {
  textGeneration,
};
