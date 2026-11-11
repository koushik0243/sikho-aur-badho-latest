import axios from 'axios';
import { API_URL } from './constant';
import { getAuthToken, clearGetCache } from '../service/apiService';
import { getMediaToken, NO_MEDIA_TOKEN } from './mediaToken';
import { MAX_VIDEO_BYTES, MAX_VIDEO_LABEL, VIDEO_ACCEPT, VIDEO_UPLOAD_NOTE, videoFileProblem } from './videoUpload';

// Homework submissions: the learner uploads a video of the finished assignment
// (the app-wide rule, lib/videoUpload.js: MP4, WebM, MOV, AVI or MKV, up to 2 GB);
// the learner, super admins and the learner's store owner can play it back. Videos are
// streamed from the API with a short-lived media token (never a public URL), so even a
// 2 GB video starts at once and can be seeked.

export const MAX_SUBMISSION_BYTES = MAX_VIDEO_BYTES;
export const MAX_SUBMISSION_LABEL = MAX_VIDEO_LABEL;
export const SUBMISSION_UPLOAD_NOTE = VIDEO_UPLOAD_NOTE;
export const MAX_VIDEOS_PER_ASSIGNMENT = 50;     // the highest "How many videos can upload?" allowed
export const DEFAULT_VIDEOS_PER_ASSIGNMENT = 10; // the field's default (and for assignments saved before it existed)

/** The most videos a learner can ever upload for an assignment ("How many videos can upload?"). */
export const videoLimitOf = (topic) => {
  const n = Number(topic?.maxVideos);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_VIDEOS_PER_ASSIGNMENT) : DEFAULT_VIDEOS_PER_ASSIGNMENT;
};
export const SUBMISSION_ACCEPT = VIDEO_ACCEPT;

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * BYTES_PER_MB;

/** "640 KB", "12.4 MB", "1.35 GB" */
export function formatBytes(n) {
  if (!n && n !== 0) return '—';
  if (n < BYTES_PER_MB) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < BYTES_PER_GB) return `${(n / BYTES_PER_MB).toFixed(1)} MB`;
  return `${(n / BYTES_PER_GB).toFixed(2)} GB`;
}

/** A video's reviewer comments, oldest first (older data has only a single `comment`). */
export const videoComments = (video) => (Array.isArray(video?.comments) && video.comments.length
  ? video.comments
  : (video?.comment && (video.comment.note || video.comment.status) ? [video.comment] : []));

/** "15-10-2026" */
export function formatDayDate(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${String(x.getDate()).padStart(2, '0')}-${String(x.getMonth() + 1).padStart(2, '0')}-${x.getFullYear()}`;
}

/** Why this file can't be submitted, or '' when it's fine. */
export function checkSubmissionFile(file) {
  if (file && file.size > MAX_SUBMISSION_BYTES) {
    return `This video is ${formatBytes(file.size)} — it must be ${MAX_SUBMISSION_LABEL} or smaller.`;
  }
  return videoFileProblem(file);
}

/**
 * Uploads the learner's video and marks the homework done.
 * @returns {Promise<object>} the saved record ({ _id, topicId, submission })
 */
export async function uploadAssignmentVideo({ courseId, topicId, file, onProgress, signal }) {
  const form = new FormData();
  form.append('courseId', courseId);
  form.append('topicId', topicId);
  form.append('video', file);
  try {
    const res = await axios.post(`${API_URL}/topic-activity/assignment-submit`, form, {
      headers: authHeaders(),
      signal,
      onUploadProgress: e => { if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100)); },
    });
    clearGetCache();
    return res.data?.data;
  } catch (err) {
    throw new Error(err?.response?.data?.message || 'Upload failed. Please try again.');
  }
}

/**
 * The URL to play video `n` (1-based; default the latest) of a submission — streamed, so a
 * 2 GB video starts at once and can be seeked. Checks access first (fetching one byte) so a
 * video that is still being prepared, or not allowed, shows its message instead of a broken
 * player. Callers may still pass the result to URL.revokeObjectURL (a no-op for this URL).
 */
export async function loadSubmissionVideo(id, n) {
  const base = `${API_URL}/topic-activity/submissions/${id}/video`;
  const v = Number.isInteger(n) && n > 0 ? `v=${n}` : '';
  const res = await fetch(`${base}${v ? `?${v}` : ''}`, { headers: { ...authHeaders(), Range: 'bytes=0-0' } });
  if (!res.ok) {
    let message = 'Could not load the video.';
    try { message = (await res.json()).message || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  res.body?.cancel?.().catch(() => {}); // only the access check was needed
  const mt = await getMediaToken();
  if (!mt || mt === NO_MEDIA_TOKEN) throw new Error('Could not load the video. Please refresh the page and try again.');
  const params = [v, `mt=${encodeURIComponent(mt)}`].filter(Boolean).join('&');
  return `${base}?${params}`;
}

/**
 * onPlay handler: pause every other video in the same list (the nearest <ul>),
 * so only one submission video plays at a time.
 */
export function pauseOtherVideos(e) {
  const current = e.currentTarget;
  const list = current.closest('ul') || document;
  list.querySelectorAll('video').forEach(v => { if (v !== current && !v.paused) v.pause(); });
}
