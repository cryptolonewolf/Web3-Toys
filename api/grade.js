// POST /api/grade  { toy, answers: { questionId: optionIndex | null }, name? }
// Marks the quiz. With a name and a pass, also stamps a certificate code.

const { loadQuiz, grade, issue, cleanName, send, readBody } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return send(res, 400, { error: 'Could not read the answers.' });
  }
  const quiz = loadQuiz(String(body.toy || ''));
  if (!quiz) return send(res, 404, { error: 'No quiz for this toy.' });

  const result = grade(quiz, body.answers);
  const name = cleanName(body.name);
  if (result.passed && name) {
    const secret = process.env.CERT_SECRET;
    if (!secret) {
      result.certificateError = 'Certificates are not switched on yet: the site owner needs to set CERT_SECRET in Vercel.';
    } else {
      const { code, date } = issue(secret, quiz, result.score, name);
      result.certificate = { toy: quiz.id, title: quiz.title, name, score: result.score, date, code };
    }
  }
  send(res, 200, result);
};
