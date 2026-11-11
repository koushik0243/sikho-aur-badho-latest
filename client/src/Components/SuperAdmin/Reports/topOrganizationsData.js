// Shared by the Top Organizations page and its PDF export.

export const VIP_STATUS = {
  active: { label: 'Active', rgb: [21, 128, 61], sev: 'ok' },
  cooling: { label: 'Cooling', rgb: [180, 83, 9], sev: 'warning' },
  at_risk: { label: 'At risk', rgb: [185, 28, 28], sev: 'critical' },
};

/** The VIP rules in plain words. */
export const vipRuleText = (r) => `VIP = the top ${r.VIP_SHARE}% of paying organizations by lifetime spend (at least 1, at most ${r.VIP_MAX}), whatever period is selected. `
  + `Status from the last order: Active within ${r.ACTIVE_DAYS} days, Cooling within ${r.AT_RISK_DAYS} days, At risk after that.`;

export const daysAgo = (n) => (n === 0 ? 'today' : `${n} day${n === 1 ? '' : 's'} ago`);
