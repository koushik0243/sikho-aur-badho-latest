'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import { ResultCount } from '../AdminKit/ListParts';
import c from './CategoryTree.module.css';
import { orDash } from '../../../lib/displayValue';

const svg = (d, evenOdd = true) => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d={d} {...(evenOdd ? { fillRule: 'evenodd', clipRule: 'evenodd' } : {})} />
  </svg>
);
const Icon = {
  search: svg('M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z'),
  eye:    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" clipRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  edit:   svg('M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z', false),
  trash:  svg('M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z'),
  caret:  svg('M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'),
  folder: svg('M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z', false),
  tag:    svg('M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z'),
  layers: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M10 2L2 6l8 4 8-4-8-4zM2 10l8 4 8-4M2 14l8 4 8-4" /></svg>,
  grid:   svg('M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', false),
  plus:   svg('M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z'),
};

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildTree(items) {
  const map = {};
  items.forEach(item => (map[item._id] = { ...item, children: [] }));
  const roots = [];
  items.forEach(item => {
    if (item.parentId && map[item.parentId]) {
      map[item.parentId].children.push(map[item._id]);
    } else {
      roots.push(map[item._id]);
    }
  });
  return roots;
}

/** Depth-first rows; each row knows its ancestors (to hide it when one is collapsed) and child count. */
function flattenTree(nodes, depth = 0, ancestors = []) {
  const result = [];
  for (const node of nodes) {
    const { children, ...rest } = node;
    result.push({ ...rest, depth, ancestors, childCount: children.length });
    if (children.length) result.push(...flattenTree(children, depth + 1, [...ancestors, node._id]));
  }
  return result;
}

const LIMIT = 50;

export default function CategorySubcategoryList() {
  const router = useRouter();

  const [allItems, setAllItems]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [confirm, setConfirm]     = useState({ show: false, id: null, type: null });
  const [selected, setSelected]   = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  // Collapsed parent ids — their descendants are hidden in the tree view.
  const [collapsed, setCollapsed] = useState(() => new Set());

  const fetchItems = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiServiceHandler('GET', 'course-category/list-all'),
      apiServiceHandler('GET', 'course-subcategory/list'),
    ])
      .then(([catRes, subRes]) => {
        const cats = Array.isArray(catRes?.data) ? catRes.data : (Array.isArray(catRes) ? catRes : []);
        const subs = Array.isArray(subRes?.data) ? subRes.data : (Array.isArray(subRes) ? subRes : []);

        // Build a set of IDs already in course_category to avoid duplicates
        const catIds = new Set(cats.map(cat => String(cat._id)));

        const normalizedCats = cats.map(cat => ({
          _id: String(cat._id),
          name: cat.title,
          description: cat.desc,
          parentId: cat.parentId ? String(cat.parentId) : null,
          type: cat.parentId ? 'sub-category' : 'category',
          status: cat.status,
          createdAt: cat.createdAt,
          source: 'category',
        }));

        // Legacy sub-categories from course_subcategory (skip any whose categoryId no longer exists)
        const normalizedSubs = subs
          .filter(sub => !catIds.has(String(sub._id))) // skip if already represented
          .map(sub => {
            const pid = sub.categoryId?._id ?? sub.categoryId ?? null;
            return {
              _id: String(sub._id),
              name: sub.name,
              description: sub.description,
              parentId: pid ? String(pid) : null,
              type: 'sub-category',
              status: sub.status,
              createdAt: sub.createdAt,
              source: 'subcategory',
            };
          });

        setAllItems([...normalizedCats, ...normalizedSubs]);
      })
      .catch(() => setAllItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const nameById = useMemo(() => {
    const m = {};
    allItems.forEach(item => (m[item._id] = item.name));
    return m;
  }, [allItems]);

  const flatList = useMemo(() => flattenTree(buildTree(allItems)), [allItems]);

  const stats = useMemo(() => ({
    total: flatList.length,
    top: flatList.filter(i => i.depth === 0).length,
    sub: flatList.filter(i => i.depth > 0).length,
    levels: flatList.reduce((m, i) => Math.max(m, i.depth + 1), 0),
    inactive: flatList.filter(i => i.status !== 'active').length,
  }), [flatList]);
  const parentIds = useMemo(() => flatList.filter(i => i.childCount > 0).map(i => i._id), [flatList]);

  // Searching or sorting shows a flat list of every match; otherwise the tree honours collapsed parents.
  const treeMode = !search.trim() && !sortKey;

  const filtered = useMemo(() => {
    if (!search.trim()) return flatList;
    const q = search.toLowerCase();
    return flatList.filter(item =>
      (item.name ?? '').toLowerCase().includes(q) ||
      (item.description ?? '').toLowerCase().includes(q)
    );
  }, [flatList, search]);

  useEffect(() => { setPage(1); }, [sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortIcon(key) {
    if (sortKey !== key) return <span className={c.sortIcon} aria-hidden="true">↕</span>;
    return <span className={`${c.sortIcon} ${c.sortOn}`} aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }
  const ariaSort = key => (sortKey !== key ? 'none' : sortDir === 'asc' ? 'ascending' : 'descending');

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        if (sortKey === 'createdAt') {
          const av = new Date(a.createdAt).getTime() || 0;
          const bv = new Date(b.createdAt).getTime() || 0;
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        const av = String(a[sortKey] ?? '').toLowerCase();
        const bv = String(b[sortKey] ?? '').toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filtered;
  const visible = treeMode ? sorted.filter(item => !item.ancestors.some(id => collapsed.has(id))) : sorted;

  const totalPages = Math.max(1, Math.ceil(visible.length / LIMIT));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = visible.slice((clampedPage - 1) * LIMIT, clampedPage * LIMIT);

  const from = visible.length === 0 ? 0 : (clampedPage - 1) * LIMIT + 1;
  const to   = Math.min(clampedPage * LIMIT, visible.length);

  const toggleCollapse = id => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => { setCollapsed(new Set(parentIds)); setPage(1); };

  function handleDelete(id, type, source) { setConfirm({ show: true, id, type, source }); }
  function doDelete() {
    const { id, source } = confirm;
    setConfirm({ show: false, id: null, type: null, source: null });
    const endpoint = source === 'subcategory'
      ? `course-subcategory/delete/${id}`
      : `course-category/delete-tree/${id}`;
    apiServiceHandler('GET', endpoint)
      .then(() => { toast.error('Deleted successfully.'); fetchItems(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const allIds = pageItems.map(item => item._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    const itemMap = new Map(filtered.map(item => [item._id, item]));
    Promise.all(ids.map(id => {
      const item = itemMap.get(id);
      const endpoint = item?.source === 'subcategory'
        ? `course-subcategory/delete/${id}`
        : `course-category/delete-tree/${id}`;
      return apiServiceHandler('GET', endpoint);
    }))
      .then(() => { toast.error(`${ids.length} item${ids.length !== 1 ? 's' : ''} deleted.`); fetchItems(); })
      .catch(() => toast.warning('Some deletes failed'));
  }

  const viewUrl = item => (item.source === 'subcategory'
    ? `/superadmin/category-subcategory/${item._id}?type=sub-category`
    : `/superadmin/category-subcategory/${item._id}`);
  const editUrl = item => (item.source === 'subcategory'
    ? `/superadmin/category-subcategory/${item._id}/edit?type=sub-category`
    : `/superadmin/category-subcategory/${item._id}/edit`);

  const KPIS = [
    { key: 'total', icon: Icon.grid, label: 'Total', value: stats.total, hint: 'Categories and sub-categories' },
    { key: 'top', icon: Icon.folder, label: 'Top-level categories', value: stats.top, hint: 'No parent' },
    { key: 'sub', icon: Icon.tag, label: 'Sub-categories', value: stats.sub, hint: 'Under another category' },
    { key: 'levels', icon: Icon.layers, label: 'Deepest level', value: stats.levels, hint: stats.inactive ? `${stats.inactive} inactive` : 'All active' },
  ];

  return (
    <SuperAdminShell activeSection="category-subcategory">
      <ConfirmModal
        show={confirm.show}
        title="Delete Item"
        message="Are you sure you want to delete this category / sub-category? Deleting a parent will also remove its children."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Items"
        message={`Delete ${selected.length} selected item${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={c.page}>
        <header className={c.head}>
          <div>
            <span className={c.eyebrow}>Course catalogue</span>
            <h1 className={c.title}>Category / Sub-Category</h1>
            <p className={c.sub}>Manage multi-level categories and sub-categories</p>
          </div>
          <button type="button" className={c.btnAdd} onClick={() => router.push('/superadmin/category-subcategory/add')}>
            {Icon.plus} Add Category
          </button>
        </header>

        <section className={c.kpis} aria-label="Overview">
          {KPIS.map(k => (
            <div key={k.key} className={c.kpi}>
              <span className={c.kpiIcon}>{k.icon}</span>
              <div>
                <div className={c.kpiValue}>{loading ? '—' : k.value}</div>
                <div className={c.kpiLabel}>{k.label}</div>
                <div className={c.kpiHint}>{loading ? ' ' : k.hint}</div>
              </div>
            </div>
          ))}
        </section>

        <section className={c.card} aria-label="Categories">
          <div className={c.toolbar}>
            <label className={c.search}>
              {Icon.search}
              <span className={c.srOnly}>Search categories</span>
              <input
                type="search"
                placeholder="Search by name or description…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </label>
            <div className={c.toolRight}>
              {treeMode ? (
                <div className={c.treeBtns} role="group" aria-label="Tree">
                  <button type="button" className={c.ghostBtn} onClick={expandAll} disabled={collapsed.size === 0}>Expand all</button>
                  <button type="button" className={c.ghostBtn} onClick={collapseAll} disabled={parentIds.length === 0 || collapsed.size === parentIds.length}>Collapse all</button>
                </div>
              ) : (
                <span className={c.modeNote}>
                  {search.trim() ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}` : 'Sorted list'}
                  {sortKey && <button type="button" className={c.linkBtn} onClick={() => setSortKey('')}>Back to tree</button>}
                </span>
              )}
            </div>
          </div>


          <div className={c.tableWrap}>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.checkCol}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on this page" /></th>
                  <th aria-sort={ariaSort('name')}><button type="button" className={c.sortBtn} onClick={() => toggleSort('name')}>Name {sortIcon('name')}</button></th>
                  <th>Description</th>
                  <th>Parent</th>
                  <th>Status</th>
                  <th aria-sort={ariaSort('createdAt')}><button type="button" className={c.sortBtn} onClick={() => toggleSort('createdAt')}>Created {sortIcon('createdAt')}</button></th>
                  <th className={c.actionCol}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}><td colSpan={7}><div className={c.skeleton} /></td></tr>
                  ))
                ) : pageItems.length === 0 ? (
                  <tr><td colSpan={7} className={c.empty}>{search.trim() ? `No category matches “${search}”.` : 'No categories yet.'}</td></tr>
                ) : pageItems.map(item => {
                  const isSel = selected.includes(item._id);
                  const isOpen = !collapsed.has(item._id);
                  const indent = treeMode ? item.depth : 0;
                  return (
                    <tr key={item._id} className={`${c.row} ${isSel ? c.rowSel : ''} ${item.depth === 0 ? c.rowRoot : ''}`} onClick={() => toggleOne(item._id)}>
                      <td className={c.checkCol} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(item._id)} aria-label={`Select ${item.name ?? 'item'}`} />
                      </td>
                      <td>
                        <div className={c.nameCell} style={{ '--indent': indent }}>
                          {treeMode && Array.from({ length: indent }).map((_, i) => <span key={i} className={c.guide} aria-hidden="true" />)}
                          {treeMode && item.childCount > 0 ? (
                            <button type="button" className={`${c.caret} ${isOpen ? c.caretOpen : ''}`}
                              onClick={e => { e.stopPropagation(); toggleCollapse(item._id); }}
                              aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.name}`}>
                              {Icon.caret}
                            </button>
                          ) : <span className={c.caretSpace} aria-hidden="true" />}
                          <span className={`${c.nodeIcon} ${item.depth === 0 ? c.nodeRoot : ''}`}>{item.depth === 0 ? Icon.folder : Icon.tag}</span>
                          <button type="button" className={c.name} onClick={e => { e.stopPropagation(); router.push(viewUrl(item)); }}>
                            {orDash(item.name)}
                          </button>
                          {item.childCount > 0 && <span className={c.childCount} title={`${item.childCount} direct sub-categor${item.childCount === 1 ? 'y' : 'ies'}`}>{item.childCount}</span>}
                          <span className={c.level}>L{item.depth + 1}</span>
                        </div>
                      </td>
                      <td className={c.desc} title={item.description || undefined}>{item.description || <span className={c.muted}>—</span>}</td>
                      <td>{item.parentId && nameById[item.parentId] ? <span className={c.parent}>{nameById[item.parentId]}</span> : <span className={c.muted}>—</span>}</td>
                      <td>
                        <span className={`${c.status} ${item.status === 'active' ? c.statusOn : c.statusOff}`}>
                          {item.status === 'active' ? 'Active' : (item.status ? item.status[0].toUpperCase() + item.status.slice(1) : 'Inactive')}
                        </span>
                      </td>
                      <td className={c.date}>{fmtDate(item.createdAt)}</td>
                      <td className={c.actionCol}>
                        <div className={c.actions} onClick={e => e.stopPropagation()}>
                          <button data-action="view" type="button" className={c.iconBtn} title="View" aria-label={`View ${item.name}`} onClick={() => router.push(viewUrl(item))}>{Icon.eye}</button>
                          <button data-action="edit" type="button" className={c.iconBtn} title="Edit" aria-label={`Edit ${item.name}`} onClick={() => router.push(editUrl(item))}>{Icon.edit}</button>
                          <button data-action="delete" type="button" className={`${c.iconBtn} ${c.iconDanger}`} title="Delete" aria-label={`Delete ${item.name}`} onClick={() => handleDelete(item._id, item.type, item.source)}>{Icon.trash}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={c.footer}>
            <div className={c.footerLeft}>
              {selected.length > 0 && (
                <button type="button" data-bulk-action="delete" className={c.bulkDelete} onClick={handleBulkDelete}>{Icon.trash} Delete Selected ({selected.length})</button>
              )}
            <span className={c.footInfo} aria-live="polite">
              <ResultCount from={from} to={to} total={visible.length} singular="category" plural="categories" />
              {treeMode && collapsed.size > 0 && ` · ${sorted.length - visible.length} hidden in collapsed groups`}
            </span>
            </div>
            <nav className={c.pager} aria-label="Pages">
              <button type="button" className={c.pageBtn} disabled={clampedPage <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page">Previous</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} type="button" className={`${c.pageBtn} ${clampedPage === i + 1 ? c.pageOn : ''}`}
                  onClick={() => setPage(i + 1)} aria-current={clampedPage === i + 1 ? 'page' : undefined}>{i + 1}</button>
              ))}
              <button type="button" className={c.pageBtn} disabled={clampedPage >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Next page">Next</button>
            </nav>
          </div>
        </section>
      </div>
    </SuperAdminShell>
  );
}
