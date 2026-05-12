const { cleaningText } = require('../../src/utils/preprocessing/textCleaner');
const { textStandardization } = require('../../src/utils/preprocessing/textStandardization');
const { textChunking } = require('../../src/utils/preprocessing/textChunking');

jest.mock('../../src/utils/preprocessing/textEmbedding', () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1)),
  getEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1))
}));

function getActualOverlap(current, next) {
  const cleanedCurrent = current.trim().replace(/[\s\n]+/g, ' ');
  const cleanedNext = next.trim().replace(/[\s\n]+/g, ' ');
  let bestOverlap = '';
  for (let i = 1; i <= 150; i++) {
    const snippet = cleanedNext.substring(0, i);
    if (cleanedCurrent.endsWith(snippet)) {
      bestOverlap = snippet;
    } else if (i > 30) break;
  }
  return bestOverlap;
}

const sampleJob = {
  title: 'Kỹ sư Phần mềm (Software Engineer)',
  description: 'Tuyển dụng Kỹ sư Phần mềm làm việc tại Hà Nội. Công ty chúng tôi là doanh nghiệp hàng đầu lĩnh vực CNTT, phát triển giải pháp phần mềm trong nước và quốc tế. Đang tìm ứng viên năng động, sáng tạo gia nhập đội ngũ kỹ thuật. Vị trí yêu cầu kiến thức vững lập trình, khả năng làm việc nhóm tốt, tư duy giải quyết vấn đề linh hoạt. Công việc chính: thiết kế, phát triển, bảo trì ứng dụng web/mobile; phân tích yêu cầu, thiết kế hệ thống, viết tài liệu kỹ thuật; hợp tác với bộ phận sản phẩm, thiết kế đảm bảo sản phẩm đáp ứng nhu cầu người dùng; tối ưu hiệu suất ứng dụng, đảm bảo bảo mật, ổn định hệ thống; tham gia dự án R&D công nghệ mới. Yêu cầu: tốt nghiệp đại học CNTT, Khoa học máy tính; có ít nhất 2 năm kinh nghiệm (kn) làm việc với JavaScript, Python, Java; thành thạo React, Node.js, Spring Boot; có kiến thức SQL/NoSQL; sử dụng được Jira, Trello; tư duy logic tốt, tự học nhanh; giao tiếp tiếng Anh đọc hiểu tài liệu kỹ thuật. Quyền lợi: lương 20-40 triệu/tháng; thưởng quý, thưởng cuối năm; đóng đầy đủ bảo hiểm (bhxh, bhyt, bhtn); tham gia khóa đào tạo (đt) nâng cao kỹ năng; môi trường trẻ trung, thăng tiến rõ ràng; cấp thiết bị làm việc hiện đại; team building, du lịch hàng năm. Địa điểm: Tòa nhà ABC, 123 Trần Duy Hưng, Cầu Giấy, Hà Nội. Thời gian làm việc: 8h00-17h30 Thứ 2-6, Thứ 7 bán thời gian nếu có dự án gấp. Hạn nộp: 31/12/2026. Liên hệ: HR Department, email: hr@jobconnect.vn, điện thoại: 0987654321. Hồ sơ gồm CV, thư xin việc, chứng chỉ liên quan. Cam kết bảo mật thông tin ứng viên. Công ty TNHH JobConnect Việt Nam. Ứng viên cần làm việc độc lập, chịu áp lực cao. Có kinh nghiệm AWS, Azure là lợi thế. Hưởng phúc lợi khác theo quy định công ty. Gửi hồ sơ về email trước hạn nộp.',
  requirements: 'Tốt nghiệp đại học CNTT, 2 năm kinh nghiệm (kn) lập trình',
  benefits: 'Lương cạnh tranh, thưởng, bảo hiểm (bhxh, bhyt)',
  location: 'Hà Nội',
  jobType: 'Full-time',
  jobLevel: 'Mid-level'
};

describe('JobConnect Text Preprocessing Pipeline Validation', () => {
  test('Full pipeline execution with fuzzy semantic overlap detection', async () => {
    // Stage 1: Cleaning
    const cleanedText = cleaningText(sampleJob);
    expect(cleanedText).not.toBeNull();
    expect(typeof cleanedText).toBe('string');

    const originalDescLength = sampleJob.description.length;
    const cleanedParts = cleanedText.split('Description: ')[1];
    const cleanedDescLength = cleanedParts ? (cleanedParts.split(' Requirements:')[0] || '').length : 0;
    const compressionRatio = (cleanedDescLength / originalDescLength) * 100;
    expect(compressionRatio).toBeGreaterThanOrEqual(70);

    // Stage 2: Standardization
    const standardizedText = textStandardization(cleanedText);

    const decomposedText = 'e\u0302';
    const normalizedDecomposed = textStandardization(decomposedText);
    expect(normalizedDecomposed).toBe('\u00EA');

    expect(standardizedText).toContain('kinh nghiệm');
    expect(standardizedText).toContain('bảo hiểm xã hội');
    expect(standardizedText).not.toContain(' kn ');
    expect(standardizedText).not.toContain(' bhxh ');

    // Stage 3: Chunking
    const chunks = textChunking(standardizedText);
    expect(chunks.length).toBeGreaterThan(0);

    chunks.forEach(chunk => {
      expect(chunk.trim().length).toBeLessThanOrEqual(500);
      expect(chunk.trim().length).toBeGreaterThan(0);
    });

    if (chunks.length > 1) {
      for (let i = 0; i < chunks.length - 1; i++) {
        const current = chunks[i];
        const next = chunks[i + 1];
        const overlap = getActualOverlap(current, next);
        if (overlap.length > 0) {
          expect(overlap.length).toBeGreaterThan(0);
          expect(overlap.length).toBeLessThanOrEqual(150);
          expect(/[.\n;]/.test(overlap.trim())).toBe(true);
          expect(current.trim().endsWith(overlap.trim())).toBe(true);
          expect(next.trim().startsWith(overlap.trim())).toBe(true);
        }
      }
    }

    // Stage 4: Embedding (mocked, verify mock works)
    const { textEmbedding } = require('../../src/utils/preprocessing/textEmbedding');
    const mockEmbedding = await textEmbedding('test');
    expect(Array.isArray(mockEmbedding)).toBe(true);
    expect(mockEmbedding.length).toBe(384);

    // Full text coverage
    const combinedChunks = chunks.join(' ');
    expect(combinedChunks.length).toBeGreaterThanOrEqual(standardizedText.length * 0.9);
  }, 30000);
});
