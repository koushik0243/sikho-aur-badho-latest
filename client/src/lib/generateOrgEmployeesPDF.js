import { dateLabel, ymdLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { TRAINEE_STATUS } from '../Components/SuperAdmin/Reports/traineeData';
import { SEVERITY, ACTIVITY, ACCOUNT_LABEL, rulesText } from '../Components/StoreOwner/Reports/orgEmployeesData';
import { createReportPdf } from './reportPdf';

const GREEN = [21, 128, 61], GRAY = [156, 163, 175], TEAL = [13, 148, 136], RED = [185, 28, 28];
const SEV_RGB = new Map(Object.values(SEVERITY).map(v => [v.label, v.rgb]));
const ACT_RGB = new Map(Object.values(ACTIVITY).map(v => [v.label, v.rgb]));
const statusLabel = st => (st === 'dropout' ? 'Stopped' : TRAINEE_STATUS[st]?.label || st);
const dateTime = v => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'Not recorded');

/**
 * Downloads the My Organization Employees report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /org-report/employees
 * @param {{ periodText: string }} opts
 */
export async function generateOrgEmployeesPDF(report, { periodText }) {
  const pdf = await createReportPdf({
    title: 'My Organization Employees',
    subtitle: `${report.organization}   |   courses enrolled ${periodText}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, `Active = learning or sign-in in ${report.rules.ACTIVE_DAYS} days`],
  });
  const t = report.totals;
  const loginNote = report.loginTrackingSince ? `Sign-ins are recorded from ${ymdLabel(report.loginTrackingSince)}.` : 'Sign-ins are recorded from now on.';

  pdf.tiles([
    ['Employees', `${t.employees} (${t.active} active)`],
    ['Enrolled courses', String(t.enrollments)],
    ['Completed / pending', `${t.completed} / ${t.pending}`],
    ['Certificates', String(t.certificates)],
  ]);
  pdf.note(`The period filters enrolled courses and certificates; the employee list, last login and activity are always current. ${loginNote}`);

  pdf.section('Active / inactive employees', 46);
  pdf.splitBar([{ label: 'Active', value: t.active, rgb: GREEN }, { label: 'Inactive', value: t.inactive, rgb: GRAY }], `Learning or signed in, last ${report.rules.ACTIVE_DAYS} days`);
  pdf.splitBar([{ label: 'Active', value: t.accountActive, rgb: GREEN }, { label: 'Inactive / suspended', value: t.accountInactive, rgb: GRAY }], 'Account status');

  pdf.section('Course status', 30);
  pdf.splitBar([
    { label: 'Completed', value: t.completed, rgb: GREEN }, { label: 'In progress', value: t.inProgress, rgb: TEAL },
    { label: 'Not started', value: t.notStarted, rgb: GRAY }, { label: 'Stopped', value: t.dropout, rgb: RED },
  ]);

  pdf.section(`Alerts (${t.alerts}, ${t.criticalAlerts} critical)`);
  pdf.table(
    [{ label: 'Level', width: 20, color: v => SEV_RGB.get(v) }, { label: 'Employee', width: 50, wrap: true }, { label: 'Alert', wrap: true }],
    report.alerts.map(a => [SEVERITY[a.severity].label, a.email ? `${a.name} (${a.email})` : a.name, a.text]),
    'No alerts - every employee is on track.',
  );

  pdf.section('Employees');
  pdf.table(
    [{ label: 'Employee', width: 34, wrap: true }, { label: 'Account', width: 17 }, { label: 'Activity', width: 17, color: v => ACT_RGB.get(v) },
      { label: 'Last login', width: 27, wrap: true }, { label: 'Last active', width: 22 }, { label: 'Enrolled', width: 18, align: 'right' },
      { label: 'Done', width: 12, align: 'right' }, { label: 'Pending', width: 16, align: 'right' }, { label: 'Certs', align: 'right' }],
    report.employees.map(e => [e.name, ACCOUNT_LABEL[e.accountStatus] || e.accountStatus, ACTIVITY[e.activity].label, dateTime(e.lastLoginAt),
      e.lastActive ? dateLabel(e.lastActive) : 'Never', String(e.enrolled), String(e.completed), String(e.pending), String(e.certificates)]),
    'No employees yet.',
  );
  pdf.note(`Last login = the last sign-in. Last active = the latest sign-in or learning. ${loginNote}`);

  pdf.section('Enrolled list');
  pdf.table(
    [{ label: 'Employee', width: 37, wrap: true }, { label: 'Course', width: 41, wrap: true }, { label: 'Enrolled', width: 22 }, { label: 'Progress', width: 18, align: 'right' },
      { label: 'Status', width: 20 }, { label: 'Completed', width: 22 }, { label: 'Certificate' }],
    report.enrollments.map(r => [r.name, r.course, dateLabel(r.enrolledAt), `${r.progress}%`, statusLabel(r.status), r.completedAt ? dateLabel(r.completedAt) : '-', r.certificate ? 'Issued' : '-']),
    'No courses enrolled in this period.',
  );

  pdf.section('Certificates');
  pdf.table(
    [{ label: 'Employee', width: 60 }, { label: 'Course', width: 80, wrap: true }, { label: 'Issued' }],
    report.certificates.map(c => [c.name, c.course, dateLabel(c.issuedAt)]),
    'No certificates issued in this period.',
  );

  pdf.section('How status and alerts are decided', 24);
  pdf.note(rulesText(report.rules).map(x => `- ${x}`).join('\n'));

  pdf.save(`my-organization-employees_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
