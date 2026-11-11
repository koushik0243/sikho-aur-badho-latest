import OpenAI from 'openai';
import AptitudeAttempt from './aptitude_attempt.model.js';
import AptitudeQuestion from '../aptitude_questions/aptitude_question.model.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function evaluateAnswer(questionText, originalAnswer, userAnswer, maxScore) {
  if (!userAnswer?.trim()) {
    return { score: 0, feedback: 'No answer provided.' };
  }
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an aptitude test evaluator. Return JSON only. Be lenient with grammar — answers are voice-transcribed.',
        },
        {
          role: 'user',
          content: `Rate this answer from 0 to 10.\n\nQuestion: ${questionText}\nExpected Answer: ${originalAnswer || '(no reference answer provided)'}\nStudent Answer: ${userAnswer}\n\nRubric:\n10 = fully correct and complete, matches the expected answer's meaning\n7-9 = mostly correct, minor gaps\n4-6 = partially correct, shows understanding\n1-3 = minimal relevant content\n0 = wrong, off-topic, or empty\n\nReturn: {"rating": <0-10>, "feedback": "<one concise sentence>"}`,
        },
      ],
    });
    const parsed = JSON.parse(res.choices[0].message.content);
    const rating = Math.min(10, Math.max(0, Number(parsed.rating) || 0));
    return {
      score: Math.round((rating / 10) * maxScore * 10) / 10,
      feedback: String(parsed.feedback || '').slice(0, 200),
    };
  } catch {
    return { score: 0, feedback: 'Evaluation unavailable.' };
  }
}

function computeLevel(score) {
  if (score <= 60) return 'beginner';
  if (score <= 80) return 'intermediate';
  return 'expert';
}

export const submitAttempt = async ({ userId, courseId, answers, timeTakenSec = null }) => {
  const n = answers.length;
  if (n === 0) throw new Error('No answers submitted.');

  // Look up question text + the expected answer server-side — never trust these
  // from the client, since the learner must not be able to see/tamper with the
  // reference answer before (or while) answering.
  const questionIds = answers.map(a => a.questionId);
  const questions = await AptitudeQuestion.find({ _id: { $in: questionIds } })
    .select('question answer')
    .lean();
  const questionMap = new Map(questions.map(q => [String(q._id), q]));

  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;

  const withMax = answers.map((a, i) => {
    const q = questionMap.get(String(a.questionId));
    return {
      questionId: a.questionId,
      questionText: q?.question || '',
      originalAnswer: q?.answer || '',
      userAnswer: a.userAnswer || '',
      status: a.status || 'skipped',
      maxScore: i === n - 1 ? base + remainder : base,
    };
  });

  const evaluations = await Promise.all(
    withMax.map(a => evaluateAnswer(a.questionText, a.originalAnswer, a.userAnswer, a.maxScore))
  );

  const evaluated = withMax.map((a, i) => ({
    ...a,
    aiScore:    evaluations[i].score,
    aiFeedback: evaluations[i].feedback,
  }));

  const totalScore = Math.min(100, Math.round(evaluated.reduce((s, a) => s + a.aiScore, 0)));
  const level = computeLevel(totalScore);

  const attempt = await AptitudeAttempt.create({
    userId, courseId,
    answers: evaluated,
    totalScore,
    level,
    timeTakenSec,
    status: 'evaluated',
    evaluatedAt: new Date(),
  });

  return attempt;
};

export const listAttempts = async ({ userId, courseId }) => {
  const query = { userId };
  if (courseId) query.courseId = courseId;
  return await AptitudeAttempt.find(query)
    .populate('courseId', 'title')
    .sort({ createdAt: -1 })
    .lean();
};
