const getEmbedding = async (text) => {
  // Mock 384-dimensional embedding matching MiniLM-L12-v2 output size
  return Array(384).fill(0.1);
};

module.exports = { getEmbedding };
