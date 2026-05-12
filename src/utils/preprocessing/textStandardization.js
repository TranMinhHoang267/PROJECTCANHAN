/**
 * Normalize Vietnamese text to NFC form to ensure consistent representation of characters with diacritics
 * This is important for Vietnamese text because it can be represented in multiple ways (e.g., using combining characters or precomposed characters). Normalizing to NFC form ensures that all characters are represented in a consistent way, which can improve the quality of text processing and embedding.
 * Additionally, we convert the text to lowercase to further standardize it and reduce the number of unique tokens, which can help improve the quality of embeddings and search results.
 * @param {*} text
 */
const normalizeVietnamese = (text) => {
  if (typeof text !== "string") return text;
  return text.toLowerCase().normalize("NFC");
};

/**
 * Some common Vietnamese abbreviations and their expansions. This can be used to further standardize the text by replacing abbreviations with their full forms.
 * This is particularly useful in job descriptions where abbreviations are common. By expanding these abbreviations, we can improve the quality of the text for embedding and search.
 * The list can be expanded based on the specific domain and common usage in the job postings being processed.
 */
const VIETNAMESE_ABBREVIATIONS = {
  tv: "thành viên",
  ko: "không",
  dc: "được",
  đc: "được",
  đk: "đăng ký",
  cs: "có",
  đt: "đào tạo",
  kn: "kinh nghiệm",
  nv: "nhân viên",
  cty: "công ty",
  tuyển: "tuyển dụng",
  offer: "đề nghị",
  nlđ: "người lao động",
  ql: "quản lý",
  tl: "trưởng phòng",
  pql: "phó quản lý",
  gd: "giám đốc",
  pgd: "phó giám đốc",
  tp: "trưởng phòng",
  ptp: "phó trưởng phòng",
  hc: "hành chính",
  bh: "bảo hiểm",
  bhxh: "bảo hiểm xã hội",
  bhyt: "bảo hiểm y tế",
};

/**
 * Handle common Vietnamese abbreviations by replacing them with their full forms. This can help improve the quality of the text for embedding and search.
 * The function iterates through the predefined list of abbreviations and replaces any occurrences in the text with their corresponding expansions.
 * This is particularly useful in job descriptions where abbreviations are common. By expanding these abbreviations, we can improve the quality of the text for embedding and search.
 * The list can be expanded based on the specific domain and common usage in the job postings being processed.
 * @param {*} text
 */
const handleAbbreviations = (text) => {
  if (typeof text !== "string") return text;

  // Sắp xếp từ điển từ dài đến ngắn để tránh thay thế nhầm (VD: bhxh trước bh)
  const sortedAbbrs = Object.entries(VIETNAMESE_ABBREVIATIONS).sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [abbr, full] of sortedAbbrs) {
    /**
     * Giải thích Regex mới:
     * (?<=^|[\s\(\[\{]) : Phía trước là đầu dòng, khoảng trắng hoặc dấu ngoặc mở ( ( [ { )
     * ${abbr}           : Từ viết tắt
     * (?=$|[\s\)\}\],\.]) : Phía sau là cuối dòng, khoảng trắng, dấu ngoặc đóng hoặc dấu chấm/phẩy
     */
    const regex = new RegExp(
      `(?<=^|[\\s\\(\\[\\{])${abbr}(?=$|[\\s\\)\\}\\]\\,\\.])`,
      "gi",
    );
    text = text.replace(regex, full);
  }
  return text;
};

/**
 * Remove common Vietnamese stop words from the text. This can help improve the quality of the text for embedding and search.
 * The function iterates through a predefined list of stop words and removes any occurrences in the text.
 * This is particularly useful in job descriptions where certain words may not contribute significantly to the meaning or searchability of the text.
 * The list can be expanded based on the specific domain and common usage in the job postings being processed.
 */

const VIETNAMESE_STOP_WORDS = [
  "và",
  "là",
  "của",
  "có",
  "cho",
  "được",
  "để",
  "trong",
  "với",
  "những",
  "một",
  "này",
  "đó",
  "như",
  "từ",
  "đến",
  "bởi",
  "vì",
  "nhưng",
  // Add more stop words as needed
];
/**
 *
 * @param {*} text
 * @returns
 */
const removeStopWords = (text) => {
  if (typeof text !== "string") return text;

  //merge stop words into a regex pattern for efficient replacement
  const pattern = `\\b (${VIETNAMESE_STOP_WORDS.join("|")}) \\b`;
  const regex = new RegExp(pattern, "gi");

  // Replace stop words with an empty string, then reduce multiple spaces to a single space and trim the result
  return text.replace(regex, " ").replace(/\s+/g, " ").trim();
};

/**
 * * @param {String} text
 */
const textStandardization = (text) => {
  if (!text) return null;
  if (typeof text !== "string") return text;
  return removeStopWords(handleAbbreviations(normalizeVietnamese(text)));
};

module.exports = {
  textStandardization,
  removeStopWords,
};
