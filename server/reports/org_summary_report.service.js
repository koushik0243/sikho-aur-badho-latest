import { ACTIVITY_COUNTS_FILTER } from '../topic_activity/topic_activity.model.js';
import mongoose from 'mongoose';
import { getOrgProgressReport } from './org_progress_report.service.js';
import { pct, avg } from './report_stats.js';

const { ObjectId } = mongoose.Types;
const oid = (v) => String(v || '');
const TOP = 3;

/** Performance = average of course progress and average best quiz score (when quizzes were taken). */
const performanceOf = (progress, quizScore) => (quizScore === null ? progress : Math.round((progress + quizScore) / 2));

/**
 * Store summary: completion %, best / weak performers, Zoom sessions attended
 * and homework done — per employee and per session.
 * @param {{ orgId: string, courseId?: string }} filters
 */
export async function getOrgSummaryReport({ orgId, courseId }) {
  const db = mongoose.connection.db;
  const progress = await getOrgProgressReport({ orgId, courseId });
  const { enrollments, chapterRows } = progress;

  // ── Per employee ──────────────────────────────────────
  const people = new Map();
  for (const e of enrollments) {
    const p = people.get(e.learnerId) || { learnerId: e.learnerId, name: e.name, email: e.email, courses: 0, completed: 0, certificates: 0, progress: [], scores: [], quizPassed: 0, quizFailed: 0, homework: 0, homeworkDone: 0, zoom: 0, zoomDone: 0 };
    p.courses += 1;
    if (e.status === 'completed') p.completed += 1;
    if (e.phases.completion.certificate) p.certificates += 1;
    p.progress.push(e.progress);
    p.quizPassed += e.quizPassed; p.quizFailed += e.quizFailed;
    people.set(e.learnerId, p);
  }
  for (const c of chapterRows) {
    const p = people.get(c.learnerId);
    if (!p) continue;
    if (c.bestScore !== null) p.scores.push(c.bestScore);
    p.homework += c.homework; p.homeworkDone += c.homeworkDone;
    p.zoom += c.zoom; p.zoomDone += c.zoomDone;
  }
  const employees = [...people.values()].map(p => {
    const avgProgress = Math.round(avg(p.progress) ?? 0);
    const quizScore = p.scores.length ? Math.round(avg(p.scores)) : null;
    return {
      learnerId: p.learnerId, name: p.name, email: p.email,
      courses: p.courses, completed: p.completed, completionRate: pct(p.completed, p.courses), certificates: p.certificates,
      avgProgress, quizScore, quizPassed: p.quizPassed, quizFailed: p.quizFailed,
      homework: p.homework, homeworkDone: p.homeworkDone, homeworkRate: pct(p.homeworkDone, p.homework),
      zoom: p.zoom, zoomDone: p.zoomDone, zoomRate: pct(p.zoomDone, p.zoom),
      performance: performanceOf(avgProgress, quizScore),
    };
  }).sort((a, b) => b.performance - a.performance || b.completed - a.completed || a.name.localeCompare(b.name))
    .map((e, i) => ({ ...e, rank: i + 1 }));

  // Best = top performers with some progress; weak = the lowest of the rest (never the same person twice).
  const best = employees.filter(e => e.performance > 0).slice(0, TOP);
  const bestIds = new Set(best.map(e => e.learnerId));
  const weak = employees.filter(e => !bestIds.has(e.learnerId)).slice(-TOP).reverse();
  const reasonsOf = (e) => {
    const r = [];
    if (e.quizScore !== null && e.quizScore < 40) r.push(`quiz score ${e.quizScore}%`);
    if (e.quizFailed > 0) r.push(`${e.quizFailed} quiz${e.quizFailed === 1 ? '' : 'zes'} failed`);
    if (e.homework > e.homeworkDone) r.push(`${e.homework - e.homeworkDone} homework pending`);
    if (e.zoom > e.zoomDone) r.push(`${e.zoom - e.zoomDone} Zoom missed`);
    return r;
  };

  // ── Per session: Zoom + homework, one row per enrolled employee ──
  const courseIds = [...new Set(enrollments.map(e => e.courseId))].map(id => new ObjectId(id));
  const userIds = [...people.keys()].map(id => new ObjectId(id));
  const liveChapters = new Map(chapterRows.map(c => [c.chapterId, c])); // live chapters of the enrolled courses
  const [topics, activities] = await Promise.all([
    db.collection('topics').find({ courseId: { $in: courseIds }, deletedAt: null, video_type: { $in: ['zoom_link', 'assignment'] } })
      .project({ courseId: 1, chapterId: 1, title: 1, video_type: 1, zoom_time: 1, scheduled_at: 1, start_time: 1, order: 1 }).toArray(),
    db.collection('topic_activities').find({ userId: { $in: userIds }, courseId: { $in: courseIds }, ...ACTIVITY_COUNTS_FILTER }).project({ userId: 1, topicId: 1, createdAt: 1 }).toArray(),
  ]);
  const doneAt = new Map(activities.map(a => [`${a.userId}|${a.topicId}`, a.createdAt]));
  const sessions = [];
  for (const t of topics) {
    const ch = liveChapters.get(oid(t.chapterId));
    if (!ch) continue; // deleted / inactive chapter
    for (const e of enrollments.filter(x => x.courseId === oid(t.courseId))) {
      const at = doneAt.get(`${e.learnerId}|${t._id}`) || null;
      sessions.push({
        type: t.video_type === 'zoom_link' ? 'zoom' : 'homework',
        topicId: oid(t._id), title: t.title || 'Untitled', course: e.course, chapter: ch.chapter, chapterOrder: ch.order,
        scheduledAt: t.zoom_time || t.scheduled_at || t.start_time || null,
        learnerId: e.learnerId, name: e.name, email: e.email, done: Boolean(at), doneAt: at,
      });
    }
  }
  sessions.sort((a, b) => a.course.localeCompare(b.course) || a.chapterOrder - b.chapterOrder || a.title.localeCompare(b.title) || a.name.localeCompare(b.name));
  const zoomRows = sessions.filter(s => s.type === 'zoom');
  const homeworkRows = sessions.filter(s => s.type === 'homework');
  const bySession = (rows) => {
    const m = new Map();
    rows.forEach(r => {
      const g = m.get(r.topicId) || { topicId: r.topicId, title: r.title, course: r.course, chapter: r.chapter, chapterOrder: r.chapterOrder, scheduledAt: r.scheduledAt, enrolled: 0, done: 0, missing: [] };
      g.enrolled += 1;
      if (r.done) g.done += 1; else g.missing.push(r.name);
      m.set(r.topicId, g);
    });
    return [...m.values()].map(g => ({ ...g, rate: pct(g.done, g.enrolled) }));
  };

  const sum = (f) => employees.reduce((s, e) => s + e[f], 0);
  const t = progress.totals;
  return {
    filters: { courseId: courseId || null },
    options: { courses: progress.options.courses },
    totals: {
      employees: employees.length,
      staff: progress.options.employees.length,
      enrollments: t.enrollments,
      completed: t.completed,
      completionRate: pct(t.completed, t.enrollments),
      avgProgress: t.avgProgress,
      chapters: t.chapters, chaptersDone: t.chaptersDone, chapterRate: pct(t.chaptersDone, t.chapters),
      certificates: t.certificates,
      homework: homeworkRows.length,
      homeworkDone: homeworkRows.filter(r => r.done).length,
      homeworkRate: pct(homeworkRows.filter(r => r.done).length, homeworkRows.length),
      zoom: zoomRows.length,
      zoomDone: zoomRows.filter(r => r.done).length,
      zoomRate: pct(zoomRows.filter(r => r.done).length, zoomRows.length),
      quizPassed: sum('quizPassed'), quizFailed: sum('quizFailed'),
    },
    phaseSummary: progress.phaseSummary,
    employees,
    best,
    weak: weak.map(e => ({ ...e, reasons: reasonsOf(e) })),
    zoomSessions: bySession(zoomRows),
    homeworkItems: bySession(homeworkRows),
    zoomRows,
    homeworkRows,
    generatedAt: new Date(),
  };
}
