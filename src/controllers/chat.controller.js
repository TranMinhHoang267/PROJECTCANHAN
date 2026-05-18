const chat = require("../services/chat.services");
const prisma = require("../config/prisma");
/**
 *  The controller where the user can ask questions about job suggestions and get answers based on their profile and preferences.
 *  It also allows users to view their chat history with the system.
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.chat = async (req, res) => {
  const userId = req.user.id;
  const { question } = req.body;
  //console.log("Received question:", question);
  const ans = await chat.chat(question, userId);
  console.log("Answer:", ans);

  if (ans.type === "SUCCESS")
    //storing question and answer to database
    await prisma.userChat.create({
      data: {
        userId: userId,
        question: question,
        template: ans.message,
        answer: JSON.stringify(ans.data) ?? "",
      },
    });

  return res.status(200).json(ans);
};

/**
 * The controller to get the chat history of the user, which includes all the questions asked and answers received in the past.
 * @param {*} req
 * @param {*} res
 * @returns {Promise<Record<String,String>>}
 */
exports.chatHistory = async (req, res) => {
  const userId = req.user.id;
  const history = await chat.history(userId);
  return res.status(200).json(history);
};

/**
 * The controller to get the job from keyword and filters, which includes all when user uses the search feature.
 * The controller needs these parameters: keyword, location, jobType, jobLevel, salary
 * The maximum number of suggestions returned is 10, and the suggestions are sorted by relevance to the keyword and filters.
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.getJobSuggestions = async (req, res) => {
  const userId = req.user.id;
  const keyword = req.query.keyword || "";
  const location = req.query.location || "";
  const jobType = req.query.jobType || "";
  const jobLevel = req.query.jobLevel || "";
  const salary = req.query.salary || "";

  const suggestions = await chat.getJobSuggestions(userId, {
    keyword,
    location,
    jobType,
    jobLevel,
    salary,
  });

  return res.status(200).json({ suggestions });
};
