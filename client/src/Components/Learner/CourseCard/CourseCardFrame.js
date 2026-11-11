'use client';

import { coverOf, initialsOf, initialsSize } from './courseCardData';
import s from './CourseCard.module.css';

/**
 * The course card's shape, shared by the learner cards (dashboard, My Courses)
 * and the store owner's course lists: a cover (the title's initials on a colour
 * picked from the title), chips on the cover, then category, title,
 * description, any extra content, and the action button(s).
 * @param {{
 *   title: string, category?: string, desc?: string,
 *   chipLeft?: import('react').ReactNode,        // e.g. status / stage chip
 *   chipRight?: import('react').ReactNode,       // e.g. certificate chip
 *   beforeTitle?: import('react').ReactNode,     // lines between category and title
 *   children?: import('react').ReactNode,        // content after the description
 *   actions?: import('react').ReactNode,         // button(s) at the bottom
 *   className?: string,
 * }} props
 */
export default function CourseCardFrame({ title, category, desc, chipLeft, chipRight, beforeTitle, children, actions, className = '' }) {
  const [from, to] = coverOf(title);
  const initials = initialsOf(title);
  return (
    <article role="listitem" className={`${s.courseCard} ${className}`}>
      <div className={s.courseThumb} style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}>
        <span className={`${s.courseInitials} ${s[initialsSize(initials)]}`} aria-hidden="true">{initials}</span>
        {chipLeft}
        {chipRight}
      </div>
      <div className={s.courseBody}>
        {category && <p className={s.courseCategory}>{category}</p>}
        {beforeTitle}
        <h3 className={s.courseTitle} title={title}>{title}</h3>
        {desc && <p className={s.courseDesc}>{desc}</p>}
        {children}
        {actions && <div className={s.courseBtns}>{actions}</div>}
      </div>
    </article>
  );
}
