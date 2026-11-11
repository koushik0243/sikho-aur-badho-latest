import express from 'express';
import multer from 'multer';
import * as SpeechService from './speech.service.js';

const Router = express.Router();

// In-memory only — a voice-answer clip is transcribed once and discarded, no need to
// persist it to disk like course/lesson media uploads do.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 24 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Only audio files are accepted.'));
  },
});

const transcribeAudio = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 400, message: 'An audio file is required.' });
    }
    // languageHint: the language detected for the previous phrase of this answer
    const languageHint = typeof req.body?.languageHint === 'string' ? req.body.languageHint.toLowerCase() : undefined;
    const { text, language } = await SpeechService.transcribeAudioBuffer(req.file.buffer, req.file.mimetype, { languageHint });
    res.status(200).json({ status: 200, message: 'Transcribed.', data: { text, language } });
  } catch (error) {
    next(error);
  }
};

Router.post('/transcribe', upload.single('audio'), transcribeAudio);

export default Router;
