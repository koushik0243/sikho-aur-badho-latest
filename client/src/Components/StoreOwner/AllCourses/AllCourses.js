'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import s from "./AllCourses.module.css";
import StoreCourseCard from '../CourseTile/StoreCourseCard';

// Same icon set as Components/StoreOwner/MyCourses/MyCourses.js, for visual parity.
const Icon = {
  check:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
};

function getTokenUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('adminToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload._id || null;
  } catch { return null; }
}

const PAGE_SIZE = 12;

export default function AllCoursesPage() {
  const user = useSelector(selectUser);

  const [orgId, setOrgId]                   = useState(null);
  const [courses, setCourses]               = useState([]);
  const [addedIds, setAddedIds]             = useState(new Set());
  const [addingId, setAddingId]             = useState(null);
  const [categories, setCategories]         = useState([]);
  const [subCategories, setSubCategories]   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [page, setPage]                     = useState(1);

  const [searchName, setSearchName]           = useState('');
  const [levelFilter, setLevelFilter]         = useState('');
  const [selectedCatIds, setSelectedCatIds]   = useState(new Set());
  const [selectedSubIds, setSelectedSubIds]   = useState(new Set());
  const [catDropOpen, setCatDropOpen]         = useState(false);
  const [catSearch, setCatSearch]             = useState('');
  const catDropRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let effectiveOrgId = user?.orgId ? String(user.orgId) : null;
      if (!effectiveOrgId) {
        const uid = user?._id || getTokenUserId();
        if (uid) {
          const r = await apiServiceHandler('GET', `user/admin/edit/${uid}`);
          const rec = r?.data ?? r;
          if (rec?.orgId) effectiveOrgId = String(rec.orgId);
        }
      }
      setOrgId(effectiveOrgId);

      const [courseRes, ocRes, catRes, subRes] = await Promise.all([
        apiServiceHandler('GET', 'course/list?status=published'),
        effectiveOrgId
          ? apiServiceHandler('GET', `organization-course/list?orgId=${effectiveOrgId}`).catch(() => null)
          : Promise.resolve(null),
        apiServiceHandler('GET', 'course-category/list').catch(() => null),
        apiServiceHandler('GET', 'course-subcategory/list').catch(() => null),
      ]);

      const allCourses = Array.isArray(courseRes?.data) ? courseRes.data : (Array.isArray(courseRes) ? courseRes : []);
      setCourses(allCourses);

      const orgCourses = Array.isArray(ocRes?.data) ? ocRes.data : (Array.isArray(ocRes) ? ocRes : []);
      const ids = new Set(
        orgCourses
          .map(oc => oc.courseId?._id ? String(oc.courseId._id) : (oc.courseId ? String(oc.courseId) : null))
          .filter(Boolean)
      );
      setAddedIds(ids);

      const catList = Array.isArray(catRes?.data) ? catRes.data : (Array.isArray(catRes) ? catRes : []);
      const subList = Array.isArray(subRes?.data) ? subRes.data : (Array.isArray(subRes) ? subRes : []);
      setCategories(catList);
      setSubCategories(subList);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (catDropRef.current && !catDropRef.current.contains(e.target)) {
        setCatDropOpen(false);
        setCatSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleCat(id) {
    const sid = String(id);
    setSelectedCatIds(prev => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
    setPage(1);
  }

  function toggleSubCat(id) {
    const sid = String(id);
    setSelectedSubIds(prev => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
    setPage(1);
  }

  function clearFilters() {
    setSearchName('');
    setLevelFilter('');
    setSelectedCatIds(new Set());
    setSelectedSubIds(new Set());
    setPage(1);
  }

  const hasActiveFilters = searchName || levelFilter || selectedCatIds.size > 0 || selectedSubIds.size > 0;

  const filteredCourses = courses.filter(c => {
    if (searchName) {
      const title = (c.title || '').toLowerCase();
      if (!title.includes(searchName.toLowerCase())) return false;
    }
    if (levelFilter) {
      if ((c.level || '').toLowerCase() !== levelFilter.toLowerCase()) return false;
    }
    if (selectedCatIds.size > 0) {
      const cat = c.catId?._id ? String(c.catId._id) : (c.catId ? String(c.catId) : '');
      if (!selectedCatIds.has(cat)) return false;
    }
    if (selectedSubIds.size > 0) {
      const sub = c.subCatId?._id ? String(c.subCatId._id) : (c.subCatId ? String(c.subCatId) : '');
      if (!selectedSubIds.has(sub)) return false;
    }
    return true;
  });

  const total         = courses.length;
  const addedCount    = courses.filter(c => addedIds.has(String(c._id))).length;
  const availableCount = total - addedCount;

  const STATS = [
    { icon: 'courses', label: 'Total Courses', value: total },
    { icon: 'check',   label: 'Added',         value: addedCount },
    { icon: 'folder',  label: 'Available',     value: availableCount },
  ];

  // Adding a course to the org's account is free — there's no credit or payment step
  // here (unlike organization-credit-assignment, which is the paid flow elsewhere).
  async function handleAdd(course) {
    const courseId = String(course._id);
    if (!orgId) { toast.warning('Organisation not found.'); return; }
    setAddingId(courseId);
    try {
      await apiServiceHandler('POST', 'organization-course/create', {
        orgId, courseId, status: 'active',
      });
      setAddedIds(prev => new Set(prev).add(courseId));
      toast.success(`"${course.title}" added to your courses.`);
    } catch (err) {
      toast.warning(err?.message || 'Could not add this course. Please try again.');
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className={s.card}>
      {/* ── Header ── */}
      <div className={s.cardHead}>
        <h1 className={s.pageTitle}>
          All Courses
          {!loading && total > 0 && <span className={s.countPill}>{total}</span>}
        </h1>
      </div>

      {/* ── Stats bar ── */}
      <div className={s.statsBar}>
        {STATS.map(st => (
          <div key={st.label} className={s.statItem}>
            <div className={s.statIconWrap}>{Icon[st.icon]}</div>
            <div className={s.statBody}>
              <div className={s.statValue}>{loading ? '—' : st.value}</div>
              <div className={s.statLabel}>{st.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className={s.filterBar}>
        {/* Name search */}
        <div className={s.filterSearch}>
          <svg className={s.filterSearchIcon} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            className={s.filterInput}
            type="text"
            placeholder="Search by name…"
            value={searchName}
            onChange={e => { setSearchName(e.target.value); setPage(1); }}
          />
          {searchName && (
            <button className={s.filterClearBtn} onClick={() => { setSearchName(''); setPage(1); }}>×</button>
          )}
        </div>

        {/* Difficulty level */}
        <div className={s.levelBtnGroup}>
          {['Beginner', 'Intermediate', 'Advanced'].map(lvl => (
            <button
              key={lvl}
              type="button"
              className={`${s.levelBtn} ${levelFilter === lvl ? s.levelBtnActive : ''}`}
              onClick={() => { setLevelFilter(prev => prev === lvl ? '' : lvl); setPage(1); }}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Category / Sub-category multi-select */}
        <div className={s.catDropWrap} ref={catDropRef}>
          <button
            className={`${s.catDropTrigger} ${catDropOpen ? s.catDropTriggerOpen : ''}`}
            onClick={() => setCatDropOpen(v => !v)}
            type="button"
          >
            <span>
              {selectedCatIds.size === 0 && selectedSubIds.size === 0
                ? 'All Categories'
                : `${selectedCatIds.size + selectedSubIds.size} selected`}
            </span>
            <svg viewBox="0 0 20 20" fill="currentColor" className={s.catDropArrow}>
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {catDropOpen && (
            <div className={s.catDropMenu}>
              {/* Search inside dropdown */}
              <div className={s.catDropSearch}>
                <svg viewBox="0 0 20 20" fill="currentColor" className={s.catDropSearchIcon}>
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  className={s.catDropSearchInput}
                  placeholder="Search categories…"
                  value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  autoFocus
                />
                {catSearch && (
                  <button className={s.catDropSearchClear} onClick={() => setCatSearch('')} type="button">×</button>
                )}
              </div>

              {/* List */}
              <div className={s.catDropList}>
                {(() => {
                  const q = catSearch.toLowerCase();
                  const visible = categories.map(cat => {
                    const catId = String(cat._id);
                    const catName = cat.title || cat.name || '';
                    const subs = subCategories.filter(sc => {
                      const parentId = sc.categoryId?._id
                        ? String(sc.categoryId._id)
                        : (sc.categoryId ? String(sc.categoryId) : '');
                      return parentId === catId;
                    });
                    const catMatches = catName.toLowerCase().includes(q);
                    const matchingSubs = q
                      ? subs.filter(sc => (sc.name || sc.title || '').toLowerCase().includes(q))
                      : subs;
                    if (!catMatches && matchingSubs.length === 0) return null;
                    return { cat, catId, catName, subs: catMatches ? subs : matchingSubs };
                  }).filter(Boolean);

                  if (visible.length === 0) {
                    return <div className={s.catDropEmpty}>No results for "{catSearch}"</div>;
                  }

                  return visible.map(({ catId, catName, subs }) => (
                    <div key={catId} className={s.catGroup}>
                      <label className={`${s.catLabel} ${selectedCatIds.has(catId) ? s.catLabelChecked : ''}`}>
                        <input
                          type="checkbox"
                          className={s.checkInput}
                          checked={selectedCatIds.has(catId)}
                          onChange={() => toggleCat(catId)}
                        />
                        <span>{catName}</span>
                      </label>
                      {subs.map(sc => {
                        const scId = String(sc._id);
                        return (
                          <label key={scId} className={`${s.subCatLabel} ${selectedSubIds.has(scId) ? s.subCatLabelChecked : ''}`}>
                            <input
                              type="checkbox"
                              className={s.checkInput}
                              checked={selectedSubIds.has(scId)}
                              onChange={() => toggleSubCat(scId)}
                            />
                            <span>{sc.name || sc.title || scId}</span>
                          </label>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button className={s.filterClearAll} onClick={clearFilters} type="button">
            Clear all
          </button>
        )}
      </div>

      {/* ── Course grid ── */}
      <div className={s.courseGridWrap}>
        {loading ? (
          <div className={s.courseGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={s.skeletonCard} />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className={s.empty}>
            {courses.length === 0 ? 'No published courses available right now.' : 'No courses match your filters.'}
          </div>
        ) : (
          <div className={s.courseGrid} role="list" aria-label="All courses">
            {filteredCourses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(c => {
              const cId = String(c._id);
              const isAdding = addingId === cId;
              return (
                <StoreCourseCard
                  key={cId}
                  course={c}
                  action={addedIds.has(cId)
                    ? { label: '✓ Added', done: true }
                    : { label: isAdding ? 'Adding…' : 'Add', onClick: () => handleAdd(c), disabled: isAdding }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && (() => {
        const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));
        const from = filteredCourses.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
        const to   = Math.min(page * PAGE_SIZE, filteredCourses.length);
        return (
          <div className={s.pagination}>
            <span className={s.paginationInfo}>Showing {from}–{to} of {filteredCourses.length}</span>
            <div className={s.paginationBtns}>
              <button className={s.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className={s.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
