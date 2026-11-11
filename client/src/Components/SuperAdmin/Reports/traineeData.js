// Shared by the Trainees report page and its PDF export.

export const TRAINEE_STATUS = {
  completed: { label: 'Completed', rgb: [21, 128, 61] },
  in_progress: { label: 'In progress', rgb: [13, 148, 136] },
  not_started: { label: 'Not started', rgb: [156, 163, 175] },
  dropout: { label: 'Dropout', rgb: [185, 28, 28] },
};
export const STATUS_KEYS = ['completed', 'in_progress', 'not_started', 'dropout'];

export const statusCount = (totals, key) => ({
  completed: totals.completed, in_progress: totals.inProgress, not_started: totals.notStarted, dropout: totals.dropout,
}[key]);

/** '82%' or '—' when there's nothing to measure. */
export const percentText = (v) => (v === null || v === undefined ? '—' : `${v}%`);
