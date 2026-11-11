'use client';

import s from './ViewToolbar.module.css';

const EditIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

/**
 * Breadcrumb + Edit button row at the top of a view (details) page.
 * @param {{
 *   parent: { label: string, onClick: () => void },   // e.g. { label: 'Users', onClick: () => router.push('/superadmin/user') }
 *   current: string,                                   // the record's name
 *   onEdit?: () => void,                               // omit to hide the Edit button
 *   editLabel?: string,
 *   extra?: import('react').ReactNode,                 // more buttons, shown before Edit
 *   maxWidth?: number | string,                        // line the button up with a fixed-width card
 * }} props
 */
export default function ViewToolbar({ parent, current, onEdit, editLabel = 'Edit', extra, maxWidth }) {
  return (
    <div className={s.toolbar} style={maxWidth ? { maxWidth } : undefined}>
      <nav className={s.crumbs} aria-label="Breadcrumb">
        <button type="button" className={s.crumbLink} onClick={parent.onClick}>{parent.label}</button>
        <span className={s.crumbSep} aria-hidden="true">›</span>
        <span className={s.crumbCurr} aria-current="page" title={current}>{current || '—'}</span>
      </nav>
      {(onEdit || extra) && (
        <div className={s.actions}>
          {extra}
          {onEdit && (
            <button type="button" className={s.btnEdit} onClick={onEdit}>
              {EditIcon} {editLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
