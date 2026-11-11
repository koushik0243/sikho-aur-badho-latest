// Mirrors server/quiz_attempts/quiz_settings.js: turns the quiz's saved
// builder settings (Topic.quizSettings, loosely-typed form values) into the
// rules the learner's quiz follows. Keep the two in step.

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

export function normalizeQuizSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const unit = UNIT_SECONDS[String(s.timeUnit || 'Minutes').toLowerCase()] || 60;
  return {
    timeLimitSeconds:   s.timeLimit === undefined || s.timeLimit === null || s.timeLimit === ''
      ? DEFAULT_TIME_LIMIT_MINUTES * 60
      : toInt(s.timeLimit, 0) * unit, // 0 = no time limit
    hideQuizTime:       s.hideQuizTime === true,
    attemptsAllowed:    toInt(s.attemptsAllowed, DEFAULT_ATTEMPTS_ALLOWED),  // 0 = unlimited
    passingGrade:       Math.min(100, toInt(s.passingGrade, DEFAULT_PASSING_GRADE)),
    maxQuestions:       toInt(s.maxQuestions, DEFAULT_MAX_QUESTIONS),     // 0 = every selected question
    quizAutoStart:      s.quizAutoStart === true,
    questionLayout:     s.questionLayout === 'all' ? 'all' : 'single',
    questionOrder:      s.questionOrder === 'random' ? 'random' : 'sequential',
    hideQuestionNumber: s.hideQuestionNumber === true,
  };
}
