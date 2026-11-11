// Shared by the My Organization Employees page and its PDF export.

export const SEVERITY = {
  critical: { label: 'Critical', rgb: [185, 28, 28] },
  warning: { label: 'Warning', rgb: [180, 83, 9] },
  info: { label: 'Note', rgb: [75, 85, 99] },
};
export const ACTIVITY = {
  active: { label: 'Active', tone: 'ok', rgb: [21, 128, 61] },
  inactive: { label: 'Inactive', tone: 'info', rgb: [107, 114, 128] },
};
export const ACCOUNT_LABEL = { active: 'Active', inactive: 'Inactive', suspended: 'Suspended' };

export const EMPLOYEE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'alerts', label: 'With alerts' },
];
export const filterEmployees = (list, f) => list.filter(e => f === 'all' || (f === 'alerts' ? e.alerts.length > 0 : e.activity === f));

/** The rules in plain words. */
export const rulesText = (r) => [
  `Active = signed in or did any learning in the last ${r.ACTIVE_DAYS} days; otherwise inactive.`,
  `Pending = courses not completed yet (in progress, not started or stopped). Stopped = no learning on the course for ${r.ACTIVE_DAYS}+ days.`,
  `Critical alert: a stopped course, or inactive ${r.LONG_INACTIVE_DAYS}+ days with courses pending. Warning: inactive ${r.ACTIVE_DAYS}+ days with courses pending, no sign-in or learning recorded, or a course not started ${r.NOT_STARTED_DAYS}+ days after assignment.`,
];
