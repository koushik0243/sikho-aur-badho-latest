'use client';
import { useState, useEffect } from 'react';
import apiServiceHandler from '../service/apiService';
import { API_URL } from './constant';

// Course content under /uploads (lesson videos/images, assignments, intro
// videos) is only served with a short-lived media token — see
// server/middleware/mediaAuth.js. This fetches and caches that token, refreshes
// it before it expires, and adds it to file URLs.

const REFRESH_EARLY_MS = 5 * 60 * 1000; // refresh 5 min before expiry
const RETRY_MIN_MS = 2 * 1000;          // a failed token request is retried, backing off…
const RETRY_MAX_MS = 30 * 1000;         // …up to this interval
// The API server predates media tokens (no /media/token route) — it serves
// /uploads publicly, so files are used without a token rather than not at all.
export const NO_MEDIA_TOKEN = 'none';

let cached = null;    // { token, expiresAt }
let inflight = null;  // Promise<string|null>

/**
 * @returns {Promise<string|null>} a valid media token, NO_MEDIA_TOKEN when the
 *   server doesn't use them, or null if it couldn't be fetched (not logged in,
 *   network/server error) — callers retry.
 */
export async function getMediaToken() {
  if (cached && cached.expiresAt - Date.now() > REFRESH_EARLY_MS) return cached.token;
  if (!inflight) {
    // Timestamp defeats apiServiceHandler's 60s GET cache.
    inflight = apiServiceHandler('GET', `media/token?t=${Date.now()}`)
      .then(res => {
        const data = res?.data ?? {};
        if (!data.token) return null;
        cached = { token: data.token, expiresAt: Date.now() + (Number(data.expiresIn) || 0) * 1000 };
        return data.token;
      })
      .catch(err => {
        // GET errors arrive as the raw axios error (status on err.response).
        if ((err?.statusCode ?? err?.response?.status) !== 404) return null;
        cached = { token: NO_MEDIA_TOKEN, expiresAt: Date.now() + 60 * 60 * 1000 };
        return NO_MEDIA_TOKEN;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Forget the cached token (e.g. on logout). */
export function clearMediaToken() { cached = null; }

/**
 * Full URL for an uploaded file, with the media token added for /uploads paths.
 * Returns null when there's no path, or while a protected file's token is still loading.
 * @param {string|null|undefined} filePath  e.g. "/uploads/lesson-videos/123.mp4" or an absolute URL
 * @param {string|null} token
 */
export function secureMediaUrl(filePath, token) {
  if (!filePath) return null;
  const isExternal = /^https?:\/\//i.test(filePath) && !filePath.startsWith(API_URL);
  if (isExternal) return filePath;
  const full = filePath.startsWith('http') ? filePath : `${API_URL}${filePath}`;
  if (!full.includes('/uploads/')) return full;
  if (!token) return null;
  if (token === NO_MEDIA_TOKEN) return full;
  return `${full}${full.includes('?') ? '&' : '?'}mt=${encodeURIComponent(token)}`;
}

/**
 * React hook: [token, refresh]. token is null until loaded and is kept fresh;
 * refresh() forces a new one (e.g. after a long-open video's token expired).
 */
export function useMediaToken() {
  const [token, setToken] = useState(() => (cached && cached.expiresAt - Date.now() > REFRESH_EARLY_MS ? cached.token : null));

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let retryMs = RETRY_MIN_MS;
    const load = async () => {
      const t = await getMediaToken();
      if (cancelled) return;
      if (!t) {
        // Keep the last good token (if any) and try again — one failed request
        // must not leave videos blank until the page is reloaded.
        timer = setTimeout(load, retryMs);
        retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
        return;
      }
      retryMs = RETRY_MIN_MS;
      setToken(t);
      if (cached) {
        const wait = Math.max(30 * 1000, cached.expiresAt - Date.now() - REFRESH_EARLY_MS);
        timer = setTimeout(load, wait);
      }
    };
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  const refresh = async () => {
    clearMediaToken();
    const t = await getMediaToken();
    setToken(t);
    return t;
  };

  return [token, refresh];
}

/**
 * Opens an uploaded file (e.g. a lesson video) in a new tab with a fresh media
 * token. The tab is opened straight away — inside the click — so popup
 * blockers allow it, then pointed at the file once the token is ready.
 * @param {string} filePath e.g. "/uploads/lesson-videos/123.mp4"
 * @returns {Promise<boolean>} false if the file couldn't be opened
 */
export async function openMediaInNewTab(filePath) {
  const tab = window.open('', '_blank');
  if (!tab) return false;
  tab.opener = null;
  try { tab.document.title = 'Loading…'; } catch { /* cross-origin already */ }
  const url = secureMediaUrl(filePath, await getMediaToken());
  if (!url) { tab.close(); return false; }
  tab.location.replace(url);
  return true;
}

/**
 * Downloads an uploaded file (e.g. an assignment) instead of opening it. The
 * API is on another origin, where <a download> is ignored, so the file is
 * fetched and saved from a blob URL. Falls back to opening it in a new tab.
 * @param {string} filePath e.g. "/uploads/assignments/123.pdf"
 * @param {string} [fileName] name to save as (defaults to the file's name)
 */
export async function downloadMedia(filePath, fileName) {
  if (!filePath) return;
  const url = secureMediaUrl(filePath, await getMediaToken())
    || (filePath.startsWith('http') ? filePath : `${API_URL}${filePath}`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || filePath.split('/').pop().split('?')[0] || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
