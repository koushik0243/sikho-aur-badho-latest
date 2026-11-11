'use client';

import { useState } from 'react';
import s from './QuizResultReport.module.css';

// One quiz attempt, reviewed: score summary + question map, then each question
// with the learner's answer next to the reference answer.

const DIFF_LABEL = { beginner: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced' };
const WEAK_BELOW = 60;   // % of a question's marks — below this it needs review

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** An answer → { kind: 'strong' | 'weak' | 'skipped', pct, score, max } */
function grade(a) {
  if (a.status === 'skipped') return { kind: 'skipped', pct: 0, score: 0, max: Number(a.maxScore || 0) };
  const score = Number(a.aiScore || 0);
  const max = Number(a.maxScore || 0);
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return { kind: pct < WEAK_BELOW ? 'weak' : 'strong', pct, score, max };
}

const KIND_LABEL = { strong: 'Good', weak: 'Needs review', skipped: 'Skipped' };

const TABS = [
  { key: 'all',     label: 'All' },
  { key: 'weak',    label: 'Needs review' },
  { key: 'skipped', label: 'Skipped' },
];

function ScoreRing({ pct, passed }) {
  return (
    <div className={`${s.ring} ${passed ? s.ringPass : s.ringFail}`} style={{ '--pct': pct }}
      role="img" aria-label={`Score ${pct}%, ${passed ? 'passed' : 'failed'}`}>
      <div className={s.ringInner}>
        <span className={s.ringPct}>{pct}%</span>
        <span className={s.ringLbl}>{passed ? 'Passed' : 'Failed'}</span>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   attempt: object, answers: Array, questionMap: Record<string, object>,
 *   learnerName: string, quizLabel: string,
 *   attemptNo: number, attemptsForTopic: number,
 * }} props
 */
export default function QuizResultReport({ attempt, answers, questionMap, learnerName, quizLabel, attemptNo, attemptsForTopic }) {
  const [tab, setTab] = useState('all');
  const rows = answers.map((a, i) => ({ a, i, g: grade(a), q: questionMap[String(a.questionId)] }));
  const count = { all: rows.length, strong: 0, weak: 0, skipped: 0 };
  rows.forEach(r => { count[r.g.kind] += 1; });
  const answered = rows.length - count.skipped;
  const score = Math.round(Number(attempt.totalScore || 0));
  const passed = attempt.passed === true;
  const shown = tab === 'all' ? rows : rows.filter(r => r.g.kind === tab);

  function jumpTo(i, kind) {
    if (tab !== 'all' && tab !== kind) setTab('all');
    requestAnimationFrame(() => {
      const el = document.getElementById(`quiz-q-${i}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el?.focus({ preventScroll: true });
    });
  }

  return (
    <>
      {/* ── Summary ── */}
      <section className={s.summary} aria-label="Attempt summary">
        <ScoreRing pct={score} passed={passed} />
        <div className={s.summaryMain}>
          <div className={s.summaryHead}>
            <div className={s.summaryWho}>
              <h3 className={s.learner}>{learnerName}</h3>
              <p className={s.quiz}>{quizLabel}</p>
              <p className={s.when}>
                Attempt {attemptNo}{attemptsForTopic > 1 ? ` of ${attemptsForTopic}` : ''} · {fmtDate(attempt.createdAt)}, {fmtTime(attempt.createdAt)}
              </p>
            </div>
            <span className={`${s.resultPill} ${passed ? s.pillPass : s.pillFail}`}>{passed ? '✓ Passed' : '✕ Failed'}</span>
          </div>

          <div className={s.tiles}>
            <div className={s.tile}><span className={s.tileVal}>{answered}/{rows.length}</span><span className={s.tileLbl}>Answered</span></div>
            <div className={`${s.tile} ${s.tileGood}`}><span className={s.tileVal}>{count.strong}</span><span className={s.tileLbl}>Good (≥{WEAK_BELOW}%)</span></div>
            <div className={`${s.tile} ${s.tileWeak}`}><span className={s.tileVal}>{count.weak}</span><span className={s.tileLbl}>Needs review</span></div>
            <div className={`${s.tile} ${s.tileSkip}`}><span className={s.tileVal}>{count.skipped}</span><span className={s.tileLbl}>Skipped</span></div>
          </div>

          {rows.length > 0 && (
            <div className={s.mapWrap}>
              <span className={s.mapLbl}>Questions</span>
              <div className={s.map}>
                {rows.map(r => (
                  <button key={r.i} type="button" className={`${s.mapDot} ${s[`dot_${r.g.kind}`]}`}
                    onClick={() => jumpTo(r.i, r.g.kind)}
                    title={`Q${r.i + 1} — ${KIND_LABEL[r.g.kind]}${r.g.kind !== 'skipped' ? ` (${r.g.score}/${r.g.max})` : ''}`}
                    aria-label={`Go to question ${r.i + 1}: ${KIND_LABEL[r.g.kind]}`}>
                    {r.i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Questions ── */}
      {rows.length > 0 && (
        <section className={s.questions} aria-labelledby="quiz-q-heading">
          <div className={s.qToolbar}>
            <h3 id="quiz-q-heading" className={s.qHeading}>Answers vs. reference</h3>
            <div className={s.tabs} role="tablist" aria-label="Show questions">
              {TABS.map(t => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                  className={s.tab} onClick={() => setTab(t.key)} disabled={t.key !== 'all' && count[t.key] === 0}>
                  {t.label} <span className={s.tabCount}>{count[t.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className={s.noneShown}>No questions in this view.</p>
          ) : shown.map(({ a, i, g, q }) => {
            const diff = q?.difficulty;
            return (
              <article key={i} id={`quiz-q-${i}`} tabIndex={-1} className={`${s.qCard} ${s[`card_${g.kind}`]}`}>
                <header className={s.qHead}>
                  <span className={s.qNum}>Q{i + 1}</span>
                  {DIFF_LABEL[diff] && <span className={`${s.diff} ${s[`diff_${diff}`] || ''}`}>{DIFF_LABEL[diff]}</span>}
                  <span className={`${s.kind} ${s[`kind_${g.kind}`]}`}>{KIND_LABEL[g.kind]}</span>
                  <span className={s.score}>
                    {g.kind === 'skipped' ? '—' : <><strong>{g.score}</strong>/{g.max}</>}
                  </span>
                </header>
                <p className={s.qText}>{q?.question || a.questionText || 'Question'}</p>
                {g.kind !== 'skipped' && (
                  <div className={s.bar} role="progressbar" aria-valuenow={g.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Question ${i + 1} score`}>
                    <span style={{ width: `${g.pct}%` }} />
                  </div>
                )}

                <div className={s.compare}>
                  <div className={s.side}>
                    <p className={s.sideLbl}>{learnerName ? `${learnerName}'s answer` : "Learner's answer"}</p>
                    {g.kind === 'skipped'
                      ? <p className={s.skippedText}>Skipped — no answer given.</p>
                      : <p className={s.answer}>{a.userAnswer || '—'}</p>}
                    {a.aiFeedback && (
                      <p className={s.note}><span className={s.noteLbl}>AI feedback</span>{a.aiFeedback}</p>
                    )}
                  </div>
                  <div className={`${s.side} ${s.sideRef}`}>
                    <p className={s.sideLbl}>Reference answer</p>
                    <p className={s.answer}>{q?.answer || 'No reference answer available.'}</p>
                    {q?.explanation && (
                      <p className={s.note}><span className={s.noteLbl}>Explanation</span>{q.explanation}</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
