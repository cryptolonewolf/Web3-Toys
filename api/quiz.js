// GET /api/quiz?toy=crypto-in-5
// Sends the quiz questions and options, without the answers.

const { loadQuiz, publicQuiz, send, query } = require('./_lib');

module.exports = (req, res) => {
  const quiz = loadQuiz(String(query(req).toy || ''));
  if (!quiz) return send(res, 404, { error: 'No quiz for this toy.' });
  send(res, 200, publicQuiz(quiz));
};
