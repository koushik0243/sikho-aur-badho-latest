// Shared by the learner dashboard and the My Courses page.

/** Course stages, in display order (in progress first). */
export const STAGES = [
  { key: 'in_progress', label: 'In progress' },
  { key: 'not_started', label: 'Not started' },
  { key: 'completed',   label: 'Completed' },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map(st => [st.key, st.label]));
export const STAGE_RANK  = Object.fromEntries(STAGES.map((st, i) => [st.key, i]));

// Cover colours, picked from the title so a course always keeps its colour.
const COVERS = [
  ['#0b7b7b', '#14b8a6'], ['#0f766e', '#2dd4bf'], ['#115e59', '#0d9488'],
  ['#155e75', '#06b6d4'], ['#1e3a8a', '#3b82f6'], ['#3730a3', '#8b5cf6'],
];
export const coverOf = (title = '') => COVERS[[...title].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % COVERS.length];

/**
 * Thumbnail text: the first letter of every word ("My New Course Latest" → "MNCL");
 * a one-word name shows the whole word ("MERN"). Words that don't start with a
 * letter (numbers, dates like 24.09.2026) are left out.
 */
export const initialsOf = (title = '') => {
  const words = title.trim().split(/\s+/).filter(w => /^\p{L}/u.test(w));
  if (words.length === 0) return title.trim().slice(0, 4) || 'C';
  if (words.length === 1) return words[0];
  return words.map(w => [...w][0]).join('').toUpperCase();
};

/** Size class for the thumbnail text, so long names still fit. */
export const initialsSize = (text) => (text.length <= 3 ? 'init_l' : text.length <= 5 ? 'init_m' : text.length <= 8 ? 'init_s' : 'init_xs');

/**
 * A learner's progress on a course (from GET /my-report/progress) → what the card shows.
 * Started = any progress, or any step taken (aptitude test, a lesson, a quiz, homework / Zoom).
 */
export function courseState(mine) {
  const started = Boolean(mine && (mine.progress > 0 || ['in_progress', 'completed'].includes(mine.status)
    || Object.values(mine.phases || {}).some(ph => ph.status === 'done' || ph.status === 'in_progress')));
  return {
    started,
    stage: mine?.status === 'completed' ? 'completed' : started ? 'in_progress' : 'not_started',
    progress: mine ? mine.progress : 0,
    chapters: mine?.chapters ?? null,
    chaptersDone: mine?.chaptersDone ?? null,
    currentChapter: mine?.currentChapter?.title || null,
    certificate: Boolean(mine?.phases?.completion?.certificate),
  };
}
