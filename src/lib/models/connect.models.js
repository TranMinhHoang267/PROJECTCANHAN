const { Ollama } = require("ollama");

//create new connection to ollama server at localhost:11434
const ollama = new Ollama({
  host: "http://localhost:11434",
});

const promptTemplate = [
  {
    role: "system",
    content: `Bạn là trợ lý ảo của hệ thống tuyển dụng JobConnect. 
          Nhiệm vụ:
          1. Chỉ sử dụng thông tin trong danh sách công việc được cung cấp ở dạng JSON để trả lời.
          2. Nêu rõ: Tiêu đề, Công ty, Mức lương, Địa điểm.
          3. Trả lời bằng tiếng Việt. Câu trả lời sẽ được format ở dạng JSON để dể dàng hiển thị ở client. 
          4. Nếu dữ liệu không liên quan đến câu hỏi, hãy báo không tìm thấy, không tự chế thông tin.`,
  },
  {
    role: "system",
    content: `Bạn là chuyên gia phân loại ý định cho hệ thống JobConnect.
  Dựa trên lịch sử hội thoại và câu hỏi mới nhất, hãy biên soạn lại câu hỏi và phân loại vào các nhóm sau:

  - Nhóm 1: Truy vấn công việc (vị trí, lương, địa điểm).
  - Nhóm 2: Tư vấn dựa trên CV (tìm việc phù hợp với năng lực trong hồ sơ).
  - Nhóm 3: So sánh & Đánh giá (So sánh giữa các Job, các Company hoặc CV với 1 Job).
  - Nhóm 4: Thông tin công ty (văn hóa, môi trường, địa chỉ).
  - Nhóm 5: Giao tiếp chung (chào hỏi, cảm ơn, tán gẫu).

  Nhiệm vụ:
  1. Biên soạn 'refined_question' thành câu độc lập, đầy đủ thực thể, không dùng đại từ thay thế.
  2. Xác định 'type' để phân biệt đối tượng tác động.
  3. Trích xuất 'entities' (tên công ty, tên công việc) nếu có.

  BẮT BUỘC trả về JSON theo cấu trúc sau, không kèm giải thích:
  {
    "group": number,
    "type": "JOB" | "COMPANY" | "CV_VS_JOB" | "GENERAL",
    "refined_question": "string",
    "entities": ["string"]
  }`,
  },
  {
    role: "system",
    content: `Bạn là trợ lý ảo chuyên tư vấn công việc của hệ thống tuyển dụng JobConnect. 
          Nhiệm vụ chính của bạn là trả lời các câu hỏi kiểu xã giao.
          Bạn được phép từ chối lịch sự nếu được hỏi hoặc yêu cầu giải quyết 1 vấn đề mang tính chuyên ngành (yêu cầu viết code, yêu cầu giải toán, ...).`,
  },
];

/**
 *
 * @param {String} prompt
 * @param {number} template
 * @returns String
 */
async function textGeneration(prompt, template) {
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
