'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';

/**
 * Ticked rows + "Delete Selected (N)" for a super admin list page.
 *
 * Only rows shown on the page count as selected (`visibleIds`), so changing a filter or
 * the page never deletes something the admin can no longer see. Deletes run one request
 * per row (the API has no bulk route); rows that fail stay ticked so they can be retried.
 *
 * A ticked row can stand for several records (e.g. one organization = all its course
 * assignments): pass `recordsOf(id)` returning the record ids to delete for that row. The
 * row counts as deleted only when all its records are; otherwise it stays ticked.
 *
 * @param {{ visibleIds: string[], deletePath: (recordId: string) => string,
 *           recordsOf?: (id: string) => string[],
 *           confirmMessage?: (count: number) => string,
 *           singular: string, plural: string, onDeleted: () => void }} options
 */
export default function useBulkDelete({ visibleIds, deletePath, recordsOf = id => [id], confirmMessage, singular, plural, onDeleted }) {
  const [ticked, setTicked] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const visible = new Set(visibleIds.map(String));
  const selected = ticked.filter(id => visible.has(id));
  const allSelected = visible.size > 0 && [...visible].every(id => ticked.includes(id));
  const noun = n => (n === 1 ? singular : plural);

  const isSelected = id => ticked.includes(String(id));
  const toggle = id => {
    const key = String(id);
    setTicked(prev => (prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]));
  };
  const toggleAll = () => {
    setTicked(prev => (allSelected
      ? prev.filter(id => !visible.has(id))
      : [...new Set([...prev, ...visible])]));
  };

  async function confirmDelete() {
    setConfirming(false);
    const ids = [...selected];
    if (!ids.length) return;
    setDeleting(true);
    const results = await Promise.all(ids.map(async id => {
      const settled = await Promise.allSettled(recordsOf(id).map(rec => apiServiceHandler('GET', deletePath(rec))));
      return settled.every(r => r.status === 'fulfilled');
    }));
    setDeleting(false);
    const failed = ids.filter((_, i) => !results[i]);
    const done = ids.length - failed.length;
    if (done) toast.error(`${done} ${noun(done)} deleted.`);
    if (failed.length) toast.warning(`${failed.length} ${noun(failed.length)} could not be deleted.`);
    setTicked(failed);
    onDeleted();
  }

  return {
    selected,
    allSelected,
    isSelected,
    toggle,
    toggleAll,
    deleting,
    askToDelete: () => { if (selected.length) setConfirming(true); },
    confirmProps: {
      show: confirming,
      title: `Delete Selected ${plural.replace(/^\w/, c => c.toUpperCase())}`,
      message: confirmMessage
        ? confirmMessage(selected.length)
        : `Delete ${selected.length} selected ${noun(selected.length)}? This cannot be undone.`,
      confirmLabel: 'Delete All',
      onConfirm: confirmDelete,
      onCancel: () => setConfirming(false),
    },
  };
}
