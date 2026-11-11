// Shared by the Store Owner report page and its PDF export.

export const RANKINGS = [
  { value: 'revenue', label: 'Revenue', valueOf: o => o.revenue },
  { value: 'learners', label: 'Learners', valueOf: o => o.learners },
  { value: 'courses', label: 'Courses', valueOf: o => o.courses },
];
export const TOP_N = 10;
export const ORG_STATUS_LABEL = { active: 'Active', inactive: 'Inactive', suspended: 'Suspended', deleted: 'Deleted' };

export const locationOf = (o) => [o.city, o.state].filter(Boolean).join(', ') || 'Not specified';

/** Top N organizations by the chosen measure (ties: revenue, then name). */
export function topOrganizations(organizations, rankBy) {
  const rank = RANKINGS.find(r => r.value === rankBy) || RANKINGS[0];
  return [...organizations]
    .sort((a, b) => rank.valueOf(b) - rank.valueOf(a) || b.revenue - a.revenue || a.name.localeCompare(b.name))
    .slice(0, TOP_N);
}
