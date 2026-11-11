import ak from './AdminKit.module.css';

/**
 * A super admin page's own CSS module with the shared super admin look layered on top
 * (header, buttons, cards, tables, pills, pagination, forms, view rows). Each kit class
 * is added next to the page's class of the same name and wins through doubled selectors.
 * Usage: `const s = withAdminKit(pageStyles)`.
 */
export function withAdminKit(styles) {
  const merged = { ...styles };
  for (const [key, cls] of Object.entries(ak)) merged[key] = styles[key] ? `${styles[key]} ${cls}` : cls;
  return merged;
}
