'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import useScaledIframePreview from '../../../hooks/useScaledIframePreview';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditCertificateTemplate.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const CertIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
  </svg>
);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

export default function EditCertificateTemplate() {
  const router = useRouter();
  const { id } = useParams();

  const [title, setTitle]           = useState('');
  const [desc, setDesc]             = useState('');
  // Live preview intentionally lags behind `desc` — it only re-syncs when the admin
  // clicks/tabs out of the HTML textarea (onBlur), not on every keystroke. Re-rendering
  // the iframe on every character would be wasteful and jumpy for a full HTML document.
  const [previewHtml, setPreviewHtml] = useState('');
  const [errors, setErrors]         = useState({});
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { wrapRef, frameRef, handleLoad, wrapStyle, frameStyle } = useScaledIframePreview();

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `certificate-template/details/${id}`)
      .then(res => {
        const d = res?.data ?? res;
        setTitle(d?.title ?? '');
        setDesc(d?.desc ?? '');
        setPreviewHtml(d?.desc ?? '');
      })
      .catch(() => toast.warning('Failed to load certificate template.'))
      .finally(() => setLoading(false));
  }, [id]);

  function validate() {
    const e = {};
    if (!title.trim()) e.title = 'Title is required.';
    if (!desc.trim())  e.desc  = 'Template HTML is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('PUT', `certificate-template/update/${id}`, { title: title.trim(), desc: desc.trim() });
      toast.success('Certificate template updated successfully.');
      router.push('/superadmin/certificate-template');
    } catch {
      toast.warning('Failed to update certificate template. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="certificate-template">
      <div>
        <button className={s.backBtn} onClick={() => router.push('/superadmin/certificate-template')}>
          {BackArrow} Back to Certificate Templates
        </button>
      </div>
      <div>
        <h1 className={s.pageTitle}>Edit Certificate Template</h1>
        <p className={s.pageSubtitle}>Update certificate template details</p>
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className={s.card}>
            <div className={s.cardHeader}>{CertIcon} Template Information</div>
            <div className={s.cardBody}>
              <div className={s.formGroup}>
                <label className={s.label}>Title <span className={s.required}>*</span></label>
                <input
                  className={s.input}
                  type="text"
                  placeholder="Enter certificate template title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoComplete="off"
                />
                {errors.title && <span className={s.errorMsg}>{errors.title}</span>}
              </div>

              <div className={s.formGroup}>
                <label className={s.label}>Template HTML <span className={s.required}>*</span></label>
                <textarea
                  className={`${s.textarea} ${s.htmlTextarea}`}
                  placeholder="Paste or write the HTML template here..."
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  onBlur={() => setPreviewHtml(desc)}
                />
                {errors.desc && <span className={s.errorMsg}>{errors.desc}</span>}
                <div className={s.templateVars}>
                  <span>Name: <code>{'{{name}}'}</code></span>
                  <span>Course Name: <code>{'{{course}}'}</code></span>
                  <span>Marks: <code>{'{{marks}}'}</code></span>
                </div>
              </div>

              <div className={s.formGroup}>
                <label className={s.label}>Live Preview</label>
                <div className={s.previewPane} ref={wrapRef} style={wrapStyle}>
                  <iframe
                    ref={frameRef}
                    className={s.previewPaneFrame}
                    style={frameStyle}
                    srcDoc={previewHtml}
                    title="Certificate Live Preview"
                    sandbox="allow-same-origin"
                    onLoad={handleLoad}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={s.actions}>
            <button type="submit" className={s.btnSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" className={s.btnPreview} onClick={() => setShowPreview(true)}>
              Preview Certificate
            </button>
            <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/certificate-template')}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {showPreview && (
        <div className={s.previewOverlay}>
          <div className={s.previewTopBar}>
            <span className={s.previewTopTitle}>Certificate Preview — {title || 'Untitled'}</span>
            <button className={s.btnHide} onClick={() => setShowPreview(false)}>
              Close Certificate
            </button>
          </div>
          <iframe
            className={s.previewFrame}
            srcDoc={desc}
            title="Certificate Preview"
            sandbox="allow-same-origin"
          />
        </div>
      )}
    </SuperAdminShell>
  );
}
