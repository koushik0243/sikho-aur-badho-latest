'use client';

import CourseCardFrame from '../../Learner/CourseCard/CourseCardFrame';
import cc from '../../Learner/CourseCard/CourseCard.module.css';
import s from './StoreCourseCard.module.css';

// Store owner course card (All Courses, My Courses) — the learner card's look
// with the store owner's content: status, category, level, duration, chapters.

const Icon = {
  clock:    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>,
  chapters: <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>,
  level:    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>,
};

/** "1h 30m" / "45m" / "" */
function fmtDuration(hr, min) {
  const h = parseInt(hr, 10) || 0;
  const m = parseInt(min, 10) || 0;
  if (!h && !m) return '';
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
}

const STATUS_CHIP = { published: 'chip_published', draft: 'chip_draft' };

/**
 * @param {{
 *   course: object,                               // course document (title, desc, catId, level, duration_*, totalChapters, status)
 *   footer?: import('react').ReactNode,           // extra line under the chips (e.g. learner count)
 *   action: { label: string, onClick?: () => void, disabled?: boolean, done?: boolean },
 * }} props
 */
export default function StoreCourseCard({ course: c, footer, action }) {
  const status = (c.status || 'published').toLowerCase();
  const duration = fmtDuration(c.duration_hr, c.duration_min);
  const chapters = parseInt(c.totalChapters, 10) || 0;
  const title = c.title || '—';
  return (
    <CourseCardFrame
      title={title}
      category={c.catId?.title}
      desc={c.desc}
      chipLeft={<span className={`${cc.stageChip} ${cc[STATUS_CHIP[status] || 'chip_inactive']}`}>{status}</span>}
      actions={action.done
        ? <span className={`${cc.btnResume} ${s.btnDone}`} role="status">{action.label}</span>
        : <button type="button" className={`${cc.btnResume} ${s.btnBusy}`} onClick={action.onClick} disabled={action.disabled}>{action.label}</button>}
    >
      {(c.level || duration || chapters > 0) && (
        <ul className={s.meta} aria-label="Course details">
          {c.level && <li>{Icon.level}<span className={s.cap}>{c.level}</span></li>}
          {duration && <li>{Icon.clock}{duration}</li>}
          {chapters > 0 && <li>{Icon.chapters}{chapters} chapter{chapters !== 1 ? 's' : ''}</li>}
        </ul>
      )}
      <div className={s.push} aria-hidden="true" />
      {footer && <div className={s.footer}>{footer}</div>}
    </CourseCardFrame>
  );
}
