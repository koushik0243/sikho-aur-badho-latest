'use client';

import { STAGES } from './courseCardData';
import s from './CourseCard.module.css';

/**
 * "My Courses" header: title, a one-line summary and filter chips (All / In progress / Not started / Completed).
 * @param {{ id: string, title: string, as?: 'h1'|'h2', courses: { stage: string }[], value: string, onChange: (key: string) => void, showControls?: boolean }} props
 */
export default function CourseFilters({ id, title, as: Heading = 'h2', courses, value, onChange, showControls = true }) {
  const count = key => (key === 'all' ? courses.length : courses.filter(c => c.stage === key).length);
  return (
    <div className={s.coursesHead}>
      <div>
        <Heading id={id} className={s.listTitle}>{title}</Heading>
        {showControls && courses.length > 0 && (
          <p className={s.coursesSub}>
            {courses.length} course{courses.length === 1 ? '' : 's'} · {count('completed')} completed · {count('in_progress')} in progress
          </p>
        )}
      </div>
      {showControls && courses.length > 0 && (
        <div className={s.courseTabs} role="group" aria-label="Show courses">
          {[{ key: 'all', label: 'All' }, ...STAGES].map(t => (
            <button key={t.key} type="button" className={s.courseTab} aria-pressed={value === t.key} onClick={() => onChange(t.key)}>
              {t.label} <span className={s.courseTabCount}>{count(t.key)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
