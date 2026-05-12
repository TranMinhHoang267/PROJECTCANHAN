const jobChatService = require("../services/jobChat.services");
const prisma = require("../config/prisma");
/**
 *
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.chat = async (req, res) => {
  const userId = req.user.id;
  const { question, resumeId } = req.body;
  //console.log("Received question:", question);
  const ans = await jobChatService.chat(question, userId, resumeId);

  //storing question and answer to database
  await prisma.userChat.create({
    data: {
      userId: userId,
      question: question,
      answer: ans ?? "",
    },
  });

  return res.status(200).json({ ans });
};

/**
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.history = async (req, res) => {
  const userId = req.user.id;
  const history = await jobChatService.history(userId);
  return res.status(200).json({ history });
};
