'use client';

import { useEffect, useRef, useState } from 'react';
import { loadSubmissionVideo, formatBytes } from '../../lib/assignmentSubmission';
import s from './AssignmentSubmissions.module.css';

/**
 * Popup that plays one homework submission video.
 * @param {{ submission: { _id: string, title?: string, subtitle?: string, size?: number } | null, onClose: () => void }} props
 */
export default function SubmissionPlayer({ submission, onClose }) {
  const [state, setState] = useState({ id: null, url: '', error: '' });
  const closeRef = useRef(null);
  const id = submission?._id || null;

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    let url = '';
    loadSubmissionVideo(id)
      .then(u => { url = u; if (!cancelled) setState({ id, url: u, error: '' }); else URL.revokeObjectURL(u); })
      .catch(err => { if (!cancelled) setState({ id, url: '', error: err.message }); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;
    closeRef.current?.focus();
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, onClose]);

  if (!submission) return null;
  const ready = state.id === id;
  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-labelledby="sub-player-title" onClick={e => e.stopPropagation()}>
        <div className={s.modalHead}>
          <div className={s.modalHeadText}>
            <h3 id="sub-player-title" className={s.modalTitle}>{submission.title || 'Assignment submission'}</h3>
            {submission.subtitle && <p className={s.modalSub}>{submission.subtitle}{submission.size ? ` · ${formatBytes(submission.size)}` : ''}</p>}
          </div>
          <button ref={closeRef} type="button" className={s.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={s.player}>
          {!ready ? <p className={s.playerNote}>Loading video…</p>
            : state.error ? <p className={s.playerError}>{state.error}</p>
              : <video className={s.video} src={state.url} controls autoPlay playsInline controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture />}
        </div>
      </div>
    </div>
  );
}
