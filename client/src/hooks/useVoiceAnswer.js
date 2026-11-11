'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import apiServiceHandler from '../service/apiService';
import { openMic, createLevelTracker, createPhraseFilter } from './voiceGate';

/*
 * Voice-to-text for one answer box (learner quiz + aptitude test).
 *
 * The answer text comes from the server (OpenAI Whisper), not the browser's
 * speech service — that one stops after pauses, caps session length and drops
 * on network hiccups, so an answer built from it sometimes stopped mid-way.
 *
 *  • One continuous microphone recording per answer, for up to 15 minutes —
 *    pauses never end it; only the learner's stop tap (or the limit) does.
 *  • Each time the learner pauses briefly, the phrase just spoken is sent for
 *    transcription and APPENDED to the answer (in the language spoken: Hindi in
 *    Devanagari, English in English). Very long stretches without a pause are
 *    sent every 25 s. Silent stretches are never sent.
 *  • Surrounding sounds (people nearby, TV, traffic) are muted before
 *    recording — see voiceGate.js — so only the learner's voice is sent.
 *  • The browser's speech service, where available, only drives a grey live
 *    preview (`liveText`) of the phrase being spoken — if it drops out, nothing
 *    is lost, because the answer itself comes from the recording.
 */

export const MAX_RECORDING_MS = 15 * 60 * 1000;   // 15 minutes per answer
const PAUSE_MS = 800;                // this much silence after speech ends a phrase
const MAX_SEGMENT_MS = 25 * 1000;    // a phrase is sent at the latest after this long
const NO_VAD_SEGMENT_MS = 15 * 1000; // segment length when silence can't be measured
const MIN_SPEECH_MS = 300;           // shorter "speech" is noise — not sent
const VAD_TICK_MS = 20;
const MAX_TICK_GAP_MS = 250;         // background tabs tick slowly — don't count a long gap as speech/silence
// Whisper sometimes "hears" these in near-silence; drop them from short phrases.
const HALLUCINATIONS = ['thank you.', 'thank you', 'thanks for watching!', 'thanks for watching.', 'you', '.', 'bye.', 'धन्यवाद।', 'धन्यवाद'];
const PREVIEW_RESTART_MS = 250;
const PREVIEW_WATCHDOG_MS = 1000;
const MIC_RETRY_MS = 2000;           // how often to retry a lost microphone

const RECORDER_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return RECORDER_MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

// Joins speech fragments with single spaces, ignoring empty ones.
function joinSpeech(...parts) {
  return parts.map(p => String(p || '').trim()).filter(Boolean).join(' ');
}

export default function useVoiceAnswer() {
  const [transcript, setTranscript] = useState('');
  const [liveText, setLiveText] = useState('');      // grey preview of the phrase being spoken
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState('');

  // Bumped by reset()/clear() so late results for a previous answer are ignored.
  const sessionIdRef = useRef(0);
  const activeRef = useRef(null); // { stop(), abort() } of the recording in progress
  const transcriptRef = useRef('');
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const hasNativeSpeech = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasMediaRecorder = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // Recording stopwatch
  useEffect(() => {
    if (!isRecording) return;
    const t = setInterval(() => setRecordTime(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  // Never leave the microphone open when the page goes away.
  useEffect(() => () => { activeRef.current?.abort(); }, []);

  /* ── Live preview (browser speech service; best effort) ─────────────── */
  // Restarts with a fresh recognizer after every pause and revives itself if it
  // dies. Reports the text heard since the last phrase cut.
  // canShow(): false while the mic hears only silence, so words the browser
  // "hears" in background noise never flash up in the preview.
  function startLivePreview(isCurrent, canShow = () => true) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return { cut() {}, stop() {}, fullText: () => '' };
    let committed = '';
    let sessionText = '';
    let offset = 0;          // length of the text already handed over to a phrase
    let current = null;
    let running = false;
    let starting = false;
    let restartTimer = null;
    let stopped = false;
    let dead = false;        // mic blocked etc. — preview gives up quietly
    const fullText = () => joinSpeech(committed, sessionText);
    const publish = () => { if (isCurrent()) setLiveText(canShow() ? fullText().slice(offset).trim() : ''); };
    const alive = () => !stopped && !dead && isCurrent();
    const scheduleRestart = () => {
      if (restartTimer || !alive()) return;
      restartTimer = setTimeout(() => { restartTimer = null; spawn(); }, PREVIEW_RESTART_MS);
    };
    function spawn() {
      if (!alive()) return;
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-IN';
      rec.onstart = () => { if (current === rec) { starting = false; running = true; } };
      rec.onresult = e => {
        if (current !== rec) return;
        sessionText = joinSpeech(...Array.from(e.results, r => r[0]?.transcript || ''));
        publish();
      };
      rec.onerror = e => {
        if (current === rec && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) dead = true;
      };
      rec.onend = () => {
        if (current !== rec) return;
        running = false;
        starting = false;
        committed = joinSpeech(committed, sessionText);
        sessionText = '';
        scheduleRestart();
      };
      current = rec;
      starting = true;
      try { rec.start(); } catch { starting = false; scheduleRestart(); }
    }
    const watchdog = setInterval(() => {
      if (!alive()) return;
      if (!running && !starting && !restartTimer) scheduleRestart();
    }, PREVIEW_WATCHDOG_MS);
    spawn();
    return {
      // The phrase so far was sent for transcription — preview starts afresh.
      cut() { offset = fullText().length; publish(); },
      stop() {
        stopped = true;
        clearTimeout(restartTimer);
        clearInterval(watchdog);
        try { current?.abort(); } catch { /* already stopped */ }
      },
      fullText,
    };
  }

  /* ── Phrase-by-phrase recording + server transcription ──────────────── */
  async function startSegmentedRecording() {
    const mySession = sessionIdRef.current;
    const isCurrent = () => sessionIdRef.current === mySession;
    const base = String(transcriptRef.current || '').trim();
    let answer = base;
    let heardAnything = false;
    let stopped = false;
    let aborted = false;

    const tracker = createLevelTracker(); // learner's voice level — kept across mic reconnects
    let mic;
    try {
      mic = await openMic(tracker);
    } catch {
      setMicError('Microphone access was blocked or unavailable. Allow microphone permission and try again.');
      return;
    }
    if (!isCurrent()) { mic.close(); return; }

    const mimeType = pickRecorderMimeType();
    let seg = null; // current phrase recording
    const preview = startLivePreview(isCurrent, () => !!seg && seg.hadSpeech);

    // Transcriptions run one at a time so phrases are appended in order.
    let queue = Promise.resolve();
    let pending = 0;
    let languageHint = '';
    let failures = 0;
    const settleIfDone = () => {
      if (pending > 0 || !isCurrent()) return;
      setIsTranscribing(false);
      if (stopped) {
        setLiveText('');
        if (!heardAnything && answer === base) setMicError('No speech detected. Speak a little louder, closer to the microphone.');
      }
    };
    function enqueue(blob, speechMs) {
      pending++;
      setIsTranscribing(true);
      queue = queue.then(async () => {
        try {
          if (!isCurrent()) return;
          const fd = new FormData();
          fd.append('audio', blob, 'answer.webm');
          if (languageHint) fd.append('languageHint', languageHint);
          const res = await apiServiceHandler('POST', 'speech/transcribe', fd);
          if (!isCurrent()) return;
          const text = String(res?.data?.text ?? '').trim();
          if (res?.data?.language) languageHint = res.data.language;
          const isHallucination = speechMs < 1500 && HALLUCINATIONS.includes(text.toLowerCase());
          if (text && !isHallucination) {
            heardAnything = true;
            answer = joinSpeech(answer, text);
            setTranscript(answer);
          }
        } catch {
          failures++;
          if (isCurrent()) setMicError(failures > 1
            ? 'Parts of your answer could not be transcribed. Check your connection — you can keep speaking.'
            : 'A part of your answer could not be transcribed. Please repeat it if it is missing.');
        } finally {
          pending--;
          settleIfDone();
        }
      });
    }

    // Only the learner's phrases are transcribed; background ones are dropped.
    const phrases = createPhraseFilter(tracker, p => enqueue(p.blob, p.speechMs));

    function startSegment() {
      const rec = new MediaRecorder(mic.stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      seg = { rec, chunks, gated: !!mic.measure, startedAt: Date.now(), speechMs: 0, silenceMs: 0, hadSpeech: false, peak: 0 };
      rec.start();
    }
    // Ends the current phrase: sends it if it held speech, then (unless the
    // recording is over) starts the next phrase straight away.
    function cut({ last = false, keepMic = false } = {}) {
      const done = seg;
      seg = null;
      if (done && done.rec.state !== 'inactive') {
        const send = !aborted && (done.gated ? done.speechMs >= MIN_SPEECH_MS : true);
        done.rec.onstop = () => {
          if (send && done.chunks.length) {
            const phrase = {
              blob: new Blob(done.chunks, { type: done.rec.mimeType || 'audio/webm' }),
              speechMs: done.speechMs || MAX_SEGMENT_MS,
              peak: done.peak,
            };
            if (done.gated) phrases.add(phrase, Date.now());
            else enqueue(phrase.blob, phrase.speechMs);
          }
          if (last) {
            if (!aborted) phrases.settle(Date.now(), { final: true });
            mic.close();
            settleIfDone();
          }
        };
        done.rec.stop();
        preview.cut();
      } else if (last) {
        mic.close();
        settleIfDone();
      }
      if (!last && !keepMic) startSegment();
    }

    // However long the learner stays silent, the mic must still be listening
    // when they speak again: wake the audio engine if the browser suspended it
    // (background tab, locked screen) and reconnect the mic if it was lost.
    let reconnecting = false;
    let lastReconnectAt = 0;
    async function reconnectMic() {
      reconnecting = true;
      lastReconnectAt = Date.now();
      if (seg) cut({ keepMic: true });   // send what was said before the drop
      const old = mic;
      try {
        const fresh = await openMic(tracker);
        if (stopped || !isCurrent()) { fresh.close(); return; }
        mic = fresh;
        old.close();
        startSegment();
      } catch {
        // mic not available right now — the next tick tries again
      } finally {
        reconnecting = false;
      }
    }
    function keepMicAwake() {
      if (mic.ctx && mic.ctx.state === 'suspended') mic.ctx.resume().catch(() => {});
      if (reconnecting) return false;
      if (!mic.isLive()) {
        if (Date.now() - lastReconnectAt >= MIC_RETRY_MS) reconnectMic();
        return false;
      }
      return true;
    }

    // Speech / silence detection (learner's voice only) decides where each phrase ends.
    let lastTickAt = Date.now();
    const vad = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(now - lastTickAt, MAX_TICK_GAP_MS);
      lastTickAt = now;
      if (stopped || !keepMicAwake() || !seg) return;
      phrases.settle(now, { speaking: seg.hadSpeech });
      const age = now - seg.startedAt;
      if (mic.measure) {
        const reading = mic.measure();
        if (reading.speech) {
          seg.speechMs += dt;
          seg.silenceMs = 0;
          seg.hadSpeech = true;
          seg.peak = Math.max(seg.peak, reading.level);
        } else {
          seg.silenceMs += dt;
        }
        const pauseAfterSpeech = seg.hadSpeech && seg.silenceMs >= PAUSE_MS && seg.speechMs >= MIN_SPEECH_MS;
        if (pauseAfterSpeech || age >= MAX_SEGMENT_MS) cut();
      } else if (age >= NO_VAD_SEGMENT_MS) {
        cut();
      }
    }, VAD_TICK_MS);

    const limitTimer = setTimeout(() => {
      if (stopped || !isCurrent()) return;
      finish();
      setMicError('Recording reached the 15-minute limit and stopped. Tap the mic to continue.');
    }, MAX_RECORDING_MS);

    function finish() {
      if (stopped) return;
      stopped = true;
      clearInterval(vad);
      clearTimeout(limitTimer);
      preview.stop();
      if (activeRef.current === controller) activeRef.current = null;
      if (isCurrent()) setIsRecording(false);
      cut({ last: true });
    }
    const controller = {
      stop: finish,                                   // send the last phrase, then stop
      abort() { aborted = true; finish(); },          // stop without sending anything more
    };
    activeRef.current = controller;
    startSegment();
    setIsRecording(true);
  }

  /* ── Browsers without MediaRecorder: live recognition only ──────────── */
  function startPreviewOnlyRecording() {
    const mySession = sessionIdRef.current;
    const isCurrent = () => sessionIdRef.current === mySession;
    const base = String(transcriptRef.current || '').trim();
    const preview = startLivePreview(isCurrent);
    const limitTimer = setTimeout(() => controller.stop(), MAX_RECORDING_MS);
    const controller = {
      stop() {
        clearTimeout(limitTimer);
        const heard = preview.fullText();
        preview.stop();
        if (activeRef.current === controller) activeRef.current = null;
        if (!isCurrent()) return;
        setIsRecording(false);
        setLiveText('');
        if (heard) setTranscript(joinSpeech(base, heard));
        else setMicError('No speech detected. Speak a little louder, closer to the microphone.');
      },
      abort() { clearTimeout(limitTimer); preview.stop(); if (activeRef.current === controller) activeRef.current = null; },
    };
    activeRef.current = controller;
    setIsRecording(true);
  }

  function startRecording() {
    if (activeRef.current) return; // already recording
    setMicError('');
    setRecordTime(0);
    if (hasMediaRecorder) {
      startSegmentedRecording();
    } else if (hasNativeSpeech) {
      startPreviewOnlyRecording();
    } else {
      setMicError('Voice input isn’t supported in this browser.');
    }
  }

  function stopRecording() {
    if (activeRef.current) activeRef.current.stop();
    else setIsRecording(false);
  }

  const reset = useCallback((initialTranscript = '') => {
    activeRef.current?.abort();
    activeRef.current = null;
    sessionIdRef.current += 1;
    setTranscript(initialTranscript);
    setLiveText('');
    setIsRecording(false);
    setRecordTime(0);
    setMicError('');
    setIsTranscribing(false);
  }, []);

  // Discards the current answer text (and any recording in progress) so the
  // learner can start over.
  const clear = useCallback(() => reset(''), [reset]);

  return {
    transcript, setTranscript,
    liveText,
    isRecording, recordTime, micError, isTranscribing,
    startRecording, stopRecording, reset, clear,
    maxRecordingSeconds: MAX_RECORDING_MS / 1000,
    // No live word-by-word preview in this browser — text appears after each pause.
    usesFallback: !hasNativeSpeech,
  };
}
