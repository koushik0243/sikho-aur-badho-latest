// Makes uploaded course videos playable in every browser.
//
// Uploads may be MP4, WebM, MOV, AVI or MKV, but browsers only reliably play
// H.264/AV1 in MP4 and VP8/VP9/AV1 in WebM. Each upload is probed with ffmpeg:
//   • already browser-safe          → kept as is ("ready" straight away)
//   • H.264 in another container    → repackaged into MP4 (fast, no quality loss)
//   • anything else (HEVC, MPEG-4…) → re-encoded to H.264/AAC MP4
// Conversion runs in the background; the record's status field is "processing"
// until the MP4 replaces the original, then "ready" (or "failed").
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import ffmpegPath from 'ffmpeg-static';
import { createJobQueue } from './jobQueue.js';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const PROBE_TIMEOUT_MS = 60 * 1000;
const CONVERT_TIMEOUT_MS = 4 * 60 * 60 * 1000; // a 2 GB re-encode can take a while
const STDERR_LIMIT = 20000;
// One conversion at a time: a re-encode already uses every CPU core.
const runConversion = createJobQueue(1);

export const VIDEO_STATUSES = ['processing', 'ready', 'failed'];

// The one rule for every video upload in the app (lesson, course intro, assignment
// submission): "MP4, WebM, MOV, AVI, and MKV formats, up to 2 GB". Must match the
// client (client/src/lib/videoUpload.js). Checked by extension: browsers often send an
// empty or generic type for .mkv/.avi.
export const ALLOWED_VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
export const ALLOWED_VIDEO_FORMATS_LABEL = 'MP4, WebM, MOV, AVI, and MKV';
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_VIDEO_LABEL = '2 GB';

export const isAllowedVideoName = (name) =>
  ALLOWED_VIDEO_EXTS.includes(path.extname(String(name || '')).toLowerCase());

/**
 * True for a path that points into /uploads, however it is spelled (extra or back
 * slashes, any letter case). Such paths may only come from a real upload, never from text.
 */
export function isLocalUploadPath(value) {
  return typeof value === 'string' && /^uploads[\\/]/i.test(value.trim().replace(/^[\\/]+/, ''));
}

/** Absolute path of a file under public/uploads, or null if it isn't a local, existing upload. */
export function resolveUploadPath(fileUrl) {
  if (typeof fileUrl !== 'string') return null;
  const relPath = fileUrl.replace(/^\/+/, '');
  if (!relPath.startsWith('uploads/')) return null; // external URL (YouTube, Vimeo, …)
  const fullPath = path.resolve(PUBLIC_DIR, relPath);
  if (!fullPath.startsWith(PUBLIC_DIR + path.sep)) return null; // path traversal
  return fs.existsSync(fullPath) ? fullPath : null;
}

function runFfmpeg(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
    proc.stderr.on('data', (chunk) => {
      if (stderr.length < STDERR_LIMIT) stderr += chunk.toString();
    });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stderr });
    });
  });
}

const firstWord = (s) => (s || '').trim().split(/[\s,(]/)[0].toLowerCase();

/** Codecs of the first video and audio streams ({ videoCodec, pixFmt, audioCodec }; '' when absent). */
export async function probeVideo(filePath) {
  // With no output file, ffmpeg prints the stream list to stderr and exits with an error.
  const { stderr } = await runFfmpeg(['-hide_banner', '-nostdin', '-i', filePath], PROBE_TIMEOUT_MS);
  if (/Invalid data found|could not find codec parameters|moov atom not found/i.test(stderr)) {
    throw new Error('This file could not be read as a video.');
  }
  const streams = stderr.split('\n').filter(l => /Stream #\d+:\d+/.test(l));
  const videoLine = streams.find(l => /: Video: /.test(l) && !/attached pic/i.test(l)) || '';
  const audioLine = streams.find(l => /: Audio: /.test(l)) || '';
  if (!videoLine && !audioLine) throw new Error('This file could not be read as a video.');
  const videoInfo = videoLine.split(': Video: ')[1] || '';
  return {
    videoCodec: firstWord(videoInfo),
    pixFmt: (videoInfo.match(/\b(yuvj?\d{3}p\w*|nv12|p010\w*|gray\w*|rgb\w*|bgr\w*)\b/) || [])[1] || '',
    audioCodec: firstWord(audioLine.split(': Audio: ')[1]),
  };
}

const MP4_AUDIO = new Set(['', 'aac', 'mp3']);
const WEBM_AUDIO = new Set(['', 'opus', 'vorbis']);
const isWebH264 = ({ videoCodec, pixFmt }) => videoCodec === 'h264' && /^yuvj?420p$/.test(pixFmt);

/** 'none' | 'remux' | 'remux-audio' | 'transcode' — what it takes to make the file browser-safe. */
export function planConversion(ext, probe) {
  const { videoCodec, audioCodec } = probe;
  const e = ext.toLowerCase();
  if ((e === '.mp4' || e === '.m4v') && (isWebH264(probe) || videoCodec === 'av1') && MP4_AUDIO.has(audioCodec)) return 'none';
  if (e === '.webm' && ['vp8', 'vp9', 'av1'].includes(videoCodec) && WEBM_AUDIO.has(audioCodec)) return 'none';
  if (isWebH264(probe)) return MP4_AUDIO.has(audioCodec) ? 'remux' : 'remux-audio';
  return 'transcode';
}

const CODEC_ARGS = {
  remux: ['-c:v', 'copy', '-c:a', 'copy'],
  'remux-audio': ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k'],
  transcode: [
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // H.264 needs even dimensions
    '-c:a', 'aac', '-b:a', '128k',
  ],
};

async function convertToMp4(src, dest, plan) {
  const { code, signal, stderr } = await runFfmpeg([
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', src,
    // 'V' = real video streams only, skipping cover art / attached pictures.
    '-map', '0:V:0?', '-map', '0:a:0?', '-sn', '-dn',
    ...CODEC_ARGS[plan],
    '-movflags', '+faststart', // lets playback start before the whole file downloads
    '-f', 'mp4', dest,
  ], CONVERT_TIMEOUT_MS);
  if (code === 0) return;
  if (signal) throw new Error('Converting the video took too long.');
  throw new Error(`Could not convert the video: ${stderr.trim().split('\n').pop() || `ffmpeg exited with code ${code}`}`);
}

/**
 * Checks a just-uploaded video. Resolves to 'ready' (already plays everywhere) or
 * 'processing' (needs converting — call queueVideoConversion after saving).
 * Throws when the file isn't a readable video.
 */
export async function initialVideoStatus(filePath) {
  const plan = planConversion(path.extname(filePath), await probeVideo(filePath));
  return plan === 'none' ? 'ready' : 'processing';
}

const inFlight = new Set();

/**
 * Converts `src` to a browser-safe MP4 next to it (when needed), then calls
 * save(destPath | null) to point the record at it; save resolves to false when the
 * record no longer references `src`. Deletes whichever file ends up unreferenced.
 * Resolves to true when the record now points at a playable video.
 */
async function convertAndSwap(src, save) {
  const plan = planConversion(path.extname(src), await probeVideo(src));
  let dest = null;
  if (plan !== 'none') {
    const base = path.basename(src, path.extname(src));
    dest = path.join(path.dirname(src), `${base}${path.extname(src).toLowerCase() === '.mp4' ? '-web' : ''}.mp4`);
    const partial = `${dest}.part`;
    try {
      await convertToMp4(src, partial, plan);
      await fsp.rename(partial, dest);
    } finally {
      await fsp.rm(partial, { force: true }).catch(() => {});
    }
  }

  let matched;
  try {
    matched = await save(dest);
  } catch (err) {
    if (dest) await fsp.rm(dest, { force: true }).catch(() => {}); // the original stays in use
    throw err;
  }
  if (!matched) {
    // The video was replaced (or the record removed) meanwhile: neither file is referenced.
    if (dest) await fsp.rm(dest, { force: true }).catch(() => {});
    await fsp.rm(src, { force: true }).catch(() => {});
    return false;
  }
  if (dest) await fsp.rm(src, { force: true }).catch(() => {});
  return true;
}

/**
 * Queues one conversion (deduplicated by `key`, one at a time). Never throws.
 *   src            — absolute path of the stored video
 *   save(dest)     — points the record at `dest` (null = keep src) and marks it ready;
 *                    resolves to false when the record no longer references src
 *   onReady()      — called once the record points at a playable video
 *   onFailed(err)  — marks the record failed
 */
export function queueConversion({ key, src, save, onReady, onFailed }) {
  if (!key || inFlight.has(key)) return;
  inFlight.add(key);
  runConversion(async () => {
    if (!src || !fs.existsSync(src)) throw new Error('The uploaded video file is missing.');
    if (await convertAndSwap(src, save)) onReady?.();
  })
    .catch(async (err) => {
      console.error(`[video] ${key}: ${err.message}`);
      await Promise.resolve(onFailed?.(err)).catch(() => {});
    })
    .finally(() => inFlight.delete(key));
}

/**
 * Converts a video stored under /uploads in the background, then points the record at
 * the MP4 and deletes the original.
 *   model/id     — the Mongoose model and document holding the video
 *   field        — the document field with the /uploads/... path (e.g. 'videoUrl')
 *   statusField  — the field set to 'processing' / 'ready' / 'failed'
 *   url          — the stored path being converted
 *   onReady(id)  — called once the record points at a playable video
 */
export function queueVideoConversion({ model, id, field, statusField, url, onReady }) {
  if (!id || !url) return;
  // Every write is filtered on the current path, so a video replaced mid-conversion is left alone.
  const current = { _id: id, [field]: url };
  queueConversion({
    key: `${model.modelName}:${id}:${url}`,
    src: resolveUploadPath(url),
    save: async (dest) => {
      const newUrl = dest ? `${path.posix.dirname(url)}/${path.basename(dest)}` : url;
      const saved = await model.updateOne(current, { $set: { [field]: newUrl, [statusField]: 'ready' } });
      return saved.matchedCount > 0;
    },
    onReady: () => onReady?.(id),
    onFailed: () => model.updateOne(current, { $set: { [statusField]: 'failed' } }),
  });
}
