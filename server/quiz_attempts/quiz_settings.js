// The course builder saves a quiz's settings on its Topic (Topic.quizSettings)
// as loosely-typed form values ('20', 'Minutes', …). This turns them into the
// rules the learner's quiz actually follows. Quizzes saved before a field
// existed get the defaults below.

// Defaults for any setting a quiz was saved without — same values as the
// course builder's DEFAULT_QUIZ_SETTINGS.
export const DEFAULT_PASSING_GRADE = 20;
export const DEFAULT_TIME_LIMIT_MINUTES = 60;
export const DEFAULT_ATTEMPTS_ALLOWED = 20;
export const DEFAULT_MAX_QUESTIONS = 20;

const toInt = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const UNIT_SECONDS = { seconds: 1, minutes: 60, hours: 3600 };

/**
 * @param {object|null|undefined} raw Topic.quizSettings
 * @returns {{
 *   timeLimitSeconds: number,   // 0 = no time limit
 *   hideQuizTime: boolean,
 *   attemptsAllowed: number,    // 0 = unlimited
 *   passingGrade: number,       // percent, 0–100
 *   maxQuestions: number,       // 0 = every selected question
 *   quizAutoStart: boolean,
 *   questionLayout: 'single' | 'all',
 *   questionOrder: 'random' | 'sequential',
 *   hideQuestionNumber: boolean,
 * }}
 */
export function normalizeQuizSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const unit = UNIT_SECONDS[String(s.timeUnit || 'Minutes').toLowerCase()] || 60;
  return {
    timeLimitSeconds:   s.timeLimit === undefined || s.timeLimit === null || s.timeLimit === ''
      ? DEFAULT_TIME_LIMIT_MINUTES * 60
      : toInt(s.timeLimit, 0) * unit,
    hideQuizTime:       s.hideQuizTime === true,
    attemptsAllowed:    toInt(s.attemptsAllowed, DEFAULT_ATTEMPTS_ALLOWED),
    passingGrade:       Math.min(100, toInt(s.passingGrade, DEFAULT_PASSING_GRADE)),
    maxQuestions:       toInt(s.maxQuestions, DEFAULT_MAX_QUESTIONS),
    quizAutoStart:      s.quizAutoStart === true,
    questionLayout:     s.questionLayout === 'all' ? 'all' : 'single',
    questionOrder:      s.questionOrder === 'random' ? 'random' : 'sequential',
    hideQuestionNumber: s.hideQuestionNumber === true,
  };
}
