'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import useScaledIframePreview from '../../../hooks/useScaledIframePreview';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./CertificateTemplatesList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, SortArrow, TrashIcon, pageItems } from '../AdminKit/ListParts';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

// Small live-rendered preview of a template's HTML, shrunk to fit a fixed thumbnail
// box (cropped, not scrolled) — same shrink-to-fit measurement the Add/Edit preview
// uses, just constrained to a tiny fixed size here instead of showing the whole thing.
// Clicking it opens the full-size preview popup.
function TemplateThumb({ html, onClick }) {
  const { wrapRef, frameRef, handleLoad, frameStyle } = useScaledIframePreview();
  if (!html) return <div className={s.templateThumb} />;
  return (
    <div
      ref={wrapRef}
      className={s.templateThumb}
      onClick={onClick}
      title="Click to preview"
      role="button"
    >
      <iframe
        ref={frameRef}
        className={s.templateThumbFrame}
        style={frameStyle}
        srcDoc={html}
        title="Certificate template thumbnail"
        sandbox="allow-same-origin"
        onLoad={handleLoad}
      />
    </div>
  );
}

const Icon = {
  search: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
  ),
  cert: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
};

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

const LIMIT = 50;

const SEED_TEMPLATES = [
  {
    title: 'Classic Gold',
    desc: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Certificate of Completion</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    body{background:#1a1a2e;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Open Sans',sans-serif;padding:40px 20px}
    .certificate{width:900px;background:#fff;position:relative;padding:64px 72px;box-shadow:0 30px 80px rgba(0,0,0,.4)}
    .top-banner,.bottom-banner{position:absolute;left:0;right:0;height:8px;background:linear-gradient(90deg,#1a1a2e,#b8962e,#1a1a2e)}
    .top-banner{top:0}.bottom-banner{bottom:0}
    .frame{position:absolute;inset:0;pointer-events:none}
    .frame::before{content:'';position:absolute;inset:14px;border:3px solid #b8962e}
    .frame::after{content:'';position:absolute;inset:21px;border:1px solid #d4af4e}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:96px;font-family:'Cinzel',serif;color:rgba(184,150,46,.05);white-space:nowrap;pointer-events:none;letter-spacing:8px;font-weight:700}
    .content{position:relative;z-index:1;text-align:center}
    .org-badge{display:inline-flex;align-items:center;gap:10px;margin-bottom:20px}
    .badge-line{width:60px;height:1px;background:linear-gradient(to right,transparent,#b8962e)}
    .badge-line-r{background:linear-gradient(to left,transparent,#b8962e)}
    .org-name{font-family:'Cinzel',serif;font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#b8962e;font-weight:600}
    .cert-of{font-size:11px;letter-spacing:8px;text-transform:uppercase;color:#999;margin-bottom:4px}
    .cert-title{font-family:'Cinzel',serif;font-size:52px;font-weight:700;color:#1a1a2e;line-height:1;margin-bottom:6px;letter-spacing:3px}
    .divider{display:flex;align-items:center;gap:12px;margin:0 auto 28px;max-width:480px}
    .div-line{flex:1;height:1px;background:linear-gradient(to right,transparent,#b8962e 30%,#b8962e 70%,transparent)}
    .div-ornament{font-size:20px;color:#b8962e;line-height:1}
    .presented-to{font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#888;margin-bottom:12px}
    .recipient-name{font-family:'Cormorant Garamond',serif;font-size:54px;font-style:italic;font-weight:600;color:#1a1a2e;position:relative;display:inline-block;margin-bottom:8px;padding-bottom:12px}
    .recipient-name::after{content:'';position:absolute;bottom:0;left:10%;right:10%;height:2px;background:linear-gradient(to right,transparent,#b8962e,transparent)}
    .completion-text{font-size:14px;color:#555;line-height:1.9;margin:20px auto 10px;max-width:540px}
    .course-name{font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:700;color:#1a1a2e;margin:8px 0 20px;letter-spacing:1px}
    .score-badge{display:inline-block;border:1.5px solid #b8962e;color:#7a5c00;font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;padding:7px 32px;border-radius:2px;background:linear-gradient(to right,#fffdf5,#fff9e8,#fffdf5);margin-bottom:36px}
    .sig-section{display:flex;justify-content:space-between;align-items:flex-end;padding:0 24px;gap:20px}
    .sig-block{text-align:center;flex:1}
    .sig-value{font-size:12px;color:#333;margin-bottom:4px;font-weight:500}
    .sig-label{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#aaa}
    .seal-wrap{display:flex;flex-direction:column;align-items:center;flex:0 0 auto}
    .seal{width:88px;height:88px;border-radius:50%;border:2.5px solid #b8962e;outline:1px solid #d4af4e;outline-offset:4px;background:radial-gradient(circle at 35% 35%,#fffdf5 60%,#fff3c4);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
    .seal-star{font-size:18px;line-height:1}
    .seal-text{font-family:'Cinzel',serif;font-size:7.5px;letter-spacing:1px;text-transform:uppercase;color:#7a5c00;text-align:center;line-height:1.4}
  </style>
</head>
<body>
  <div class="certificate">
    <div class="top-banner"></div><div class="bottom-banner"></div>
    <div class="frame"></div><div class="watermark">CERTIFIED</div>
    <div class="content">
      <div class="org-badge">
        <div class="badge-line"></div>
        <div class="org-name">ThinkSurf Media Academy</div>
        <div class="badge-line badge-line-r"></div>
      </div>
      <div class="cert-of">Certificate</div>
      <div class="cert-title">OF COMPLETION</div>
      <div class="divider"><div class="div-line"></div><div class="div-ornament">&#10022;</div><div class="div-line"></div></div>
      <div class="presented-to">This Certificate is Proudly Presented To</div>
      <div class="recipient-name">{{name}}</div>
      <p class="completion-text">has successfully completed the following course with excellence,<br/>demonstrating outstanding commitment and mastery of all subject matter in</p>
      <div class="course-name">{{course}}</div>
      <div class="score-badge">Score Achieved: {{marks}}</div>
      <div class="sig-section">
        <div class="sig-block"><div class="sig-value">________________</div><div class="sig-label">Date of Issue</div></div>
        <div class="seal-wrap"><div class="seal"><div class="seal-star">&#9733;</div><div class="seal-text">Official<br/>Seal</div></div></div>
        <div class="sig-block"><div class="sig-value">________________</div><div class="sig-label">Authorized Signature</div></div>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    title: 'Modern Teal',
    desc: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Certificate</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;800&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#f0f4f8;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;padding:40px 20px}
    .cert{width:860px;background:#fff;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.15);overflow:hidden}
    .header{background:linear-gradient(135deg,#0b7b7b 0%,#0d9d9d 60%,#0b7b7b 100%);padding:48px 60px 36px;position:relative;overflow:hidden}
    .header::before,.header::after{content:'';position:absolute;border-radius:50%;background:rgba(255,255,255,.08)}
    .header::before{width:200px;height:200px;top:-60px;right:60px}
    .header::after{width:120px;height:120px;top:10px;right:220px}
    .header-tag{font-size:11px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:10px}
    .header-title{font-family:'Playfair Display',serif;font-size:48px;font-style:italic;color:#fff;font-weight:700;line-height:1.1;margin-bottom:6px}
    .header-sub{font-size:12px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.75)}
    .header-wave{position:absolute;bottom:-1px;left:0;right:0;height:40px;background:#fff;clip-path:ellipse(55% 100% at 50% 100%)}
    .body{padding:24px 60px 50px}
    .label{font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#9ca3af;margin-bottom:10px}
    .recipient{font-family:'Playfair Display',serif;font-size:46px;font-style:italic;font-weight:700;color:#111827;margin-bottom:8px;border-bottom:3px solid #0b7b7b;padding-bottom:12px;display:inline-block}
    .desc{font-size:14px;color:#6b7280;line-height:1.8;margin:24px 0 10px;max-width:580px}
    .course-name{font-size:22px;font-weight:700;color:#0b7b7b;margin-bottom:6px}
    .score{display:inline-block;background:#f0fdf4;border:1.5px solid #0b7b7b;color:#065f46;font-size:13px;font-weight:600;letter-spacing:2px;padding:8px 28px;border-radius:999px;margin-top:12px;margin-bottom:36px}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e5e7eb;padding-top:24px;margin-top:8px}
    .sig{text-align:center}
    .sig-line{width:140px;border-top:1.5px solid #374151;margin:0 auto 6px}
    .sig-label{font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#9ca3af}
    .badge{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#0b7b7b,#0d9d9d);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 12px rgba(11,123,123,.4)}
    .badge-star{font-size:22px;line-height:1}
    .badge-txt{font-size:7px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;line-height:1.3}
  </style>
</head>
<body>
  <div class="cert">
    <div class="header">
      <div class="header-tag">Certificate of Achievement</div>
      <div class="header-title">This is to Certify</div>
      <div class="header-sub">with excellence and distinction</div>
      <div class="header-wave"></div>
    </div>
    <div class="body">
      <div class="label">Proudly presented to</div>
      <div><span class="recipient">{{name}}</span></div>
      <p class="desc">has successfully demonstrated outstanding commitment and mastery upon completing the course</p>
      <div class="course-name">{{course}}</div>
      <div class="score">Score: {{marks}}</div>
      <div class="footer">
        <div class="sig"><div class="sig-line"></div><div class="sig-label">Date of Issue</div></div>
        <div class="badge"><div class="badge-star">&#9733;</div><div class="badge-txt">Official<br/>Seal</div></div>
        <div class="sig"><div class="sig-line"></div><div class="sig-label">Authorized Signature</div></div>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    title: 'Royal Purple',
    desc: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Certificate</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0d0d1a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 20px}
    .cert{width:880px;background:linear-gradient(145deg,#1a0a2e 0%,#0d0620 100%);position:relative;padding:60px 72px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
    .corner{position:absolute;width:80px;height:80px}
    .corner::before,.corner::after{content:'';position:absolute;background:#c9a227}
    .corner-tl{top:16px;left:16px}.corner-tl::before{width:40px;height:2px;top:0;left:0}.corner-tl::after{width:2px;height:40px;top:0;left:0}
    .corner-tr{top:16px;right:16px}.corner-tr::before{width:40px;height:2px;top:0;right:0}.corner-tr::after{width:2px;height:40px;top:0;right:0}
    .corner-bl{bottom:16px;left:16px}.corner-bl::before{width:40px;height:2px;bottom:0;left:0}.corner-bl::after{width:2px;height:40px;bottom:0;left:0}
    .corner-br{bottom:16px;right:16px}.corner-br::before{width:40px;height:2px;bottom:0;right:0}.corner-br::after{width:2px;height:40px;bottom:0;right:0}
    .inner-border{position:absolute;inset:24px;border:1px solid rgba(201,162,39,.3);pointer-events:none}
    .content{position:relative;z-index:1;text-align:center}
    .crown{font-size:36px;margin-bottom:12px}
    .org{font-family:'Cinzel Decorative',serif;font-size:11px;letter-spacing:5px;text-transform:uppercase;color:#c9a227;margin-bottom:20px}
    .divider{display:flex;align-items:center;gap:10px;justify-content:center;margin:0 auto 20px}
    .div-line{flex:1;max-width:120px;height:1px;background:linear-gradient(to right,transparent,#c9a227,transparent)}
    .div-ornament{color:#c9a227;font-size:18px}
    .cert-title{font-family:'Cinzel Decorative',serif;font-size:32px;color:#fff;font-weight:700;letter-spacing:2px;margin-bottom:24px;text-shadow:0 0 40px rgba(201,162,39,.3)}
    .presented{font-size:11px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:12px}
    .name{font-family:'EB Garamond',serif;font-size:52px;font-style:italic;color:#c9a227;margin-bottom:20px;line-height:1.1}
    .completion{font-family:'EB Garamond',serif;font-size:15px;color:rgba(255,255,255,.7);line-height:1.8;margin-bottom:10px}
    .course{font-family:'EB Garamond',serif;font-size:28px;font-weight:600;color:#e8d5a3;margin-bottom:16px}
    .score{display:inline-block;border:1px solid rgba(201,162,39,.5);color:#c9a227;font-size:12px;letter-spacing:3px;text-transform:uppercase;padding:8px 32px;font-family:'Cinzel Decorative',serif;margin-bottom:32px}
    .sigs{display:flex;justify-content:space-between;padding:0 20px}
    .sig{text-align:center}
    .sig-line{width:130px;border-top:1px solid rgba(255,255,255,.25);margin:0 auto 6px}
    .sig-label{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.4)}
    .seal{width:80px;height:80px;border-radius:50%;border:2px solid #c9a227;background:radial-gradient(circle,rgba(201,162,39,.15),transparent);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#c9a227}
    .seal-star{font-size:24px}
    .seal-text{font-size:7px;letter-spacing:1px;text-transform:uppercase}
  </style>
</head>
<body>
  <div class="cert">
    <div class="corner corner-tl"></div><div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div><div class="corner corner-br"></div>
    <div class="inner-border"></div>
    <div class="content">
      <div class="crown">&#9819;</div>
      <div class="org">ThinkSurf Media Academy</div>
      <div class="divider"><div class="div-line"></div><div class="div-ornament">&#10022;</div><div class="div-line"></div></div>
      <div class="cert-title">Certificate of Excellence</div>
      <div class="presented">This certificate is proudly presented to</div>
      <div class="name">{{name}}</div>
      <p class="completion">for demonstrating exceptional mastery and dedication<br/>upon successfully completing</p>
      <div class="course">{{course}}</div>
      <div class="score">Achievement Score: {{marks}}</div>
      <div class="sigs">
        <div class="sig"><div class="sig-line"></div><div class="sig-label">Date of Issue</div></div>
        <div class="seal"><div class="seal-star">&#9733;</div><div class="seal-text">Verified</div></div>
        <div class="sig"><div class="sig-line"></div><div class="sig-label">Authorized Signature</div></div>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    title: 'Corporate Blue',
    desc: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Certificate</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:ital,wght@0,700;1,400&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#e8edf4;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;padding:40px 20px}
    .cert{width:850px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.15);display:flex;flex-direction:column;overflow:hidden}
    .header{background:linear-gradient(135deg,#1e40af 0%,#1d4ed8 50%,#2563eb 100%);padding:36px 56px;display:flex;align-items:center;justify-content:space-between}
    .header-badge{font-size:10px;font-weight:600;letter-spacing:5px;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:8px}
    .header-name{font-size:28px;font-weight:700;color:#fff}
    .header-right{width:72px;height:72px;border-radius:50%;border:2.5px solid rgba(255,255,255,.4);display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,.1)}
    .header-star{font-size:28px;color:#fbbf24}
    .accent-bar{height:4px;background:linear-gradient(to right,#1d4ed8,#60a5fa,#1d4ed8)}
    .body{padding:44px 56px 48px}
    .body-label{font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#9ca3af;margin-bottom:12px}
    .recipient-name{font-family:'Merriweather',serif;font-size:42px;font-style:italic;color:#1e293b;margin-bottom:6px;padding-bottom:12px;border-bottom:2px solid #e2e8f0}
    .body-text{font-size:14px;color:#64748b;line-height:1.9;margin:20px 0 8px;max-width:560px}
    .course-title{font-size:20px;font-weight:700;color:#1e40af;margin-bottom:4px}
    .score-badge{display:inline-flex;align-items:center;gap:6px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;letter-spacing:1px;margin-top:14px;margin-bottom:36px}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:24px;border-top:1px solid #f1f5f9}
    .sig{text-align:center}
    .sig-line{width:130px;border-top:1.5px solid #cbd5e1;margin:0 auto 6px}
    .sig-label{font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#94a3b8}
    .corp-seal{width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#1e40af,#3b82f6);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 12px rgba(30,64,175,.35)}
    .corp-seal-icon{font-size:20px}
    .corp-seal-text{font-size:7px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
  </style>
</head>
<body>
  <div class="cert">
    <div class="header">
      <div>
        <div class="header-badge">Certificate of Completion</div>
        <div class="header-name">ThinkSurf Media Academy</div>
      </div>
      <div class="header-right"><div class="header-star">&#9733;</div></div>
    </div>
    <div class="accent-bar"></div>
    <div class="body">
      <div class="body-label">This certificate is awarded to</div>
      <div class="recipient-name">{{name}}</div>
      <p class="body-text">for successfully completing the following professional<br/>development course with exceptional performance</p>
      <div class="course-title">{{course}}</div>
      <div class="score-badge"><span>&#128202;</span><span>Score Achieved: {{marks}}</span></div>
      <div class="footer">
        <div class="sig"><div class="sig-line"></div><div class="sig-label">Date of Issue</div></div>
        <div class="corp-seal"><div class="corp-seal-icon">&#10003;</div><div class="corp-seal-text">Verified</div></div>
        <div class="sig"><div class="sig-line"></div><div class="sig-label">Director's Signature</div></div>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    title: 'Minimalist Dark',
    desc: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Certificate</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Libre+Baskerville:ital,wght@1,700&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#111;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;padding:40px 20px}
    .cert{width:840px;background:#1a1a1a;position:relative;padding:64px 72px;box-shadow:0 40px 100px rgba(0,0,0,.5)}
    .left-bar{position:absolute;left:0;top:0;bottom:0;width:6px;background:linear-gradient(to bottom,#e2e8f0,#64748b,#e2e8f0)}
    .tag{font-size:10px;font-weight:600;letter-spacing:6px;text-transform:uppercase;color:#64748b;margin-bottom:36px}
    .big-title{font-size:14px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}
    .name{font-family:'Libre Baskerville',serif;font-size:56px;font-style:italic;color:#f8fafc;line-height:1.1;margin-bottom:32px}
    .rule{height:1px;background:#2d3748;margin-bottom:28px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:40px}
    .info-label{font-size:9px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#475569;margin-bottom:6px}
    .info-value{font-size:16px;font-weight:600;color:#e2e8f0}
    .info-value.muted{color:#94a3b8;font-size:14px;font-weight:400}
    .bottom{display:flex;justify-content:space-between;align-items:flex-end;padding-top:24px;border-top:1px solid #2d3748}
    .sig-label{font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#475569;margin-bottom:6px}
    .sig-line{width:120px;border-top:1px solid #334155;margin-top:20px}
    .badge{width:64px;height:64px;border-radius:50%;border:1px solid #334155;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8}
    .badge-icon{font-size:20px}
    .badge-text{font-size:7px;letter-spacing:1px;text-transform:uppercase;color:#475569}
  </style>
</head>
<body>
  <div class="cert">
    <div class="left-bar"></div>
    <div class="tag">ThinkSurf Media Academy</div>
    <div class="big-title">Certificate of Completion</div>
    <div class="name">{{name}}</div>
    <div class="rule"></div>
    <div class="info-grid">
      <div>
        <div class="info-label">Course Completed</div>
        <div class="info-value">{{course}}</div>
      </div>
      <div>
        <div class="info-label">Score Achieved</div>
        <div class="info-value muted">{{marks}}</div>
      </div>
    </div>
    <div class="bottom">
      <div><div class="sig-label">Date of Issue</div><div class="sig-line"></div></div>
      <div class="badge"><div class="badge-icon">&#9670;</div><div class="badge-text">Sealed</div></div>
      <div><div class="sig-label">Authorized Signature</div><div class="sig-line"></div></div>
    </div>
  </div>
</body>
</html>`,
  },
];

export default function CertificateTemplatesList() {
  const router = useRouter();

  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [debounced, setDebounced]   = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected]     = useState([]);
  const [confirm, setConfirm]       = useState({ show: false, id: null });
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [seeding, setSeeding]       = useState(false);
  const [sortKey, setSortKey]       = useState('');
  const [sortDir, setSortDir]       = useState('asc');
  const [previewTpl, setPreviewTpl] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debounced]);

  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    apiServiceHandler('GET', `certificate-template/list-pagination?${params}`)
      .then(res => {
        let data = Array.isArray(res?.data) ? res.data : [];
        if (debounced) {
          const q = debounced.toLowerCase();
          data = data.filter(r =>
            (r.title ?? '').toLowerCase().includes(q)
          );
        }
        setRows(data);
        setTotal(res?.total ?? 0);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, debounced]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function handleDelete(id) { setConfirm({ show: true, id }); }
  function doDelete() {
    const id = confirm.id;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `certificate-template/delete/${id}`)
      .then(() => { toast.error('Certificate template deleted.'); fetchRows(); })
      .catch(() => toast.warning('Delete failed'));
  }

  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `certificate-template/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} template${ids.length !== 1 ? 's' : ''} deleted.`); fetchRows(); })
      .catch(() => toast.warning('Some deletes failed'));
  }

  const allIds = rows.map(r => r._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = id => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  async function seedTemplates() {
    setSeeding(true);
    let created = 0;
    for (const tpl of SEED_TEMPLATES) {
      try {
        await apiServiceHandler('POST', 'certificate-template/create', {
          title: tpl.title,
          desc: tpl.desc,
          status: 'active',
        });
        created++;
      } catch {
        // skip duplicates or failures silently
      }
    }
    setSeeding(false);
    if (created > 0) {
      toast.success(`${created} template${created !== 1 ? 's' : ''} seeded successfully.`);
      fetchRows();
    } else {
      toast.warning('No templates were created. They may already exist.');
    }
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const isDate = ['createdAt', 'updatedAt', 'purchase_date', 'payment_date'].includes(sortKey);
        let av = a[sortKey] ?? ''; let bv = b[sortKey] ?? '';
        if (isDate) { av = new Date(av).getTime() || 0; bv = new Date(bv).getTime() || 0; }
        else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : rows;

  return (
    <SuperAdminShell activeSection="certificate-template">
      <ConfirmModal
        show={confirm.show}
        title="Delete Certificate Template"
        message="Are you sure you want to delete this certificate template? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Templates"
        message={`Delete ${selected.length} selected template${selected.length !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Certificate Templates</h1>
          <p className={s.pageSubtitle}>Manage certificate templates</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={s.btnSeed} onClick={seedTemplates} disabled={seeding}>
            {seeding ? 'Seeding…' : 'Seed Templates'}
          </button>
          <button className={s.btnAdd} onClick={() => router.push('/superadmin/certificate-template/add')}>
            <PlusIcon />
            Add Template
          </button>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.searchWrap}>
          {Icon.search}
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search by title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('title')}>Title{sortArrow('title')}</th>
                <th>Template</th>
                <th>Status</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('createdAt')}>Created At{sortArrow('createdAt')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={6} />
              ) : rows.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={6}><EmptyState>No certificate templates found.</EmptyState></td></tr>
              ) : sorted.map(row => (
                <tr key={row._id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(row._id)}>
                  <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(row._id)}
                      onChange={() => toggleOne(row._id)}
                    />
                  </td>
                  <td>
                    <div className={s.nameCell}>
                      <span className={s.certName}>{orDash(row.title)}</span>
                    </div>
                  </td>
                  <td className={s.descCell} onClick={e => e.stopPropagation()}>
                    <TemplateThumb html={row.desc} onClick={() => setPreviewTpl(row)} />
                  </td>
                  <td>
                    {row.status === 'active'
                      ? <span className={s.badgeActive}>Active</span>
                      : <span className={s.badgeInactive}>{row.status ?? 'Inactive'}</span>
                    }
                  </td>
                  <td>{fmtDate(row.createdAt)}</td>
                  <td>
                    <div className={s.actions} onClick={e => e.stopPropagation()}>
                      <button data-action="view" className={s.btnView} title="View"
                        onClick={() => router.push(`/superadmin/certificate-template/${row._id}`)}>
                        {Icon.eye}
                      </button>
                      <button data-action="edit" className={s.btnEdit} title="Edit"
                        onClick={() => router.push(`/superadmin/certificate-template/${row._id}/edit`)}>
                        {Icon.edit}
                      </button>
                      <button data-action="delete" className={s.btnDelete} title="Delete"
                        onClick={() => handleDelete(row._id)}>
                        {Icon.trash}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={s.tableFooter}>
          <div className={s.footerLeft}>
            {selected.length > 0 && (
              <button data-bulk-action="delete" className={s.btnBulkDelete} onClick={handleBulkDelete}>
                <TrashIcon />
                Delete Selected ({selected.length})
              </button>
            )}
            <span>
              <ResultCount from={from} to={to} total={total} singular="template" plural="templates" />
            </span>
          </div>
          <div className={s.pagination}>
            <button className={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </button>
            {pageItems(page, totalPages).map(p => typeof p !== 'number' ? <PageGap key={p} /> : (
              <button
                key={p}
                className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button className={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>

      {previewTpl && (
        <div className={s.previewOverlay} onClick={() => setPreviewTpl(null)}>
          <div className={s.previewTopBar} onClick={e => e.stopPropagation()}>
            <span className={s.previewTopTitle}>Certificate Preview — {previewTpl.title || 'Untitled'}</span>
            <button className={s.btnHide} onClick={() => setPreviewTpl(null)}>
              Close
            </button>
          </div>
          <iframe
            className={s.previewFrame}
            srcDoc={previewTpl.desc}
            title="Certificate Preview"
            sandbox="allow-same-origin"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </SuperAdminShell>
  );
}
