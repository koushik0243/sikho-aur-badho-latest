'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import s from "./OrgDashboard.module.css";
import { kit as k, PageHeader, KpiTiles, Card, Pill, KitIcon } from '../PageKit/PageKit';

// ── Course completion: one horizontal bar per course (0–100%), hover/focus shows the detail ──
function CompletionBars({ rows }) {
  const sorted = [...rows].sort((x, y) => y.pct - x.pct);
  return (
    <ul className={s.bars} aria-label="Completion by course">
      {sorted.map(c => {
        const pct = Math.max(0, Math.min(100, Math.round(Number(c.pct) || 0)));
        return (
          <li key={c.label} className={s.barRow} tabIndex={0} aria-label={`${c.label}: ${pct}% complete`}>
            <span className={s.barLabel} title={c.label}>{c.label}</span>
            <span className={s.barTrack} aria-hidden="true">
              {pct > 0 && <span className={s.barFill} style={{ width: `max(${pct}%, 4px)` }} />}
            </span>
            <span className={s.barValue} aria-hidden="true">{pct}%</span>
            <span className={s.tip} role="tooltip">{c.label} — <strong>{pct}%</strong> complete</span>
          </li>
        );
      })}
    </ul>
  );
}

function Av({ name }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return <div className={s.avatar} aria-hidden="true">{initials}</div>;
}

function fmtRelative(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} Minute${mins !== 1 ? 's' : ''} Ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} Hour${hrs !== 1 ? 's' : ''} Ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} Days Ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const EMPTY_SUMMARY = {
  learnerCount: 0, newLearnersThisMonth: 0,
  coursesAssignedCount: 0, newCoursesThisMonth: 0,
  completionRate: 0,
  totalCredits: 0, creditsLeft: 0, isLowOnCredits: false,
  courseCompletion: [], topPerformers: [], bottomPerformers: [], activity: [],
};

/** One learner in the Top performers / Needs attention lists. */
function Performer({ p, rank, tone, badge }) {
  const score = Math.max(0, Math.min(100, Math.round(Number(p.avgScore) || 0)));
  return (
    <li className={s.performer}>
      <span className={s.rank} aria-hidden="true">{rank}</span>
      <Av name={p.name} />
      <div className={s.performerInfo}>
        <div className={s.performerTop}>
          <span className={s.performerName}>{p.name}</span>
          {badge && <Pill tone={tone}>{badge}</Pill>}
        </div>
        <div className={s.performerMeta}>
          Courses passed {p.coursesPassed}/{p.coursesAssigned} · Avg. score <strong>{score}%</strong>
        </div>
        <span className={s.scoreTrack} role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} average score`}>
          <span className={`${s.scoreFill} ${s[`score_${tone}`] || ''}`} style={{ width: `${Math.max(score, 2)}%` }} />
        </span>
      </div>
    </li>
  );
}

export default function OrganizationDashboard() {
  const user = useSelector(selectUser);
  const [summary, setSummary]   = useState(EMPTY_SUMMARY);
  const [loading, setLoading]   = useState(true);

  function getTokenUserId() {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload._id || null;
    } catch { return null; }
  }

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      let effectiveOrgId = user?.orgId ? String(user.orgId) : null;
      if (!effectiveOrgId) {
        const uid = user?._id || getTokenUserId();
        if (uid) {
          const r = await apiServiceHandler('GET', `user/admin/edit/${uid}`);
          const rec = r?.data ?? r;
          if (rec?.orgId) effectiveOrgId = String(rec.orgId);
        }
      }
      if (!effectiveOrgId) { setSummary(EMPTY_SUMMARY); return; }

      const res = await apiServiceHandler('GET', `org-dashboard/summary?orgId=${effectiveOrgId}`);
      setSummary({ ...EMPTY_SUMMARY, ...(res?.data ?? res ?? {}) });
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.orgId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const {
    learnerCount, newLearnersThisMonth,
    coursesAssignedCount, newCoursesThisMonth,
    completionRate, totalCredits, creditsLeft, isLowOnCredits,
    courseCompletion, topPerformers, bottomPerformers, activity,
  } = summary;

  const creditsPct = totalCredits > 0 ? Math.round((creditsLeft / totalCredits) * 100) : 0;
  const creditsTone = loading || totalCredits === 0 ? '' : isLowOnCredits ? 'warn' : 'good';
  const creditsHint = totalCredits === 0 ? 'No credits purchased yet'
    : `${totalCredits} issued${isLowOnCredits ? ' · running low' : ''}`;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className={k.page}>
      <PageHeader title="Dashboard" sub={`Your organisation at a glance · ${today}`} />

      <KpiTiles items={[
        { label: 'Total learners',    value: loading ? '—' : learnerCount, icon: KitIcon.users,
          hint: newLearnersThisMonth > 0 ? `↑ ${newLearnersThisMonth} this month` : 'In your organisation' },
        { label: 'Courses assigned',  value: loading ? '—' : coursesAssignedCount, icon: KitIcon.layers,
          hint: newCoursesThisMonth > 0 ? `↑ ${newCoursesThisMonth} new this month` : 'Across all learners' },
        { label: 'Completion rate',   value: loading ? '—' : `${completionRate}%`, icon: KitIcon.check,
          hint: 'Assigned courses completed' },
        { label: 'Credits remaining', value: loading ? '—' : creditsLeft, icon: KitIcon.coins, tone: creditsTone,
          hint: loading ? '' : `${creditsHint}${totalCredits > 0 ? ` · ${creditsPct}% left` : ''}` },
      ]} />

      <div className={s.twoCol}>
        <div className={s.leftCol}>
          <Card title="Course completion" sub="How much of each course your learners have completed, highest first."
            meta={courseCompletion.length > 0 && <Pill tone="neutral">{courseCompletion.length} course{courseCompletion.length !== 1 ? 's' : ''}</Pill>}>
            {courseCompletion.length === 0
              ? <p className={s.emptyText}>{loading ? 'Loading…' : 'No courses assigned to this organization yet.'}</p>
              : <CompletionBars rows={courseCompletion} />}
          </Card>

          <div className={s.performersGrid}>
            <Card title="Top performers" sub="Highest average quiz scores.">
              {topPerformers.length === 0 ? (
                <p className={s.emptyText}>{loading ? 'Loading…' : 'No quiz attempts yet.'}</p>
              ) : (
                <ol className={s.performerList}>
                  {topPerformers.map((p, i) => (
                    <Performer key={p.name + i} p={p} rank={i + 1} tone="good" badge={i === 0 ? '★ Top' : null} />
                  ))}
                </ol>
              )}
            </Card>

            <Card title="Needs attention" sub="Lowest average quiz scores — worth a check-in.">
              {bottomPerformers.length === 0 ? (
                <p className={s.emptyText}>
                  {loading ? 'Loading…' : topPerformers.length > 0
                    ? 'Not enough learners yet for a separate bottom-performer group.'
                    : 'No quiz attempts yet.'}
                </p>
              ) : (
                <ol className={s.performerList}>
                  {bottomPerformers.map((p, i) => {
                    const atRisk = Number(p.avgScore) < 40;
                    return (
                      <Performer key={p.name + i} p={p} rank={i + 1}
                        tone={atRisk ? 'bad' : 'warn'} badge={atRisk ? '⚠ At risk' : 'Struggling'} />
                    );
                  })}
                </ol>
              )}
            </Card>
          </div>
        </div>

        <Card title="Recent activity" sub="Latest quiz attempts by your learners." className={s.activityCard}>
          {activity.length === 0 ? (
            <p className={s.emptyText}>{loading ? 'Loading…' : 'No recent activity yet.'}</p>
          ) : (
            <ol className={s.activityList} tabIndex={0} aria-label="Recent activity">
              {activity.map((a, i) => {
                const passed = /\bpassed\b/i.test(a.text || '');
                return (
                  <li key={i} className={s.activityItem}>
                    <span className={`${s.activityDot} ${passed ? s.dotPassed : ''}`} aria-hidden="true">{passed ? '✓' : ''}</span>
                    <div className={s.activityBody}>
                      <div className={s.activityText}>{a.text}</div>
                      <div className={s.activityMeta}>
                        {passed && <span className={s.passedTag}>Passed · </span>}{fmtRelative(a.date)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
