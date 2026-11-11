// Shared rules for the learner's voice-answer quiz and aptitude test: after each
// answer the learner moves straight on to the next unanswered question, and a
// test only submits once every question has an answer. Skipped questions and
// "answered" ones with no recorded speech both count as unanswered.

/** @param {Record<string, {status: string, transcript?: string}>} answers */
export function isQuestionAnswered(answers, question) {
  const a = answers[String(question._id)];
  return a?.status === 'answered' && !!String(a.transcript || '').trim();
}

export function unansweredIndexes(questions, answers) {
  return questions.reduce((acc, q, i) => (isQuestionAnswered(answers, q) ? acc : [...acc, i]), []);
}

// Time's up: the test submits as it stands. Only answers the learner actually
// submitted count; every pending question — never reached, skipped, or spoken
// but not submitted — goes in as "skipped".
export function answersForTimeUp(questions, answers) {
  return Object.fromEntries(questions.map(q => {
    const id = String(q._id);
    return [id, isQuestionAnswered(answers, q) ? answers[id] : { status: 'skipped', transcript: '' }];
  }));
}

// Next/Previous only ever land on unanswered questions, and wrap past the
// end/start. Returns -1 when no OTHER question is unanswered.
export function nextUnansweredCycling(questions, answers, fromIdx) {
  const n = questions.length;
  for (let step = 1; step < n; step++) {
    const i = (fromIdx + step) % n;
    if (!isQuestionAnswered(answers, questions[i])) return i;
  }
  return -1;
}

export function prevUnansweredCycling(questions, answers, fromIdx) {
  const n = questions.length;
  for (let step = 1; step < n; step++) {
    const i = (fromIdx - step + n) % n;
    if (!isQuestionAnswered(answers, questions[i])) return i;
  }
  return -1;
}
