// Shared by the learner's Weak Areas page and its PDF export.

export const PRIORITY = {
  high: { label: 'High priority', tone: 'critical', rgb: [185, 28, 28] },
  medium: { label: 'Medium priority', tone: 'warning', rgb: [180, 83, 9] },
  low: { label: 'Low priority', tone: 'info', rgb: [75, 85, 99] },
};

export const rulesText = (r) => [
  `A chapter is listed when its quiz is not passed, its best score is under ${r.LOW_SCORE}%, ${r.HIGH_SKIP}%+ of its questions were skipped, or you started it and lessons are still unwatched.`,
  `High priority = quiz not passed with a best score under ${r.VERY_LOW}%. Medium = quiz not passed, or many questions skipped.`,
  'Skipped questions: questions you skipped or answered with nothing. "Still skipped" = skipped the last time you saw it.',
  'Expected answers are not shown — rewatch the chapter\'s lessons to prepare.',
];
