import lk from './LearnerKit.module.css';

/**
 * A learner page's own CSS module with the shared learner look layered on top
 * (back link, header card, selects, cards). Kit classes sit next to the page's
 * class of the same name and win through doubled selectors.
 * Usage: `const s = withLearnerKit(pageStyles)`.
 */
export function withLearnerKit(styles) {
  const merged = { ...styles };
  for (const [key, cls] of Object.entries(lk)) merged[key] = styles[key] ? `${styles[key]} ${cls}` : cls;
  return merged;
}
