// Shared by the Test Performance report page and its PDF export.

export const OUTCOME = {
  passed: { label: 'Passed', rgb: [21, 128, 61] },
  failed: { label: 'Failed', rgb: [185, 28, 28] },
  pending: { label: 'Awaiting evaluation', rgb: [156, 163, 175] },
};

// Ordered light → dark (one hue): the level is a rank, not a category.
export const LEVELS = [
  { key: 'beginner', label: 'Beginner', rgb: [45, 212, 191] },
  { key: 'intermediate', label: 'Intermediate', rgb: [13, 148, 136] },
  { key: 'expert', label: 'Expert', rgb: [19, 78, 74] },
];

/** '4.5 days', '1 day' or '—'. */
export const daysText = (v) => (v === null || v === undefined ? '—' : `${v} day${v === 1 ? '' : 's'}`);

/** '3 / 10 (30%)' */
export const doneText = (done, total, rate) => `${done} / ${total}${rate === null || rate === undefined ? '' : ` (${rate}%)`}`;
