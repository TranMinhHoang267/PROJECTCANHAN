/**
 *
 * @param {String} text
 */
const clean = (text) => {
  if (!text) return text;
  if (typeof text !== "string") return text;

  return noiseRemoval(removeEmojis(text));
};

/**
 * Remove control characters, HTML tags, emojis, and normalize Vietnamese text
 * @param {String} text
 */
const noiseRemoval = (text) => {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, " ") // Remove control characters
      .replace(/<[^>]*>/g, " ") // remove HTML tags
      .replace(/\s+/g, " ") // replace multiple whitespace with single space
      .replace(/[,/#!$%^&*;:{}=\-_`~()]/g, " ") // replace punctuation with single space
      .trim() // trim leading and trailing whitespace
      .toLowerCase()
  ); // convert to lowercase for consistency
};

// Remove emojis using a regex pattern that matches a wide range of emoji characters
/**
 *
 * @param {String} text
 */
const removeEmojis = (text) => {
  return text
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      "",
    )
    .replace(
      /[^\w\s.aàáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹđAÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴEÈÉẸẺẼÊỀẾỆỂỄIÌÍỊỈĨOÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠUÙÚỤỦŨƯỪỨỰỬỮYỲÝỴỶỸĐ]/g,
      " ",
    )
    .trim();
};

/**
 * Create a representative document for a job to be embedded
 */

/**
 *
 * @param {import('@prisma/client').Job} job
 * @returns {Array<String>}
 */
const cleaningJob = (job) => {
  if (!job) return null;
  const title = clean(job.title);
  let desc = clean(job.description);
  const req = clean(job.requirements);
  const benefits = clean(job.benefits);
  const salary =
    job.salaryMin && job.salaryMax
      ? `${clean(job.salaryMin)} - ${clean(job.salaryMax)}`
      : job.salaryMin;

  // If more than 30% of the text was removed, it might be too noisy, so we can choose to return an empty string or the original text}
  // Description is crucial for understanding the job, if it's too noisy, we skip embedding this job
  if (desc.length < job.description.length * 0.7) {
    desc = job.description;
  }
  /**
   * Create a single string that combines all relevant information about the job. This string will be used for generating embeddings.
   * The format can be adjusted based on what information is most important for the embedding model. Here, we include the job title, location, type, level, description, requirements, and benefits.
   * We also ensure that any extra whitespace is reduced to a single space to keep the text clean and consistent.
   * So AI can understand the context of the job posting and generate a meaningful vector representation for it.
   */
  const jobTitleContext = title;
  const cleanedArray = [
    `Vị trí ${jobTitleContext} làm việc tại địa điểm: ${clean(job.location)}.`,
    `Vị trí ${jobTitleContext} có hình thức làm việc là: ${clean(job.jobType)}.`,
    `Vị trí ${jobTitleContext} yêu cầu cấp bậc: ${clean(job.jobLevel)}.`,
    `Mô tả công việc của vị trí ${jobTitleContext}: ${desc}`,
    `Yêu cầu tuyển dụng của vị trí ${jobTitleContext}: ${req}`,
    `Quyền lợi và phúc lợi của vị trí ${jobTitleContext}: ${benefits}`,
    `Mức lương của vị trí ${jobTitleContext}: ${salary}`,
  ];
  return cleanedArray;
};

/**
 *
 * @param {String} text
 */
const cleaningText = (text) => {
  if (!text) return null;
  const cleaned = clean(text);
  // If more than 30% of the text was removed, it might be too noisy, so we can choose to return an empty string or the original text
  if (cleaned.length < text.length * 0.7) {
    return null;
  }
  return cleaned;
};
module.exports = { cleaningText, cleaningJob };
