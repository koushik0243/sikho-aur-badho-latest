// Shared by the Chapter Quality Alert page and its PDF export.

export const SEVERITY = {
  critical: { label: 'Critical', rgb: [185, 28, 28] },
  warning: { label: 'Warning', rgb: [180, 83, 9] },
  info: { label: 'Note', rgb: [75, 85, 99] },
  ok: { label: 'OK', rgb: [21, 128, 61] },
};
export const ISSUE_SEVERITIES = ['critical', 'warning', 'info'];
export const FLAG_KIND = { weak: 'Weak', difficult: 'Difficult' };

/** The alert rules in plain words (page footnote + PDF). */
export const rulesText = (r) => [
  `Chapters are judged once their quiz has ${r.MIN_ATTEMPTS}+ evaluated attempts in the period.`,
  `Weak: under ${r.LOW_PASS_RATE}% of learners passed, average score under ${r.LOW_SCORE}%, or rated under ${r.LOW_RATING} / 5.`,
  `Difficult: under ${r.LOW_FIRST_TRY}% passed on the first try, ${r.MANY_RETRIES}+ attempts per learner, or over ${r.HIGH_SKIP}% of questions skipped.`,
  `Critical: under ${r.CRITICAL_PASS_RATE}% of learners passed, or 3+ reasons at once.`,
  `Failed question: ${r.QUESTION_ALERT}%+ of answers scored under ${r.FAILED_SHARE}% of the marks. Skipped question: skipped ${r.QUESTION_ALERT}%+ of the times shown. Both need ${r.QUESTION_MIN_ANSWERS}+ answers / showings.`,
];
