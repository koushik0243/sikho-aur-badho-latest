// Shared by the learner's My Progress page and its PDF export.

export const RULES_TEXT = [
  'Overall % = the average progress of your courses (lesson videos watched + chapter quizzes passed).',
  'My score = the average of your best score on each quiz you have taken. A test is passed once any attempt reaches its pass mark.',
  'A chapter is completed when every lesson video is watched and every chapter quiz is passed. Current chapter = the first chapter of the course not completed yet.',
  'Phases: 1 aptitude test, 2 lessons, 3 chapter quizzes, 4 homework & Zoom, 5 completion & certificate.',
];

/** 'Passed with 82%' / 'Not passed yet (best 41%)'. */
export const testResultText = (t) => (t.passed ? `Passed with ${t.passedScore}%` : `Not passed yet (best ${t.bestScore}%)`);
