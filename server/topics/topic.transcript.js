// Lesson video → MP3 → transcript ("script") used to generate Quiz and Aptitude QA.
//
// The video itself is never sent to OpenAI. ffmpeg strips the audio into small mono
// MP3 chunks, each chunk is transcribed with Whisper, and the joined text is cached
// on the lesson (Topic.transcript) so a video is only transcribed once.
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import OpenAI from 'openai';
import Topic from './topic.model.js';
import Chapter from '../chapters/chapter.model.js';
import { createJobQueue } from '../_helpers/jobQueue.js';
import { resolveUploadPath } from '../_helpers/videoConvert.js';

// Whisper accepts at most 25 MB per request. 20 minutes of 32 kbps mono MP3 is
// ~4.8 MB, so every chunk stays far below that whatever the video's length.
const SEGMENT_SECONDS = 20 * 60;
const AUDIO_BITRATE = '32k';
const AUDIO_SAMPLE_RATE = '16000'; // speech only needs 16 kHz
const FFMPEG_TIMEOUT_MS = 60 * 60 * 1000;
const FFMPEG_STDERR_LIMIT = 4000;
const TRANSCRIPTION_MODEL = 'whisper-1';
// At most this many videos are converted/transcribed at once (each is CPU-heavy).
const MAX_CONCURRENT_JOBS = 2;
// Upper bound on transcript text sent in one prompt (~50k tokens).
export const MAX_TRANSCRIPT_CHARS = 200_000;

export const TRANSCRIPT_STATUSES = ['processing', 'ready', 'failed'];

/** Absolute path of an uploaded lesson video, or null if it isn't a local, existing upload. */
export const resolveLocalVideoPath = resolveUploadPath;

// The lesson's video is still being converted to a browser-safe MP4 (videoConvert.js);
// its path changes when that finishes, so it is transcribed afterwards.
const isVideoConverting = (topic) => topic?.videoStatus === 'processing';

/** Cuts text to the prompt budget without splitting a word. */
export function limitTranscript(text, maxChars = MAX_TRANSCRIPT_CHARS) {
  if (!text || text.length <= maxChars) return text || '';
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), FFMPEG_TIMEOUT_MS);
    proc.stderr.on('data', (chunk) => {
      if (stderr.length < FFMPEG_STDERR_LIMIT) stderr += chunk.toString();
    });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      if (signal) return reject(new Error('Converting the video to audio took too long.'));
      if (/does not contain any stream|matches no streams/i.test(stderr)) {
        return reject(new Error('This video has no audio track to transcribe.'));
      }
      reject(new Error(`Could not convert the video to audio: ${stderr.trim().split('\n').pop() || `ffmpeg exited with code ${code}`}`));
    });
  });
}

/** Converts a video to numbered MP3 chunks in outDir; returns their paths in order. */
export async function convertVideoToMp3Chunks(videoPath, outDir) {
  await runFfmpeg([
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    '-i', videoPath,
    '-vn', '-ac', '1', '-ar', AUDIO_SAMPLE_RATE, '-b:a', AUDIO_BITRATE,
    '-f', 'segment', '-segment_time', String(SEGMENT_SECONDS), '-reset_timestamps', '1',
    path.join(outDir, 'part-%03d.mp3'),
  ]);
  const files = (await fsp.readdir(outDir)).filter(f => f.endsWith('.mp3')).sort();
  if (!files.length) throw new Error('This video has no audio track to transcribe.');
  return files.map(f => path.join(outDir, f));
}

async function transcribeMp3Chunks(mp3Paths) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const parts = [];
  for (const mp3Path of mp3Paths) { // in order, so the script reads start to finish
    const text = await client.audio.transcriptions.create({
      file: fs.createReadStream(mp3Path),
      model: TRANSCRIPTION_MODEL,
      response_format: 'text',
    });
    if (typeof text === 'string' && text.trim()) parts.push(text.trim());
  }
  return parts.join('\n');
}

/** Video file → MP3 chunks → transcript text. Temporary MP3s are always removed. */
export async function transcribeVideoFile(videoPath) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY in .env');
  }
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lesson-audio-'));
  try {
    const mp3Paths = await convertVideoToMp3Chunks(videoPath, workDir);
    return await transcribeMp3Chunks(mp3Paths);
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Job queue: one transcription per lesson video, at most MAX_CONCURRENT_JOBS at once ──
const inFlight = new Map(); // `${topicId}:${videoUrl}` → Promise<string>
const withJobSlot = createJobQueue(MAX_CONCURRENT_JOBS);

export function hasReadyTranscript(topic) {
  return topic?.transcriptStatus === 'ready' && !!topic.videoUrl && topic.transcriptVideoUrl === topic.videoUrl;
}

function hasFailedTranscript(topic) {
  return topic?.transcriptStatus === 'failed' && topic.transcriptVideoUrl === topic.videoUrl;
}

export function isTranscribing(topic) {
  return !!topic?._id && inFlight.has(`${topic._id}:${topic.videoUrl}`);
}

async function runTranscriptJob(topicId, videoUrl, videoPath) {
  // Filters include videoUrl so a video replaced mid-job never gets the old transcript.
  await Topic.updateOne({ _id: topicId, videoUrl },
    { $set: { transcriptStatus: 'processing', transcriptVideoUrl: videoUrl, transcriptError: null } });
  try {
    const transcript = await transcribeVideoFile(videoPath);
    const saved = await Topic.updateOne({ _id: topicId, videoUrl }, {
      $set: { transcript, transcriptStatus: 'ready', transcriptVideoUrl: videoUrl, transcriptError: null, transcriptUpdatedAt: new Date() },
    });
    if (saved.matchedCount === 0) {
      // The lesson's video was replaced (or the lesson deleted) while this one was transcribed.
      const replaced = new Error('The lesson video was changed while it was being transcribed. Please try again.');
      replaced.isStale = true;
      throw replaced;
    }
    return transcript;
  } catch (err) {
    if (!err.isStale) {
      await Topic.updateOne({ _id: topicId, videoUrl },
        { $set: { transcriptStatus: 'failed', transcriptError: err.message } }).catch(() => {});
    }
    throw err;
  }
}

/**
 * Transcript of a lesson's uploaded video. Uses the cached one when it matches the
 * current video, joins a transcription already running, or starts a new one.
 * Resolves to null when the lesson has no local video (none, external URL, missing file).
 */
export async function getLessonTranscript(topic) {
  if (!topic?.videoUrl) return null;
  if (hasReadyTranscript(topic)) {
    if (typeof topic.transcript === 'string') return topic.transcript;
    const saved = await Topic.findById(topic._id).select('+transcript').lean();
    return saved?.transcript || '';
  }
  if (isVideoConverting(topic)) {
    const err = new Error('The lesson video is still being prepared for playback. Please try again in a few minutes.');
    err.statusCode = 409;
    throw err;
  }
  const videoPath = resolveLocalVideoPath(topic.videoUrl);
  if (!videoPath) return null;

  const key = `${topic._id}:${topic.videoUrl}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const job = withJobSlot(() => runTranscriptJob(topic._id, topic.videoUrl, videoPath))
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/** Starts transcribing a lesson's video in the background (after upload); never throws. */
export function prepareTranscriptInBackground(topic) {
  // A converting video is transcribed once conversion finishes (topic.controller.js).
  if (!topic || topic.video_type !== 'lesson' || hasReadyTranscript(topic) || isVideoConverting(topic)) return;
  getLessonTranscript(topic).catch((err) => {
    console.error(`[transcript] lesson ${topic._id}: ${err.message}`);
  });
}

/**
 * Ready transcripts of a course's lesson videos, in chapter then lesson order.
 * Lesson videos without a ready transcript are queued for transcription (counted in
 * pendingCount) rather than awaited, so a course with many long videos never blocks.
 */
export async function getCourseTranscripts(courseId) {
  const lessons = await Topic.find({
    courseId, video_type: 'lesson', deletedAt: null, status: 'active', videoUrl: { $nin: [null, ''] },
  }).select('+transcript').lean();

  const chapters = await Chapter.find({ _id: { $in: [...new Set(lessons.map(l => String(l.chapterId)))] } })
    .select('order').lean();
  const chapterOrder = new Map(chapters.map(c => [String(c._id), c.order ?? 0]));
  lessons.sort((a, b) => (chapterOrder.get(String(a.chapterId)) ?? 0) - (chapterOrder.get(String(b.chapterId)) ?? 0)
    || (a.order ?? 0) - (b.order ?? 0));

  const transcripts = [];
  let pendingCount = 0;
  for (const lesson of lessons) {
    if (hasReadyTranscript(lesson)) {
      if (lesson.transcript?.trim()) transcripts.push({ title: lesson.title, transcript: lesson.transcript.trim() });
    } else if (hasFailedTranscript(lesson)) {
      // e.g. no audio track: not retried here (re-uploading the video or generating
      // that chapter's quiz retries it), and not reported as "still being prepared".
      continue;
    } else if (isVideoConverting(lesson)) {
      pendingCount += 1; // transcribed when its conversion finishes
    } else if (resolveLocalVideoPath(lesson.videoUrl)) {
      pendingCount += 1;
      prepareTranscriptInBackground(lesson);
    }
  }
  return { transcripts, pendingCount };
}

/** Same as prepareTranscriptInBackground, loading the lesson by id first. */
export function prepareTranscriptInBackgroundById(topicId) {
  if (!topicId) return;
  Topic.findOne({ _id: topicId, deletedAt: null }).lean()
    .then(prepareTranscriptInBackground)
    .catch((err) => console.error(`[transcript] lesson ${topicId}: ${err.message}`));
}
