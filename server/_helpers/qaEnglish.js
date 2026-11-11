// Quiz and Aptitude QA are always written in English, whatever language the source is in.
//
// Lesson transcripts come from Whisper in the language that was spoken (often Hindi or
// Hinglish), and the model tends to answer in the language of its input. So every QA
// prompt carries ENGLISH_ONLY_RULE, the reply is checked for non-English script, a reply
// that isn't fully English is generated once more, and anything still not English is dropped.

// Scripts that mean the text isn't English: Arabic, Thai, Devanagari (Hindi), Bengali,
// Khmer, CJK, Japanese kana, Korean, plus the other Indic scripts (Gurmukhi … Malayalam).
const NON_ENGLISH_SCRIPT = /[؀-ۿݐ-ݿ฀-๿ऀ-ॿঀ-৿਀-ൿក-៿⺀-⻿぀-ヿ㐀-䶿一-鿿가-힯]/;

export const ENGLISH_ONLY_RULE = `- LANGUAGE: Write every question, answer and explanation in English only. The content may be in Hindi, Hinglish or another language — translate it and write in clear English. Never use Hindi (Devanagari) or any other script, and never write Hindi words in Roman letters (Hinglish).`;

const ENGLISH_SYSTEM_RULE = 'Always write in English, even when the source content is in Hindi or another language.';
const RETRY_NOTE = 'Your previous reply contained text that was not in English. Write ALL questions, answers and explanations in English only — translate any Hindi or other-language content.';

/** True when the question, answer and explanation contain no non-English script. */
export const isEnglishQA = (q) =>
  !NON_ENGLISH_SCRIPT.test(`${q?.question || ''} ${q?.answer || ''} ${q?.explanation || ''}`);

function parseQuestions(raw) {
  try {
    const cleaned = (raw || '[]').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error('Failed to parse AI response as JSON.');
  }
}

/**
 * Asks the model for QA and returns only English questions.
 *   client      — an OpenAI client
 *   systemText  — the system message (the English rule is appended)
 *   prompt      — the user prompt (should include ENGLISH_ONLY_RULE)
 *   options     — extra chat.completions options (model, temperature, max_tokens)
 */
export async function generateEnglishQuestions({ client, systemText, prompt, options }) {
  const ask = async (extraNote) => {
    const completion = await client.chat.completions.create({
      ...options,
      messages: [
        { role: 'system', content: `${systemText} ${ENGLISH_SYSTEM_RULE}` },
        { role: 'user', content: extraNote ? `${prompt}\n\n${extraNote}` : prompt },
      ],
    });
    return parseQuestions(completion.choices[0]?.message?.content);
  };

  let questions = await ask();
  if (questions.length === 0) throw new Error('AI returned no questions.');
  if (!questions.every(isEnglishQA)) {
    // Generate once more with a firmer instruction; keep whichever reply has more English questions.
    const retry = await ask(RETRY_NOTE).catch(() => []);
    if (retry.filter(isEnglishQA).length > questions.filter(isEnglishQA).length) questions = retry;
  }

  const english = questions.filter(isEnglishQA);
  if (english.length === 0) {
    throw new Error('The AI could not write the questions in English. Please try Generate again.');
  }
  return english;
}
