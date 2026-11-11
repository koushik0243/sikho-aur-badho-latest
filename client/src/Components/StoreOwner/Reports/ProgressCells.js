'use client';

import { PHASE_STATUS, ENROLLMENT_STATUS, CHAPTER_STATUS, phaseText } from './employeeProgressData';
import s from '../../SuperAdmin/Reports/Report.module.css';

/** One phase: status symbol + text, with the status in words for screen readers and the tooltip. */
export const PhaseCell = ({ phaseKey, p }) => (
  <span className={`${s.phase} ${s[`ph_${p.status}`]}`} title={PHASE_STATUS[p.status].label}>
    {p.status !== 'none' && <span className={s.phaseSym} aria-hidden="true">{PHASE_STATUS[p.status].symbol}</span>}
    {phaseText(phaseKey, p)}
    <span className={s.srOnly}> ({PHASE_STATUS[p.status].label})</span>
  </span>
);

/** Course / chapter status in words, coloured. */
export const StatusText = ({ status }) => (
  <span className={`${s.status} ${s[`tstatus_${status}`] || ''}`}>{ENROLLMENT_STATUS[status] || CHAPTER_STATUS[status] || status}</span>
);
