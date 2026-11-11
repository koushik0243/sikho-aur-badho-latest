'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import useScaledIframePreview from '../../../hooks/useScaledIframePreview';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddCertificateTemplate.module.css";
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

const DEFAULT_CERT_TITLE = 'Certificate of Completion';

const DEFAULT_CERT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Certificate of Completion</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a2e;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Open Sans', sans-serif;
      padding: 40px 20px;
    }
    .certificate {
      width: 900px;
      background: #fff;
      position: relative;
      padding: 64px 72px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.4);
    }
    .top-banner, .bottom-banner {
      position: absolute;
      left: 0; right: 0;
      height: 8px;
      background: linear-gradient(90deg, #1a1a2e, #b8962e, #1a1a2e);
    }
    .top-banner { top: 0; }
    .bottom-banner { bottom: 0; }
    .frame { position: absolute; inset: 0; pointer-events: none; }
    .frame::before {
      content: '';
      position: absolute;
      inset: 14px;
      border: 3px solid #b8962e;
    }
    .frame::after {
      content: '';
      position: absolute;
      inset: 21px;
      border: 1px solid #d4af4e;
    }
    .watermark {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 96px;
      font-family: 'Cinzel', serif;
      color: rgba(184,150,46,0.05);
      white-space: nowrap;
      pointer-events: none;
      letter-spacing: 8px;
      font-weight: 700;
    }
    .content { position: relative; z-index: 1; text-align: center; }
    .org-badge { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 20px; }
    .badge-line { width: 60px; height: 1px; background: linear-gradient(to right, transparent, #b8962e); }
    .badge-line-r { background: linear-gradient(to left, transparent, #b8962e); }
    .org-name {
      font-family: 'Cinzel', serif;
      font-size: 12px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #b8962e;
      font-weight: 600;
    }
    .cert-of {
      font-size: 11px;
      letter-spacing: 8px;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 4px;
    }
    .cert-title {
      font-family: 'Cinzel', serif;
      font-size: 52px;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1;
      margin-bottom: 6px;
      letter-spacing: 3px;
    }
    .divider { display: flex; align-items: center; gap: 12px; margin: 0 auto 28px; max-width: 480px; }
    .div-line { flex: 1; height: 1px; background: linear-gradient(to right, transparent, #b8962e 30%, #b8962e 70%, transparent); }
    .div-ornament { font-size: 20px; color: #b8962e; line-height: 1; }
    .presented-to {
      font-size: 12px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 12px;
    }
    .recipient-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 54px;
      font-style: italic;
      font-weight: 600;
      color: #1a1a2e;
      position: relative;
      display: inline-block;
      margin-bottom: 8px;
      padding-bottom: 12px;
    }
    .recipient-name::after {
      content: '';
      position: absolute;
      bottom: 0; left: 10%; right: 10%;
      height: 2px;
      background: linear-gradient(to right, transparent, #b8962e, transparent);
    }
    .completion-text {
      font-size: 14px;
      color: #555;
      line-height: 1.9;
      margin: 20px auto 10px;
      max-width: 540px;
    }
    .course-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 30px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 8px 0 20px;
      letter-spacing: 1px;
    }
    .score-badge {
      display: inline-block;
      border: 1.5px solid #b8962e;
      color: #7a5c00;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 3px;
      text-transform: uppercase;
      padding: 7px 32px;
      border-radius: 2px;
      background: linear-gradient(to right, #fffdf5, #fff9e8, #fffdf5);
      margin-bottom: 36px;
    }
    .sig-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 24px;
      gap: 20px;
    }
    .sig-block { text-align: center; flex: 1; }
    .sig-value { font-size: 12px; color: #333; margin-bottom: 4px; font-weight: 500; }
    .sig-label { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #aaa; }
    .seal-wrap { display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; }
    .seal {
      width: 88px; height: 88px;
      border-radius: 50%;
      border: 2.5px solid #b8962e;
      outline: 1px solid #d4af4e;
      outline-offset: 4px;
      background: radial-gradient(circle at 35% 35%, #fffdf5 60%, #fff3c4);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px;
    }
    .seal-star { font-size: 18px; line-height: 1; }
    .seal-text {
      font-family: 'Cinzel', serif;
      font-size: 7.5px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #7a5c00;
      text-align: center;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="top-banner"></div>
    <div class="bottom-banner"></div>
    <div class="frame"></div>
    <div class="watermark">CERTIFIED</div>

    <div class="content">
      <div class="org-badge">
        <div class="badge-line"></div>
        <div class="org-name">ThinkSurf Media Academy</div>
        <div class="badge-line badge-line-r"></div>
      </div>

      <div class="cert-of">Certificate</div>
      <div class="cert-title">OF COMPLETION</div>

      <div class="divider">
        <div class="div-line"></div>
        <div class="div-ornament">&#10022;</div>
        <div class="div-line"></div>
      </div>

      <div class="presented-to">This Certificate is Proudly Presented To</div>

      <div class="recipient-name">{{name}}</div>

      <p class="completion-text">
        has successfully completed the following course with excellence,<br/>
        demonstrating outstanding commitment and mastery of all subject matter in
      </p>

      <div class="course-name">{{course}}</div>

      <div class="score-badge">Score Achieved: {{marks}}</div>

      <div class="sig-section">
        <div class="sig-block">
          <div class="sig-value">________________</div>
          <div class="sig-label">Date of Issue</div>
        </div>
        <div class="seal-wrap">
          <div class="seal">
            <div class="seal-star">&#9733;</div>
            <div class="seal-text">Official<br/>Seal</div>
          </div>
        </div>
        <div class="sig-block">
          <div class="sig-value">________________</div>
          <div class="sig-label">Authorized Signature</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

export default function AddCertificateTemplate() {
  const router = useRouter();

  const [title, setTitle]           = useState(DEFAULT_CERT_TITLE);
  const [desc, setDesc]             = useState(DEFAULT_CERT_HTML);
  // Live preview intentionally lags behind `desc` — it only re-syncs when the learner
  // clicks/tabs out of the HTML textarea (onBlur), not on every keystroke. Re-rendering
  // the iframe on every character would be wasteful and jumpy for a full HTML document.
  const [previewHtml, setPreviewHtml] = useState(DEFAULT_CERT_HTML);
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { wrapRef, frameRef, handleLoad, wrapStyle, frameStyle } = useScaledIframePreview();

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
      await apiServiceHandler('POST', 'certificate-template/create', { title: title.trim(), desc: desc.trim() });
      toast.success('Certificate template created successfully.');
      router.push('/superadmin/certificate-template');
    } catch {
      toast.warning('Failed to create certificate template. Please try again.');
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
        <h1 className={s.pageTitle}>Add Certificate Template</h1>
        <p className={s.pageSubtitle}>Create a new certificate template</p>
      </div>

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
            {submitting ? 'Creating…' : 'Create Template'}
          </button>
          <button type="button" className={s.btnPreview} onClick={() => setShowPreview(true)}>
            Preview Certificate
          </button>
          <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/certificate-template')}>
            Cancel
          </button>
        </div>
      </form>

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
