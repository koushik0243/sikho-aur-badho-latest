import OpenAI from 'openai';
import { toFile } from 'openai';

const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

// Answers are spoken in English or Hindi. Whisper's verbose_json reports the
// detected language by full name.
const SUPPORTED_ANSWER_LANGUAGES = ['english', 'hindi'];
const LANGUAGE_CODE = { english: 'en', hindi: 'hi' };
// A short Devanagari prompt steers Whisper to write Hindi in Devanagari script.
const HINDI_SCRIPT_PROMPT = 'यह उत्तर हिंदी में है।';

// Whisper's own "this wasn't speech" rule: a stretch it thinks is probably
// silence/noise AND is unsure about the words is dropped — this is where
// background chatter and noise turn into stray words.
const NO_SPEECH_PROB = 0.6;
const LOW_CONFIDENCE_LOGPROB = -1;

/** Text of a verbose_json result, without the stretches Whisper flags as non-speech. */
function spokenText(result) {
  const segments = Array.isArray(result?.segments) ? result.segments : null;
  if (!segments) return String(result?.text || '').trim();
  return segments
    .filter(seg => !(seg.no_speech_prob > NO_SPEECH_PROB && seg.avg_logprob < LOW_CONFIDENCE_LOGPROB))
    .map(seg => String(seg.text || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function extensionFor(mimetype = '') {
  if (mimetype.includes('ogg')) return 'ogg';
  if (mimetype.includes('wav')) return 'wav';
  if (mimetype.includes('mp4') || mimetype.includes('m4a')) return 'mp4';
  return 'webm';
}

/**
 * Transcribes one answer recording (or one phrase of it) in the language it was
 * spoken in — English in Latin script, Hindi in Devanagari.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {{ languageHint?: string }} [opts] 'english' | 'hindi' — the language
 *   detected for the previous phrase of the same answer; used when Whisper
 *   can't tell on a short phrase.
 * @returns {Promise<{ text: string, language: string|null }>}
 */
export const transcribeAudioBuffer = async (buffer, mimetype = 'audio/webm', opts = {}) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY in .env');
  }
  if (!buffer || buffer.length === 0) {
    return { text: '', language: null };
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    const err = new Error('Recording is too long to transcribe. Please answer in a shorter clip.');
    err.statusCode = 400;
    throw err;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30 * 1000 });
  const asFile = () => toFile(buffer, `recording.${extensionFor(mimetype)}`, { type: mimetype });

  // Let Whisper detect English vs Hindi so the text comes back in that
  // language's own script instead of everything being forced into English.
  const detected = await client.audio.transcriptions.create({
    file: await asFile(),
    model: 'whisper-1',
    response_format: 'verbose_json',
  });
  const language = String(detected?.language || '').toLowerCase();
  const text = spokenText(detected);
  if (SUPPORTED_ANSWER_LANGUAGES.includes(language)) return { text, language };

  // Not English or Hindi — usually Hindi detected as Urdu (written in Urdu
  // script), or a short phrase Whisper couldn't place. Transcribe again in the
  // answer's language: the hint from the previous phrase, otherwise Hindi.
  const target = SUPPORTED_ANSWER_LANGUAGES.includes(opts.languageHint) ? opts.languageHint : 'hindi';
  const retry = await client.audio.transcriptions.create({
    file: await asFile(),
    model: 'whisper-1',
    response_format: 'verbose_json',
    language: LANGUAGE_CODE[target],
    ...(target === 'hindi' ? { prompt: HINDI_SCRIPT_PROMPT } : {}),
  });
  return { text: spokenText(retry), language: target };
};
