const TYPE = { failed: "FAILED", success: "SUCCESS" };
/**
 *
 * @param {string} type
 * @param {String|Number} [message]
 * @param {Record<String,String>} [data]
 * @returns {Record<String,String>}
 */
const messageResponse = (type, message = "", data = {}) => {
  const response = { type, message };

  if (data && Object.keys(data).length > 0) {
    response.data = data;
  }

  return response;
};
module.exports = { TYPE, messageResponse };
