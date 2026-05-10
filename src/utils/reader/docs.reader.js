/**
 * Because the system is storing documents as pdf type. we need to build  a fucntion that read and get all text from doc.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");
const process = require("process");
/**
 *
 * @param {*} filePath
 * @returns {Promise<string>}
 */
async function pdfReader(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Không tìm thấy file tại: ${fullPath}`);
  }

  const dataBuffer = fs.readFileSync(fullPath);
  const data = new PDFParse(dataBuffer);
  return (await data.getText()).text;
}
module.exports = {
  pdfReader,
};
