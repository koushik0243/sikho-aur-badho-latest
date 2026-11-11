'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import sPage from "./IndustryTypeTree.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const SearchIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);

function buildTree(items) {
  const map = {};
  items.forEach(item => { map[String(item._id)] = { ...item, children: [] }; });
  const roots = [];
  items.forEach(item => {
    const pid = item.parentId ? String(item.parentId?._id ?? item.parentId) : null;
    if (pid && map[pid]) {
      map[pid].children.push(map[String(item._id)]);
    } else {
      roots.push(map[String(item._id)]);
    }
  });
  return roots;
}

function TreeNode({ node, selectedIds, onToggle, expanded, onExpand }) {
  const tid = String(node._id);
  const hasKids = node.children && node.children.length > 0;
  const isOpen = expanded.has(tid);

  return (
    <div className={s.treeNode}>
      <div className={s.treeRow}>
        {hasKids ? (
          <button
            type="button"
            className={`${s.treeArrow} ${isOpen ? s.treeArrowOpen : ''}`}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
            onClick={() => onExpand(tid)}
          >
            ▶
          </button>
        ) : (
          <span className={s.treeArrowGap} />
        )}
        <label className={s.treeRowLabel}>
          <input
            type="checkbox"
            checked={selectedIds.includes(tid)}
            onChange={() => onToggle(tid)}
          />
          <span>{node.name}</span>
        </label>
      </div>
      {hasKids && isOpen && (
        <div className={s.treeKids}>
          {node.children.map(child => (
            <TreeNode
              key={child._id}
              node={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              expanded={expanded}
              onExpand={onExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** listHeight — max height (px) of the scrolling list; defaults to the stylesheet's 120px. */
export default function IndustryTypeTree({ industryTypes, setIndustryTypes, selectedIds, setSelectedIds, allowAdd = true, listHeight }) {
  const [search, setSearch]           = useState('');
  const [expanded, setExpanded]       = useState(new Set());
  const [addOpen, setAddOpen]         = useState(false);
  const [addName, setAddName]         = useState('');
  const [addParentId, setAddParentId] = useState('');
  const [adding, setAdding]           = useState(false);

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelect(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  const lc       = search.toLowerCase();
  const filtered = search ? industryTypes.filter(t => (t.name || '').toLowerCase().includes(lc)) : null;
  const tree     = filtered ? null : buildTree(industryTypes);

  async function handleAdd() {
    const name = addName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const payload = { name };
      if (addParentId) payload.parentId = addParentId;
      const res = await apiServiceHandler('POST', 'industry-type/create', payload);
      const created = res?.data ?? res;
      if (created?._id) setIndustryTypes(prev => [...prev, created]);
      setAddName('');
      setAddParentId('');
      setAddOpen(false);
      toast.success('Industry type added.');
    } catch {
      toast.warning('Failed to add industry type.');
    } finally {
      setAdding(false);
    }
  }

  function cancelAdd() {
    setAddOpen(false);
    setAddName('');
    setAddParentId('');
  }

  /* ── When add form is open, collapse tree and show only the form ── */
  if (addOpen) {
    return (
      <div className={s.itWidget}>
        <div className={s.itAddForm}>
          <input
            className={s.itAddInput}
            type="text"
            placeholder="Category name"
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            autoFocus
          />
          <select
            className={s.itAddSelect}
            value={addParentId}
            onChange={e => setAddParentId(e.target.value)}
          >
            <option value="">Select parent</option>
            {industryTypes.map(t => (
              <option key={t._id} value={String(t._id)}>{t.name}</option>
            ))}
          </select>
          <div className={s.itAddActions}>
            <button type="button" className={s.itBtnCancel} onClick={cancelAdd}>
              Cancel
            </button>
            <button type="button" className={s.itBtnOk} onClick={handleAdd} disabled={adding}>
              {adding ? '…' : 'Ok'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Normal state: search + tree + "+ Add" ── */
  return (
    <div className={s.itWidget}>
      <div className={s.itSearchRow}>
        <span className={s.itSearchIcon}>{SearchIcon}</span>
        <input
          className={s.itSearchInput}
          type="text"
          placeholder="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className={s.itList} style={listHeight ? { maxHeight: listHeight } : undefined}>
        {industryTypes.length === 0 ? (
          <p className={s.itEmpty}>No industry types available.</p>
        ) : filtered ? (
          filtered.length === 0
            ? <p className={s.itEmpty}>No matches.</p>
            : filtered.map(t => {
                const tid = String(t._id);
                return (
                  <label key={tid} className={s.itFlatRow}>
                    <input type="checkbox" checked={selectedIds.includes(tid)} onChange={() => toggleSelect(tid)} />
                    <span>{t.name}</span>
                  </label>
                );
              })
        ) : (
          tree.map(node => (
            <TreeNode
              key={node._id}
              node={node}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
              expanded={expanded}
              onExpand={toggleExpand}
            />
          ))
        )}
      </div>

      {allowAdd && (
        <button type="button" className={s.itAddBtn} onClick={() => setAddOpen(true)}>
          + Add
        </button>
      )}
    </div>
  );
}
