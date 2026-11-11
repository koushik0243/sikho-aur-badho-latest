// Shared by the learner's Test Results page and its PDF export.

export const BAND_STYLE = {
  full: { cls: 'st_completed', rgb: [21, 128, 61] },
  partial: { cls: 'st_in_progress', rgb: [13, 148, 136] },
  zero: { cls: 'st_dropout', rgb: [185, 28, 28] },
};
export const DIFFICULTY_LABEL = { beginner: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced' };
export const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

/** 252 → '4m 12s'; null → 'Not recorded'. */
export function duration(sec) {
  if (sec === null || sec === undefined) return 'Not recorded';
  const m = Math.floor(sec / 60);
  return m ? `${m}m ${String(Math.round(sec % 60)).padStart(2, '0')}s` : `${Math.round(sec)}s`;
}

export const resultText = (r) => (r.kind === 'aptitude' ? (LEVEL[r.level] || 'Taken') : r.passed ? 'Passed' : 'Not passed');

export const RULES_TEXT = [
  'Speech score = the marks the AI gave your spoken answers (partial credit allowed), averaged over the questions you answered. With skips = the same, counting skipped questions as 0.',
  'Answer bands: full marks = 80%+ of a question\'s marks, partial = 1–79%, no marks = 0%.',
  'MCQ score = multiple-choice questions. Your tests have them only when the course includes multiple-choice questions.',
  'Skipped = questions you skipped or submitted without saying anything. Skip rate by position shows whether you skip more later in a test (e.g. when time runs short).',
];
