'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectAuthReady, selectIsAuthenticated, clearAuth } from '../../redux/slices/authSlice';
import useIdleLogout from '../../hooks/useIdleLogout';
import s from "./LearnerShell.module.css";

// ── Section / nav data ──────────────────────────────────────────
const SECTIONS = [
  {
    id: 'mylearning', label: 'My Learning',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zm5.99 7.176A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" /></svg>,
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/learner/dashboard', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
      { id: 'courses',   label: 'Courses',   path: '/learner/courses',   icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z" /></svg> },
    ],
  },
  // {
  //   id: 'results', label: 'Results',
  //   icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
  //   items: [
  //     { id: 'quiz', label: 'Quiz Result', path: '/learner/quiz', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> },
  //   ],
  // },
  {
    id: 'assessments', label: 'Assessments',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
    items: [
      { id: 'aptitude-results', label: 'Aptitude Results', path: '/learner/aptitude-results', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> },
    ],
  },
  {
    id: 'engage', label: 'Engage',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" /></svg>,
    items: [
      { id: 'certificate', label: 'Certificate', path: '/learner/certificate', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" /></svg> },
      { id: 'profile',     label: 'My Profile',  path: '/learner/profile',     icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg> },
    ],
  },
  {
    id: 'report', label: 'Report',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" /></svg>,
    // Report pages aren't built yet — these items have no path (no navigation).
    items: [
      { id: 'report-progress', label: 'Progress', path: '/learner/reports/progress', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" /></svg> },
      { id: 'report-test-results', label: 'Test Results', path: '/learner/reports/test-results', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> },
      { id: 'report-achievements', label: 'Achievements', path: '/learner/reports/achievements', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg> },
      { id: 'report-weak-areas', label: 'Weak Areas', path: '/learner/reports/weak-areas', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap(sec => sec.items).filter(i => i.path); // pages only

function getActiveSectionFromPath(pathname) {
  const item = ALL_ITEMS.find(i => pathname === i.path || pathname.startsWith(i.path + '/'));
  if (!item) return SECTIONS[0];
  return SECTIONS.find(sec => sec.items.some(i => i.id === item.id)) || SECTIONS[0];
}

function getActiveLabelFromPath(pathname) {
  const item = ALL_ITEMS.find(i => pathname === i.path || pathname.startsWith(i.path + '/'));
  // Pages not in the menu (e.g. Quiz Results, reached from a course) keep their own name.
  if (!item && pathname.startsWith('/learner/quiz')) return 'Quiz Results';
  return item?.label || 'Dashboard';
}

// ── Icons ───────────────────────────────────────────────────────
const Icon = {
  bell:        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-2-2h4a2 2 0 01-2 2z" /></svg>,
  help:        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>,
  logout:      <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>,
  chevronLeft: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>,
  menu: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
  close: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
};

export default function LearnerShell({ children }) {
  const user          = useSelector(selectUser);
  const authReady     = useSelector(selectAuthReady);
  const isAuthed      = useSelector(selectIsAuthenticated);
  const dispatch = useDispatch();
  const router   = useRouter();
  const pathname = usePathname();
  useIdleLogout();

  // Actual gate: once rehydration has run and there's still no valid session (never
  // logged in, or rehydrateAuth rejected a stale/expired token), stop rendering this
  // portal and bounce to login instead of silently showing an empty shell.
  useEffect(() => {
    if (authReady && !isAuthed) router.replace('/login');
  }, [authReady, isAuthed, router]);

  const activeSection = getActiveSectionFromPath(pathname);
  const activeItemId  = ALL_ITEMS.find(i => pathname === i.path || pathname.startsWith(i.path + '/'))?.id || 'dashboard';
  const pageLabel     = getActiveLabelFromPath(pathname);

  const [openSection, setOpenSection] = useState(() => activeSection);
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Redux's auth rehydration (from localStorage) can complete before this component's
  // own hydration pass reaches it, so `user` may already differ from what the server
  // rendered (which always sees a logged-out/null user). Gate the real name behind a
  // mount flag so both the server and the client's FIRST paint agree on the fallback,
  // then swap to the real name in an effect — a normal post-hydration update, not a mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (sessionStorage.getItem('learnerSidebarOpen') === 'true') setPanelOpen(true);
  }, []);

  useEffect(() => {
    setOpenSection(activeSection);
  }, [pathname]);

  // ── Notifications ───────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifications, setNotifications] = useState([
    { id: 1, time: '1d' }, { id: 2, time: '1d' }, { id: 3, time: '1d' },
  ]);

  useEffect(() => {
    function handler(e) { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); }
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // ── User menu ────────────────────────────────────────────────
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handler(e) { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); }
    if (userMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  // A super admin opened this tab with "Log in" (public/tab-session.js keeps it per tab).
  const impersonation = mounted && typeof window !== 'undefined' ? window.__tabSession?.info() : null;
  function exitImpersonation() {
    window.__tabSession?.exit();
    window.close(); // tabs opened by the Log in icon can close themselves
    window.location.href = '/superadmin/organization-user-assignment'; // if the browser kept it open
  }

  function handleLogout() {
    dispatch(clearAuth());
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('BHARAT_TOKEN');
    }
    router.replace('/login');
  }

  const userName = mounted ? (user?.name || user?.email || 'Learner') : 'Learner';
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  function openSec(sec) {
    setOpenSection(sec);
    setPanelOpen(true);
    sessionStorage.setItem('learnerSidebarOpen', 'true');
  }

  function closePanel() {
    setPanelOpen(false);
    sessionStorage.setItem('learnerSidebarOpen', 'false');
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    setPanelOpen(false);
    sessionStorage.setItem('learnerSidebarOpen', 'false');
  }

  function toggleMobileMenu() {
    if (mobileMenuOpen) {
      closeMobileMenu();
    } else {
      setMobileMenuOpen(true);
      setPanelOpen(true);
      sessionStorage.setItem('learnerSidebarOpen', 'true');
    }
  }

  return (
    <div className={s.shell}>

      {/* ── Sidebar ── */}
      <aside className={`${s.sidebar}${mobileMenuOpen ? ` ${s.sidebarMobileOpen}` : ''}`}>
        {/* Icon strip */}
        <div className={s.iconStrip}>
          {SECTIONS.map(sec => (
            <button key={sec.id}
                    className={`${s.stripBtn} ${openSection.id === sec.id && panelOpen ? s.stripBtnActive : ''}`}
                    onClick={() => openSec(sec)}
                    title={sec.label}>
              <span className={s.stripIcon}>{sec.icon}</span>
            </button>
          ))}
          <div className={s.stripSpacer} />
          <button className={s.stripBtn}
                  onClick={handleLogout}
                  title="Logout">
            <span className={s.stripIcon}>{Icon.logout}</span>
          </button>
        </div>

        {/* Nav panel */}
        <div className={`${s.navPanel}${!panelOpen ? ` ${s.navPanelHidden}` : ''}`}>
          <div className={s.navPanelHeader}>
            <button className={s.backBtn} title="Collapse" onClick={closeMobileMenu}>
              <span className={s.backBtnIcon}>{Icon.chevronLeft}</span>
            </button>
            <span className={s.navPanelTitle}>{openSection.label}</span>
          </div>
          <div className={s.navList}>
            {openSection.items.map(item => (
              <button key={item.id}
                      className={`${s.navItem} ${activeItemId === item.id ? s.navItemActive : ''}`}
                      // Items without a path (Report) are placeholders: no navigation.
                      onClick={() => { if (!item.path) return; router.push(item.path); setMobileMenuOpen(false); }}
                      title={item.path ? undefined : 'Coming soon'}>
                <span className={s.navItemIcon}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Mobile nav-panel backdrop ── */}
      {mobileMenuOpen && (
        <div className={s.backdrop} onClick={closeMobileMenu} />
      )}

      {/* Logged in from super admin (this tab only) */}
      {impersonation && !impersonation.pending && (
        <div className={s.impBar} role="status">
          <span className={s.impDot} aria-hidden="true" />
          <span>Logged in as <strong>{impersonation.name || userName}</strong> (learner{impersonation.orgName ? ` · ${impersonation.orgName}` : ''}) from super admin</span>
          <button type="button" className={s.impExit} onClick={exitImpersonation}>Exit</button>
        </div>
      )}

      {/* ── Topbar ── */}
      <header className={s.topbar}>
        <div className={s.topbarLeft}>
          <button
            className={s.hamburgerBtn}
            title={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={toggleMobileMenu}
          >
            {mobileMenuOpen ? Icon.close : Icon.menu}
          </button>
          <div className={s.topbarLogo}>
            <img src="/logo.png" alt="sikhoaurbadho" className={s.logoImg} />
          </div>
          <div className={s.breadcrumb}>
            Learner / <strong>{pageLabel}</strong>
          </div>
        </div>
        <div className={s.topbarActions}>
          <button className={s.topbarBtn} title="Help">{Icon.help}</button>

          {/* Notifications */}
          <div className={s.notifWrapper} ref={notifRef}>
            <button className={s.topbarBtn} title="Notifications"
                    onClick={() => setNotifOpen(o => !o)}>
              {Icon.bell}
              {notifications.length > 0 && (
                <span className={s.notifBadge}>{notifications.length}</span>
              )}
            </button>
            {notifOpen && (
              <div className={s.notifDropdown}>
                <div className={s.notifHeader}>
                  <div>
                    <div className={s.notifTitle}>Notifications</div>
                    <div className={s.notifSubtitle}>Total Numbers of Notifications</div>
                  </div>
                  <button className={s.notifClearAll} onClick={() => setNotifications([])}>Clear All</button>
                </div>
                <div className={s.notifList}>
                  {notifications.length === 0 ? (
                    <div className={s.notifEmpty}>No notifications</div>
                  ) : notifications.map(n => (
                    <div key={n.id} className={s.notifItem}>
                      <span className={s.notifItemIcon}>{Icon.bell}</span>
                      <span className={s.notifItemText}>Lorem Ipsum is <strong>simply dummy text</strong> of the printing...</span>
                      <span className={s.notifItemTime}>{n.time}</span>
                      <button className={s.notifItemMenu} title="Dismiss"
                              onClick={() => setNotifications(p => p.filter(x => x.id !== n.id))}>···</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className={s.userMenuWrapper} ref={userMenuRef}>
            <button className={s.avatarBtn} title={userName}
                    onClick={() => setUserMenuOpen(o => !o)}>
              {initials}
            </button>
            {userMenuOpen && (
              <div className={s.userMenuDropdown}>
                <div className={s.userMenuHeader}>
                  <div className={s.userMenuAvatar}>{initials}</div>
                  <div className={s.userMenuInfo}>
                    <div className={s.userMenuName}>{userName}</div>
                    {user?.email && <div className={s.userMenuEmail}>{user.email}</div>}
                  </div>
                </div>
                <div className={s.userMenuDivider} />
                <button className={s.userMenuLogout} onClick={handleLogout}>
                  <span className={s.userMenuLogoutIcon}>{Icon.logout}</span>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className={`${s.main}${panelOpen ? ` ${s.mainExpanded}` : ''}`}>
        <div className={s.content}>
          {children}
        </div>
      </div>

    </div>
  );
}
