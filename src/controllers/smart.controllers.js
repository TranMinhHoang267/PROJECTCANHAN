const smartServices = require("../services/smart.services");
exports.smartScoringCV = async (req, res) => {
  const { jobId, reqOpt } = req.body;
  const result = await smartServices.smartScoringCV(jobId, reqOpt);
  return res.status(200).json(result);
};
