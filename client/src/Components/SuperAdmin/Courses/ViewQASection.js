'use client';

import sPage from './ViewQASection.module.css';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

// Read-only Aptitude Test / Quiz block on the course view page: the test's
// settings, then its selected questions & answers in a scrollable box.

const DIFF_LABEL = { beginner: 'Basic', intermediate: 'Intermediate', advanced: 'Advance' };
const LAYOUT_LABEL = { single: 'Single question', all: 'All questions' };
const ORDER_LABEL = { sequential: 'Sequential', random: 'Random' };

const yesNo = v => (v ? 'Yes' : 'No');
const timeLimit = st => (Number(st.timeLimit) > 0 ? `${st.timeLimit} ${st.timeUnit || 'Minutes'}` : 'No limit');

/** Settings rows shared by the aptitude test and quizzes (noun = 'Test' | 'Quiz'). */
function settingRows(st, noun, withScoring) {
  return [
    ['Time Limit', timeLimit(st)],
    [`Hide ${noun} Time`, yesNo(st.hideQuizTime)],
    ...(withScoring ? [
      ['Attempts Allowed', st.attemptsAllowed || '—'],
      ['Passing Grade', st.passingGrade ? `${st.passingGrade}%` : '—'],
      ['Max Questions to Answer', st.maxQuestions || '—'],
    ] : []),
    [`${noun} Auto Start`, yesNo(st.quizAutoStart)],
    ['Question Layout', LAYOUT_LABEL[st.questionLayout] || st.questionLayout || '—'],
    ['Question Order', ORDER_LABEL[st.questionOrder] || st.questionOrder || '—'],
    ['Hide Question Number', yesNo(st.hideQuestionNumber)],
  ];
}

/** Questions in the order they were selected; ids that no longer exist are skipped. */
export function pickSelected(questions, selectedIds) {
  const byId = new Map((questions || []).map(q => [String(q._id), q]));
  return (selectedIds || []).map(id => byId.get(String(id))).filter(Boolean);
}

function QuestionList({ questions, emptyText }) {
  if (!questions.length) return <p className={s.empty}>{emptyText}</p>;
  return (
    <ol className={s.qList} tabIndex={0} aria-label="Questions and answers">
      {questions.map((q, i) => {
        const options = Array.isArray(q.options) ? q.options.filter(o => o?.text) : [];
        return (
          <li key={q._id ?? i} className={s.qItem}>
            <div className={s.qHead}>
              <span className={s.qNo}>Q{i + 1}.</span>
              <span className={s.qText}>{q.question}</span>
              {q.difficulty && <span className={`${s.diff} ${s[`diff_${q.difficulty}`] || ''}`}>{DIFF_LABEL[q.difficulty] || q.difficulty}</span>}
            </div>
            {options.length > 0 && (
              <ul className={s.options}>
                {options.map((o, oi) => (
                  <li key={oi} className={o.isCorrect ? s.optCorrect : s.opt}>
                    <span aria-hidden="true">{o.isCorrect ? '✓' : String.fromCharCode(65 + oi)}</span> {o.text}
                    {o.isCorrect && <span className={s.srOnly}> (correct answer)</span>}
                  </li>
                ))}
              </ul>
            )}
            {q.answer && <p className={s.answer}><strong>Answer:</strong> {q.answer}</p>}
            {q.explanation && <p className={s.explain}><strong>Explanation:</strong> {q.explanation}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * @param {{
 *   kind: 'aptitude' | 'quiz',
 *   settings: Record<string, any>,
 *   questions: Array<object>,          // the selected questions, in order
 *   extraRows?: Array<[string, import('react').ReactNode]>,  // shown before the settings (e.g. Status, Context)
 *   totalGenerated?: number,           // size of the question pool, for context
 *   loading?: boolean,
 * }} props
 */
export default function ViewQASection({ kind, settings, questions, extraRows = [], totalGenerated, loading }) {
  const isQuiz = kind === 'quiz';
  const rows = [...extraRows, ...settingRows(settings || {}, isQuiz ? 'Quiz' : 'Test', isQuiz)];
  return (
    <div className={s.wrap}>
      <div className={s.block}>
        <div className={s.blockTitle}>{isQuiz ? 'Quiz Settings' : 'Aptitude Test Settings'}</div>
        <dl className={isQuiz ? s.settings : `${s.settings} ${s.settings4}`}>
          {rows.map(([label, value]) => (
            <div key={label} className={s.setting}>
              <dt>{label}</dt>
              <dd>{value === '' || value == null ? '—' : value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={s.block}>
        <div className={s.blockTitle}>
          Questions &amp; Answers
          <span className={s.count}>
            {loading ? 'Loading…' : `${questions.length} selected${totalGenerated != null ? ` of ${totalGenerated}` : ''}`}
          </span>
        </div>
        {loading ? <p className={s.empty}>Loading questions…</p>
          : <QuestionList questions={questions} emptyText={`No questions selected for this ${isQuiz ? 'quiz' : 'aptitude test'}.`} />}
      </div>
    </div>
  );
}
