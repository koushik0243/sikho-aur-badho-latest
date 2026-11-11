// Shared by the Test Results page and its PDF export.

export const GRADE_STYLE = {
  A: { rgb: [21, 128, 61], cls: 'gr_A' },
  B: { rgb: [13, 148, 136], cls: 'gr_B' },
  C: { rgb: [107, 114, 128], cls: 'gr_C' },
  D: { rgb: [180, 83, 9], cls: 'gr_D' },
  F: { rgb: [185, 28, 28], cls: 'gr_F' },
};
export const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

/** 252 → '4m 12s'; null → 'Not recorded'. */
export function duration(sec) {
  if (sec === null || sec === undefined) return 'Not recorded';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

export const gradeScaleText = (grades) => grades.map((g, i) => (i === 0 ? `${g.grade} ${g.min}%+` : `${g.grade} ${g.min}–${grades[i - 1].min - 1}%`)).join(' · ');

export const rulesText = (grades) => [
  `Grade from the score: ${gradeScaleText(grades)}. Pass / fail uses each quiz's own pass mark.`,
  'Score and grade per employee use their best attempt on each quiz; best / worst chapter = their highest / lowest average best score by chapter.',
  'Skipped = questions left unanswered. Time taken is recorded for attempts from now on; earlier attempts show "Not recorded".',
];
