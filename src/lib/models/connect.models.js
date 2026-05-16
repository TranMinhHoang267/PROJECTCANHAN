const { Ollama } = require("ollama");
const promptTemplate = require("./_prompt.models");
const { messageResponse, TYPE } = require("../../utils/format/response.format");

//create new connection to ollama server at localhost:11434
const ollama = new Ollama({
  host: "http://localhost:11434",
});

/**
 *
 * @param {String} prompt
 * @param {number} template
 * @returns {Promise<Record<String,String>>}
 */
async function textGeneration(prompt, template) {
  console.log("Received prompt:", prompt);
  console.log("Received template:", template);
  try {
    const response = await ollama.chat({
      model: "qwen2.5:3b",
      messages: [
        promptTemplate[template || 0],
        { role: "user", content: prompt },
      ],
      options: {
        temperature: 0.7,
        num_ctx: 8192,
        top_p: 0.9,
        presence_penalty: 0.2,
      },
    });
    return messageResponse(TYPE.success, response.message.content);
  } catch (error) {
    console.error("Lỗi khi gọi Ollama API:", error);
    return messageResponse(
      TYPE.failed,
      "Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.",
    );
  }
}

module.exports = {
  textGeneration,
};