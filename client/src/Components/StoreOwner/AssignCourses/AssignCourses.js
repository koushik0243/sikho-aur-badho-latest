'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import pageStyles from "./AssignCourses.module.css";
import { withFormKit } from '../PageKit/PageKit';

// Page styles + the shared store owner form look.
const s = withFormKit(pageStyles);

// ── Icons ────────────────────────────────────────────────────────
const Icon = {
  trash:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
  email:    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>,
  search:   <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>,
};

const PAGE_SIZE = 50;

export default function AssignCoursesPage() {
  const user = useSelector(selectUser);

  const [learners,        setLearners]        = useState([]);
  const [courses,         setCourses]         = useState([]);
  const [assignments,     setAssignments]     = useState([]);
  const [selectedUserId,   setSelectedUserId]   = useState('');
  const [selectedCourseIds,setSelectedCourseIds]= useState(new Set());
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [courseSearch,    setCourseSearch]     = useState('');
  const courseDropdownRef = useRef(null);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [orgId,           setOrgId]           = useState(null);
  const [confirmId,       setConfirmId]       = useState(null);
  const [notifyMethod,    setNotifyMethod]    = useState('email');
  const [assignPage,      setAssignPage]      = useState(1);
  const [checked,         setChecked]         = useState(new Set());
  const [confirmBulk,     setConfirmBulk]     = useState(false);
  const [bulkDeleting,    setBulkDeleting]    = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [debouncedAssignmentSearch, setDebouncedAssignmentSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAssignmentSearch(assignmentSearch), 350);
    return () => clearTimeout(t);
  }, [assignmentSearch]);

  useEffect(() => { setAssignPage(1); }, [debouncedAssignmentSearch]);

  function getTokenUserId() {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload._id || null;
    } catch { return null; }
  }

  const loadAssignments = useCallback(async (effectiveOrgId) => {
    const res = await apiServiceHandler('GET', `course-assignment/list?organizationId=${effectiveOrgId}`);
    const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    setAssignments(list);
  }, []);

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
      if (!effectiveOrgId) { setLoading(false); return; }
      setOrgId(effectiveOrgId);

      const [learnersRes, coursesRes] = await Promise.all([
        apiServiceHandler('GET', `user/admin/list?orgId=${effectiveOrgId}&user_type=employee&orgRole=employee`),
        apiServiceHandler('GET', `organization-course/list?orgId=${effectiveOrgId}&status=active`),
      ]);

      const learnList = Array.isArray(learnersRes?.data) ? learnersRes.data
                      : Array.isArray(learnersRes) ? learnersRes : [];
      setLearners(learnList);

      const courseList = Array.isArray(coursesRes?.data) ? coursesRes.data
                       : Array.isArray(coursesRes) ? coursesRes : [];
      setCourses(courseList);

      await loadAssignments(effectiveOrgId);
    } catch {
      toast.warning('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.orgId, loadAssignments]);

  useEffect(() => { loadData(); }, [loadData]);

  // Close the course dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e) {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target)) {
        setCourseDropdownOpen(false);
        setCourseSearch('');
      }
    }
    if (courseDropdownOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [courseDropdownOpen]);

  // If the chosen learner already has some of the selected courses assigned
  // (e.g. after switching learners), drop just those from the selection.
  useEffect(() => {
    setSelectedCourseIds(prev => {
      if (prev.size === 0) return prev;
      const alreadyAssignedToUser = new Set(
        assignments
          .filter(a => String(a.userId?._id || a.userId) === selectedUserId)
          .map(a => String(a.courseId?._id || a.courseId))
      );
      const next = new Set([...prev].filter(cid => !alreadyAssignedToUser.has(cid)));
      return next.size === prev.size ? prev : next;
    });
  }, [selectedUserId, assignments]);

  function toggleCourseSelection(courseId) {
    setSelectedCourseIds(prev => {
      const next = new Set(prev);
      next.has(courseId) ? next.delete(courseId) : next.add(courseId);
      return next;
    });
  }

  const assignedCourseIdsForUser = new Set(
    assignments
      .filter(a => String(a.userId?._id || a.userId) === selectedUserId)
      .map(a => String(a.courseId?._id || a.courseId))
  );

  const filteredCourses = courseSearch
    ? courses.filter(c => {
        const title = (c.courseId?.title || '').toLowerCase();
        return title.includes(courseSearch.toLowerCase());
      })
    : courses;

  async function handleAssign() {
    if (!selectedUserId)              { toast.warning('Please select a learner');       return; }
    if (selectedCourseIds.size === 0) { toast.warning('Please select at least one course'); return; }

    // Duplicate check — skip any course already assigned to this learner
    const toAssign = [...selectedCourseIds].filter(cid => !assignedCourseIdsForUser.has(cid));
    const skippedCount = selectedCourseIds.size - toAssign.length;

    if (toAssign.length === 0) {
      const learnerName = learners.find(l => l._id === selectedUserId)?.name || 'This learner';
      toast.warning(`${learnerName} is already assigned to all the selected course(s)`);
      return;
    }

    setSaving(true);
    try {
      await Promise.all(toAssign.map(async (courseId) => {
        await apiServiceHandler('POST', 'course-assignment/create', {
          organizationId: orgId,
          userId:         selectedUserId,
          courseId,
        });

        // Log credit usage
        await apiServiceHandler('POST', 'credit-used/create', {
          orgId,
          learnerId: selectedUserId,
          courseId,
          status:   'active',
        });
      }));

      const successMsg = `${toAssign.length} course${toAssign.length > 1 ? 's' : ''} assigned — email notification sent`;
      toast.success(skippedCount > 0 ? `${successMsg}. ${skippedCount} already assigned (skipped).` : successMsg);

      setSelectedUserId('');
      setSelectedCourseIds(new Set());
      await loadAssignments(orgId);
    } catch {
      toast.warning('Failed to assign course(s)');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(assignmentId) {
    setConfirmId(null);
    try {
      await apiServiceHandler('GET', `course-assignment/delete/${assignmentId}`);
      setAssignments(prev => prev.filter(a => a._id !== assignmentId));
      setChecked(prev => { const next = new Set(prev); next.delete(assignmentId); return next; });
      toast.error('Assignment removed');
    } catch {
      toast.warning('Failed to remove assignment');
    }
  }

  async function handleBulkRemove() {
    const ids = [...checked];
    setBulkDeleting(true);
    setConfirmBulk(false);
    try {
      for (const id of ids) {
        await apiServiceHandler('GET', `course-assignment/delete/${id}`);
      }
      setAssignments(prev => prev.filter(a => !checked.has(a._id)));
      setChecked(new Set());
      setAssignPage(1);
      toast.error(`${ids.length} assignment${ids.length > 1 ? 's' : ''} removed`);
    } catch {
      toast.warning('Failed to remove some assignments');
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleLearnerCheck(group) {
    const ids = group.items.map(a => a._id);
    setChecked(prev => {
      const next = new Set(prev);
      const allOn = ids.every(id => next.has(id));
      allOn ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  }

  function toggleAll() {
    const idsOnPage = pagedLearnerGroups.flatMap(g => g.items.map(a => a._id));
    setChecked(prev => {
      const next = new Set(prev);
      const allOn = idsOnPage.every(id => next.has(id));
      allOn ? idsOnPage.forEach(id => next.delete(id)) : idsOnPage.forEach(id => next.add(id));
      return next;
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const filteredAssignments = debouncedAssignmentSearch
    ? assignments.filter(a => {
        const needle = debouncedAssignmentSearch.toLowerCase();
        const learnerText = `${a.userId?.name || ''} ${a.userId?.email || ''}`.toLowerCase();
        const courseText  = (a.courseId?.title || '').toLowerCase();
        const dateText    = formatDate(a.attemptedAt || a.createdAt).toLowerCase();
        return learnerText.includes(needle) || courseText.includes(needle) || dateText.includes(needle);
      })
    : assignments;

  // Group assignments by learner — one row per learner, all their courses shown together.
  const learnerGroups = [];
  const learnerGroupIndex = new Map();
  for (const a of filteredAssignments) {
    const learnerId = String(a.userId?._id || a.userId);
    let group = learnerGroupIndex.get(learnerId);
    if (!group) {
      group = {
        learnerId,
        learnerName: a.userId?.name || a.userId?.email || '—',
        items: [],
      };
      learnerGroupIndex.set(learnerId, group);
      learnerGroups.push(group);
    }
    group.items.push(a);
  }

  const totalLearnerPages  = Math.max(1, Math.ceil(learnerGroups.length / PAGE_SIZE));
  const pagedLearnerGroups = learnerGroups.slice((assignPage - 1) * PAGE_SIZE, assignPage * PAGE_SIZE);
  const idsOnPage          = pagedLearnerGroups.flatMap(g => g.items.map(a => a._id));
  const allPageChecked     = idsOnPage.length > 0 && idsOnPage.every(id => checked.has(id));

  return (
    <>
      {/* ── Assign form card ── */}
      <div className={s.formCard}>
        <div className={s.cardHead}><h2 className={s.cardTitle}>Assign Courses To Learners</h2></div>
        <div className={s.cardBody}>
        <div className={s.formRow}>
          {/* Assignee */}
          <div className={`${s.formGroup} ${s.formGroupWide}`}>
            <label className={s.formLabel}>Assignee</label>
            <div className={s.selectWrapper}>
              <select
                className={s.formSelect}
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                disabled={loading}
              >
                <option value="">
                  {loading ? 'Loading learners…' : learners.length === 0 ? 'No learners found' : 'Select Learner'}
                </option>
                {learners.map(l => (
                  <option key={l._id} value={l._id}>
                    {l.name || l.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Select Course(s) — multi-select */}
          <div className={`${s.formGroup} ${s.formGroupWide}`}>
            <label className={s.formLabel}>Select Course(s)</label>
            <div className={s.multiSelectWrapper} ref={courseDropdownRef}>
              <button
                type="button"
                className={s.multiSelectButton}
                onClick={() => setCourseDropdownOpen(o => !o)}
                disabled={loading || courses.length === 0}
              >
                <span className={s.multiSelectButtonText}>
                  {loading
                    ? 'Loading courses…'
                    : courses.length === 0
                      ? 'No courses available'
                      : selectedCourseIds.size === 0
                        ? 'Select Course(s)'
                        : `${selectedCourseIds.size} course${selectedCourseIds.size > 1 ? 's' : ''} selected`}
                </span>
                {/* Same chevron as every other dropdown (globals.css) */}
                <svg className={s.multiSelectChevron} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {courseDropdownOpen && (
                <div className={s.multiSelectPanel}>
                  <div className={s.multiSelectSearchWrap}>
                    {Icon.search}
                    <input
                      type="text"
                      className={s.multiSelectSearchInput}
                      placeholder="Search courses…"
                      value={courseSearch}
                      onChange={e => setCourseSearch(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  {filteredCourses.length === 0 ? (
                    <div className={s.multiSelectEmpty}>No courses match your search.</div>
                  ) : filteredCourses.map(c => {
                    const courseId  = String(c.courseId?._id || c.courseId);
                    const title     = c.courseId?.title || courseId;
                    const isAssigned = assignedCourseIdsForUser.has(courseId);
                    const isChecked  = isAssigned || selectedCourseIds.has(courseId);
                    return (
                      <label
                        key={courseId}
                        className={`${s.multiSelectOption} ${isAssigned ? s.multiSelectOptionDisabled : ''}`}
                      >
                        <input
                          type="checkbox"
                          className={s.checkInput}
                          checked={isChecked}
                          disabled={isAssigned}
                          onChange={() => toggleCourseSelection(courseId)}
                        />
                        <span className={s.multiSelectOptionText}>{title}</span>
                        {isAssigned && <span className={s.multiSelectBadge}>Already Assigned</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Notify */}
          <div className={s.formGroup}>
            <label className={s.formLabel}>Notify Learners Via</label>
            <div className={s.notifyToggle}>
              <button
                className={`${s.notifyOption} ${notifyMethod === 'email' ? s.notifyOptionActive : ''}`}
                type="button"
                onClick={() => setNotifyMethod('email')}
              >
                <span className={s.notifyIcon}>{Icon.email}</span>
                Email
              </button>
            </div>
          </div>
        </div>

        {/* Assign button */}
        <div className={s.assignBtnWrap}>
          <button
            className={s.btnAssign}
            onClick={handleAssign}
            disabled={saving || loading}
          >
            {saving
              ? 'Assigning…'
              : selectedCourseIds.size > 1 ? `Assign ${selectedCourseIds.size} Courses` : 'Assign Course'}
          </button>
        </div>
        </div>
      </div>

      {/* ── Current Assignments ── */}
      <div className={s.tableCard}>
        <div className={s.cardHead}>
          <h3 className={s.cardTitle}>Current Assignments</h3>
          <div className={s.searchWrap}>
            {Icon.search}
            <input
              type="text"
              className={s.searchInput}
              placeholder="Search by learner, course or date…"
              value={assignmentSearch}
              onChange={e => setAssignmentSearch(e.target.value)}
            />
          </div>
        </div>
        <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.thCheck}>
                <input type="checkbox" className={s.checkInput} checked={allPageChecked} onChange={toggleAll} />
              </th>
              <th className={s.th}>#</th>
              <th className={s.th}>Learner</th>
              <th className={s.th}>Course</th>
              <th className={s.th}>Assigned On</th>
              <th className={s.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className={s.tr}>
                  <td className={s.td} colSpan={6}><div className={s.skeletonRow} /></td>
                </tr>
              ))
            ) : learnerGroups.length === 0 ? (
              <tr className={s.tr}>
                <td className={s.td} colSpan={6} style={{ textAlign: 'center', color: '#9aadad', padding: '24px 0' }}>
                  {assignments.length === 0 ? 'No assignments yet' : 'No assignments match your search.'}
                </td>
              </tr>
            ) : pagedLearnerGroups.flatMap((group, gi) => {
              const groupIds = group.items.map(a => a._id);
              const isGroupChecked = groupIds.every(id => checked.has(id));
              const serial = (assignPage - 1) * PAGE_SIZE + gi + 1;
              const stripe = gi % 2 !== 0 ? s.trAlt : '';

              return group.items.map((a, ci) => (
                <tr
                  key={a._id}
                  className={`${stripe} ${ci > 0 ? s.subRow : ''} ${isGroupChecked ? s.trChecked : ''}`}
                >
                  {ci === 0 && (
                    <>
                      <td className={s.tdCheck} rowSpan={group.items.length} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className={s.checkInput} checked={isGroupChecked} onChange={() => toggleLearnerCheck(group)} />
                      </td>
                      <td className={s.td} rowSpan={group.items.length}>{serial}</td>
                      <td className={s.td} rowSpan={group.items.length}>
                        <div className={s.cellMain}>{group.learnerName}</div>
                      </td>
                    </>
                  )}
                  <td className={s.td}>{a.courseId?.title || '—'}</td>
                  <td className={s.td}>{formatDate(a.attemptedAt || a.createdAt)}</td>
                  <td className={s.tdAction}>
                    <button data-action="delete" className={s.trashBtn} title="Remove assignment" onClick={() => setConfirmId(a._id)}>
                      {Icon.trash}
                    </button>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
        </div>
        {!loading && (() => {
          const totalPages = totalLearnerPages;
          const from = learnerGroups.length === 0 ? 0 : (assignPage - 1) * PAGE_SIZE + 1;
          const to   = Math.min(assignPage * PAGE_SIZE, learnerGroups.length);
          return (
            <div className={s.pagination}>
              <div className={s.paginationLeft}>
                {checked.size > 0 && (
                  <button
                    data-bulk-action="delete"
                    className={s.btnBulkDelete}
                    onClick={() => setConfirmBulk(true)}
                    disabled={bulkDeleting}
                  >
                    Delete Selected ({checked.size})
                  </button>
                )}
                <span className={s.paginationInfo}>Showing {from}–{to} of {learnerGroups.length} learner{learnerGroups.length !== 1 ? 's' : ''}</span>
              </div>
              <div className={s.paginationBtns}>
                <button className={s.pageBtn} onClick={() => setAssignPage(p => Math.max(1, p - 1))} disabled={assignPage <= 1}>Previous</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`${s.pageBtn} ${p === assignPage ? s.pageBtnActive : ''}`} onClick={() => setAssignPage(p)}>{p}</button>
                ))}
                <button className={s.pageBtn} onClick={() => setAssignPage(p => Math.min(totalPages, p + 1))} disabled={assignPage >= totalPages}>Next</button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Bulk delete confirm dialog ── */}
      {confirmBulk && (
        <div className={s.modalOverlay} onClick={() => setConfirmBulk(false)}>
          <div className={s.modalBox} onClick={e => e.stopPropagation()}>
            <div className={s.modalTitle}>Remove {checked.size} Assignment{checked.size > 1 ? 's' : ''}</div>
            <p className={s.modalBody}>
              Are you sure you want to remove {checked.size} selected assignment{checked.size > 1 ? 's' : ''}?
              This action cannot be undone.
            </p>
            <div className={s.modalActions}>
              <button className={s.modalBtnCancel} onClick={() => setConfirmBulk(false)} disabled={bulkDeleting}>
                Cancel
              </button>
              <button className={s.modalBtnDelete} onClick={handleBulkRemove} disabled={bulkDeleting}>
                {bulkDeleting ? 'Removing…' : `Remove (${checked.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete dialog ── */}
      {confirmId && (() => {
        const a = assignments.find(x => x._id === confirmId);
        return (
          <div className={s.modalOverlay} onClick={() => setConfirmId(null)}>
            <div className={s.modalBox} onClick={e => e.stopPropagation()}>
              <div className={s.modalTitle}>Remove Assignment</div>
              <p className={s.modalBody}>
                Remove <strong>{a?.courseId?.title || 'this course'}</strong> from{' '}
                <strong>{a?.userId?.name || a?.userId?.email || 'this learner'}</strong>?
                <br/>This action cannot be undone.
              </p>
              <div className={s.modalActions}>
                <button className={s.modalBtnCancel} onClick={() => setConfirmId(null)}>Cancel</button>
                <button className={s.modalBtnDelete} onClick={() => handleRemove(confirmId)}>Remove</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
