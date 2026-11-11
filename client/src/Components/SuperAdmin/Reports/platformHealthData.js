// Shared by the Platform Health page and its PDF export.

export const COURSE_RANKINGS = [
  { value: 'enrollments', label: 'Enrollments' },
  { value: 'certificates', label: 'Certificates' },
  { value: 'completionRate', label: 'Completion rate' },
  { value: 'passRate', label: 'Quiz pass rate' },
  { value: 'rating', label: 'Rating' },
  { value: 'revenue', label: 'Revenue' },
];

export const ORG_RANKINGS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'enrollments', label: 'Enrollments' },
  { value: 'certificates', label: 'Certificates' },
  { value: 'activeLearners', label: 'Active learners' },
  { value: 'completionRate', label: 'Completion rate' },
];

/** Rows sorted by `key` (highest first, no data last), with a rank. Ties: enrollments, then name. */
export function ranked(rows, key, nameKey) {
  return [...rows]
    .sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1) || b.enrollments - a.enrollments || String(a[nameKey]).localeCompare(String(b[nameKey])))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** '+12.5%' / '−4%' / null when there is nothing to compare with. */
export const changeText = (v) => (v === null || v === undefined ? null : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`);
