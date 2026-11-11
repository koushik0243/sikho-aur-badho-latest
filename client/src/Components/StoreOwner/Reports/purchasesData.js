// Shared by the Purchases page and its PDF export.

export const ORDER_STATUS = { success: 'Paid', pending: 'Pending', failed: 'Failed', canceled: 'Canceled', refunded: 'Refunded' };
export const PAYMENT_STATUS = { paid: 'Paid', pending: 'Pending', failed: 'Failed', refunded: 'Refunded' };
export const STATUS_TONE = { success: 'ok', paid: 'ok', pending: 'warning', failed: 'critical', canceled: 'info', refunded: 'info' };

/** 'manual' → 'Manual', 'net_banking' → 'Net banking'. */
export const methodLabel = (v) => (v ? String(v).replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '—');

export const RULES_TEXT = [
  'Credits bought = each credit pack\'s credit limit (as on the Credits page). One credit is used each time a course is assigned to a learner.',
  'Remaining = all credits bought − all credits used, as of today. The period filters the lists below, not the balance.',
  'Amount paid = successful orders. Each paid order should have an invoice; any without one is listed.',
];
