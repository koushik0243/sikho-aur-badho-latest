// Shared by the learner's Achievements page and its PDF export.

export const VERDICT = {
  strong: { label: 'Strong', tone: 'ok', rgb: [21, 128, 61] },
  ok: { label: 'Fair', tone: 'info', rgb: [75, 85, 99] },
  weak: { label: 'Weak', tone: 'critical', rgb: [185, 28, 28] },
  untested: { label: 'Not answered yet', tone: 'info', rgb: [156, 163, 175] },
};
export const DIFFICULTY_LABEL = { beginner: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced' };

export const rulesText = (r, grades) => [
  `Grade from your score (average best quiz score): ${grades.map((g, i) => (i === 0 ? `${g.grade} ${g.min}%+` : `${g.grade} ${g.min}–${grades[i - 1].min - 1}%`)).join(', ')}.`,
  'Leaderboard = learners in your organization, ranked by performance (average of course progress and average best quiz score). Others are shown by first name and last initial.',
  `Strong area = a chapter quiz passed with ${r.STRONG}%+; weak area = a chapter quiz not passed yet, or best score under ${r.WEAK}%.`,
  'Attempts: how many tries each quiz took, and whether you passed it on the first try.',
];
