// Shared by the Employee Progress page and its PDF export.

export const PHASE_STATUS = {
  done: { label: 'Done', symbol: '✓', rgb: [21, 128, 61] },
  in_progress: { label: 'In progress', symbol: '◐', rgb: [13, 148, 136] },
  not_started: { label: 'Not started', symbol: '○', rgb: [107, 114, 128] },
  none: { label: 'Not in this course', symbol: '—', rgb: [156, 163, 175] },
};

/** Short phase names for table headers. */
export const PHASE_SHORT = { aptitude: 'Aptitude', lessons: 'Lessons', quizzes: 'Quizzes', activities: 'HW & Zoom', completion: 'Completion' };

export const ENROLLMENT_STATUS = { completed: 'Completed', in_progress: 'In progress', not_started: 'Not started', dropout: 'Stopped' };
export const CHAPTER_STATUS = { completed: 'Completed', in_progress: 'In progress', not_started: 'Not started' };
export const QUIZ_RESULT = {
  passed: { label: 'Passed', tone: 'ok', rgb: [21, 128, 61] },
  failed: { label: 'Failed', tone: 'critical', rgb: [185, 28, 28] },
  not_taken: { label: 'Not taken', tone: null, rgb: [107, 114, 128] },
  no_quiz: { label: 'No quiz', tone: null, rgb: [156, 163, 175] },
};

const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

/** '2/6' for a phase, or the aptitude level / certificate where that says more. */
export function phaseText(key, p) {
  if (p.status === 'none') return '—';
  if (key === 'aptitude') return p.done ? `${LEVEL[p.level] || 'Taken'}${p.score !== null ? ` ${p.score}%` : ''}` : 'Not taken';
  if (key === 'completion') return p.done ? (p.certificate ? 'Certificate' : 'Completed') : PHASE_STATUS[p.status].label;
  return `${p.done}/${p.total}${key === 'quizzes' && p.failed ? ` · ${p.failed} failed` : ''}`;
}

export const quizSummary = (e) => (e.quizzes ? `${e.quizPassed} passed${e.quizFailed ? ` · ${e.quizFailed} failed` : ''} of ${e.quizzes}` : 'No quizzes');

export const RULES_TEXT = [
  'Phases follow a course in order: aptitude test (when the course has one), lessons (videos watched), chapter quizzes (passed), homework & Zoom (marked done / joined), then completion and certificate.',
  'A chapter is completed when every lesson video is watched and every chapter quiz is passed (a chapter with only homework / Zoom: when those are done). Quiz result: Passed = every quiz in the chapter passed, Failed = attempted but not passed yet.',
  'Best score = the employee\'s highest quiz score in the chapter. Stopped = no learning on the course for 30+ days.',
];
