'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, useReport, PeriodFields, ReportTable, SplitBar, Badge } from '../../SuperAdmin/Reports/ReportParts';
import { dateLabel, ymdLabel, periodText } from '../../SuperAdmin/Reports/reportFormat';
import { TRAINEE_STATUS } from '../../SuperAdmin/Reports/traineeData';
import { SEVERITY, ACTIVITY, ACCOUNT_LABEL, EMPLOYEE_FILTERS, filterEmployees, rulesText } from './orgEmployeesData';
import s from '../../SuperAdmin/Reports/Report.module.css';

const PAGE_SIZE = 20;

/** Time of day in India time, e.g. "12:22 pm". */
const timeOf = (v) => new Date(v).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

const Person = ({ p }) => (
  <><span className={s.nameCell}>{p.name}</span>{(p.email || p.empId) && <span className={s.subText}>{[p.empId, p.email].filter(Boolean).join(' · ')}</span>}</>
);

export default function OrgEmployeesReport() {
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState('all');
  const state = useReport('employees', {}, 'all', 'org-report');
  const { range, customInvalid, report, loading, error } = state;
  const periodDesc = periodText(range.from, range.to);

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateOrgEmployeesPDF } = await import('../../../lib/generateOrgEmployeesPDF');
      await generateOrgEmployeesPDF(report, { periodText: periodDesc });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const employees = report ? filterEmployees(report.employees, filter) : [];
  const loginNote = report?.loginTrackingSince ? `Sign-ins are recorded from ${ymdLabel(report.loginTrackingSince)}.` : 'Sign-ins are recorded from now on.';

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>My Organization Employees</h1>
          <p className={s.subtitle}>{report?.organization || 'My organization'} · courses enrolled {periodDesc}</p>
        </div>
        <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
          <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
        </button>
      </header>

      <div className={s.filters} role="group" aria-label="Report filters">
        <PeriodFields state={state} label="Enrolled" />
      </div>
      {customInvalid && <p className={s.errorText}>The start date must be on or before the end date.</p>}
      {error && <p className={s.errorText}>{error}</p>}

      {loading && !report ? <p className={s.empty}>Loading employees…</p> : report && (
        <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
          <div>
            <section className={s.tiles} aria-label="Summary">
              <div className={`${s.tile} ${s.tileHero} ${t.criticalAlerts > 0 ? s.tileAlert : ''}`}>
                <span className={s.tileLabel}>Employees</span>
                <span className={s.heroValue}>{t.employees} <small className={s.tileSub}>{t.active} active · {t.inactive} inactive</small></span>
              </div>
              <div className={s.tile}><span className={s.tileLabel}>Enrolled courses</span><span className={s.tileValue}>{t.enrollments} <small className={s.tileSub}>{t.enrolledEmployees} employees</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Completed / pending</span><span className={s.tileValue}>{t.completed} <small className={s.tileSub}>/ {t.pending} pending</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Certificates</span><span className={s.tileValue}>{t.certificates} <small className={s.tileSub}>{t.alerts} alert{t.alerts === 1 ? '' : 's'}</small></span></div>
            </section>
            <p className={s.statusLine}>The period filters enrolled courses and certificates; the employee list, last login and activity are always current. {loginNote}</p>
          </div>

          <div className={s.twoCol}>
            <section className={s.card} aria-labelledby="act-h">
              <h2 id="act-h" className={s.cardTitle}>Active / inactive employees</h2>
              <h3 className={s.miniTitle}>Learning or signed in, last {report.rules.ACTIVE_DAYS} days</h3>
              <SplitBar label="Employee activity" parts={[
                { label: 'Active', value: t.active, className: s.st_completed },
                { label: 'Inactive', value: t.inactive, className: s.st_not_started },
              ]} />
              <h3 className={s.miniTitle}>Account status</h3>
              <SplitBar label="Account status" parts={[
                { label: 'Active', value: t.accountActive, className: s.st_completed },
                { label: 'Inactive / suspended', value: t.accountInactive, className: s.st_not_started },
              ]} />
            </section>
            <section className={s.card} aria-labelledby="cs-h">
              <h2 id="cs-h" className={s.cardTitle}>Course status</h2>
              <p className={s.cardHint}>{t.enrollments} enrolled course{t.enrollments === 1 ? '' : 's'} · {t.completed} completed · {t.pending} pending</p>
              <SplitBar label="Course status" parts={[
                { label: 'Completed', value: t.completed, className: s.st_completed },
                { label: 'In progress', value: t.inProgress, className: s.st_in_progress },
                { label: 'Not started', value: t.notStarted, className: s.st_not_started },
                { label: 'Stopped', value: t.dropout, className: s.st_dropout },
              ]} />
            </section>
          </div>

          <ReportTable id="al-h" title="Alerts" rows={report.alerts} rowKey={(r, i) => `${r.learnerId}-${i}`} pageSize={PAGE_SIZE}
            empty="No alerts — every employee is on track."
            actions={t.alerts > 0 && <span className={s.cardHint}>{t.criticalAlerts} critical</span>}
            columns={[
              { label: 'Level', render: r => <Badge tone={r.severity} label={SEVERITY[r.severity].label} /> },
              { label: 'Employee', render: r => <Person p={r} /> },
              { label: 'Alert', render: r => r.text },
            ]} />

          <ReportTable id="em-h" title="Employees" rows={employees} rowKey={r => r.learnerId} pageSize={PAGE_SIZE}
            empty="No employees match this filter."
            actions={(
              <div className={s.chips} role="group" aria-label="Show employees">
                {EMPLOYEE_FILTERS.map(f => (
                  <button key={f.value} type="button" className={s.chipBtn} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                    {f.label} {filterEmployees(report.employees, f.value).length}
                  </button>
                ))}
              </div>
            )}
            columns={[
              { label: 'Employee', render: r => <Person p={r} /> },
              { label: 'Department', render: r => <>{r.department || '—'}{r.designation && <span className={s.subText}>{r.designation}</span>}</> },
              { label: 'Status', render: r => <><Badge tone={ACTIVITY[r.activity].tone} label={ACTIVITY[r.activity].label} /><span className={s.subText}>Account {(ACCOUNT_LABEL[r.accountStatus] || r.accountStatus).toLowerCase()}</span></> },
              { label: 'Last login', className: s.nowrap, render: r => (r.lastLoginAt ? <>{dateLabel(r.lastLoginAt)}<span className={s.subText}>{timeOf(r.lastLoginAt)}</span></> : <span className={s.subText}>Not recorded</span>) },
              { label: 'Last active', className: s.nowrap, render: r => (r.lastActive ? dateLabel(r.lastActive) : 'Never') },
              { label: 'Enrolled', align: 'right', render: r => r.enrolled },
              { label: 'Completed', align: 'right', render: r => r.completed },
              { label: 'Pending', align: 'right', render: r => r.pending },
              { label: 'Certs', align: 'right', render: r => r.certificates },
              { label: 'Alerts', align: 'right', render: r => (r.alerts.length ? <Badge tone={r.alerts[0].severity} label={String(r.alerts.length)} /> : '—') },
            ]}
            footer={<p className={s.note}>Last login = the last time the employee signed in. Last active = the latest sign-in or learning. {loginNote}</p>} />

          <ReportTable id="en-h" title="Enrolled list" rows={report.enrollments} rowKey={r => `${r.learnerId}-${r.courseId}`} pageSize={PAGE_SIZE}
            empty="No courses enrolled in this period."
            columns={[
              { label: 'Employee', render: r => <Person p={r} /> },
              { label: 'Course', render: r => r.course },
              { label: 'Enrolled on', className: s.nowrap, render: r => dateLabel(r.enrolledAt) },
              { label: 'Progress', align: 'right', render: r => `${r.progress}%` },
              { label: 'Status', render: r => <span className={`${s.status} ${s[`tstatus_${r.status}`] || ''}`}>{r.status === 'dropout' ? 'Stopped' : TRAINEE_STATUS[r.status]?.label || r.status}</span> },
              { label: 'Completed on', className: s.nowrap, render: r => (r.completedAt ? dateLabel(r.completedAt) : '—') },
              { label: 'Certificate', render: r => (r.certificate ? <Badge tone="ok" label="Issued" /> : '—') },
            ]} />

          <ReportTable id="ce-h" title="Certificates" rows={report.certificates} rowKey={(r, i) => i} pageSize={PAGE_SIZE}
            empty="No certificates issued in this period."
            columns={[
              { label: 'Employee', render: r => <Person p={r} /> },
              { label: 'Course', render: r => r.course },
              { label: 'Issued', className: s.nowrap, render: r => dateLabel(r.issuedAt) },
            ]} />

          <section className={s.card} aria-labelledby="ru-h">
            <h2 id="ru-h" className={s.cardTitle}>How status and alerts are decided</h2>
            <ul className={s.rulesList}>{rulesText(report.rules).map(x => <li key={x}>{x}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
