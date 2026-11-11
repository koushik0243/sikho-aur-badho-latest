'use client';

import { STAGE_LABEL } from './courseCardData';
import CourseCardFrame from './CourseCardFrame';
import s from './CourseCard.module.css';

const Icon = {
  trend: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/></svg>,
  clock: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>,
  check: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>,
  cert:  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/></svg>,
};

/**
 * A learner's course card (dashboard + My Courses page).
 * @param {{
 *   title: string, category?: string, desc?: string,
 *   stage: 'in_progress'|'not_started'|'completed', started: boolean, progress: number,
 *   chapters?: number|null, chaptersDone?: number|null, currentChapter?: string|null, certificate?: boolean,
 *   extra?: import('react').ReactNode,   // extra lines under the category (e.g. chapters, duration, rating)
 *   onOpen: () => void,
 * }} props
 */
export default function CourseCard({ title, category, desc, stage, started, progress, chapters, chaptersDone, currentChapter, certificate, extra, onOpen }) {
  const pct = Math.max(0, Math.min(100, Number(progress || 0)));
  return (
    <CourseCardFrame
      className={s[`stage_${stage}`] || ''}
      title={title}
      category={category}
      desc={desc}
      chipLeft={
        <span className={`${s.stageChip} ${s[`chip_${stage}`]}`}>
          {stage === 'completed' ? Icon.check : stage === 'in_progress' ? Icon.trend : Icon.clock}
          {STAGE_LABEL[stage]}
        </span>
      }
      chipRight={certificate && <span className={s.certChip} title="Certificate earned">{Icon.cert}<span className={s.certText}>Certificate</span></span>}
      beforeTitle={extra}
      actions={<button type="button" className={s.btnResume} onClick={onOpen}>{started ? 'Resume' : 'Start'}</button>}
    >
      <div className={s.courseProgress}>
        <div className={s.courseProgressRow}>
          <span>{chapters ? `${chaptersDone}/${chapters} chapters` : 'Progress'}</span>
          <strong>{pct}%</strong>
        </div>
        <div className={s.courseBar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${title} progress`}>
          <span style={{ width: `${pct}%` }}/>
        </div>
        {stage === 'in_progress' && currentChapter && <p className={s.courseNext}>Up next: {currentChapter}</p>}
      </div>
    </CourseCardFrame>
  );
}
