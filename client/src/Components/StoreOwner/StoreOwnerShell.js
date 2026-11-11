'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectAuthReady, selectIsAuthenticated, clearAuth } from '../../redux/slices/authSlice';
import useIdleLogout from '../../hooks/useIdleLogout';
import useStoreProfileGate from '../../hooks/useStoreProfileGate';
import s from "./StoreOwnerShell.module.css";

// ── Section / nav data ──────────────────────────────────────────
const SECTIONS = [
  {
    id: 'overview', label: 'Overview',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>,
    items: [
      { id: 'dashboard',     label: 'Dashboard',     path: '/storeowner/dashboard', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
      { id: 'store-profile', label: 'Store Profile', path: '/storeowner/profile',   icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 000 2h14a1 1 0 000-2H3zm-1 4a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm1 4a1 1 0 000 2h8a1 1 0 000-2H3z" /></svg> },
    ],
  },
  {
    id: 'learners', label: 'Learners',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM6.865 14c.41-1.135 1.53-2 2.635-2h1c1.105 0 2.226.865 2.635 2H6.865zM1 14a5.002 5.002 0 019-3h.001A5 5 0 0119 14v1H1v-1z" /></svg>,
    items: [
      { id: 'user-management', label: 'User Management', path: '/storeowner/users',          icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg> },
      { id: 'add-learner',     label: 'Add Learner',     path: '/storeowner/add-learner',    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6z" /><path d="M8 11a6 6 0 00-6 6h12a6 6 0 00-6-6z" /><path d="M16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" /></svg> },
      { id: 'assign-courses',  label: 'Assign Courses',  path: '/storeowner/assign-courses', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg> },
    ],
  },
  {
    id: 'content', label: 'Content',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z" /></svg>,
    items: [
      { id: 'all-courses', label: 'All Courses', path: '/storeowner/all-courses', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg> },
      { id: 'my-courses', label: 'My Courses', path: '/storeowner/my-courses', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z" /></svg> },
      { id: 'quiz-result', label: 'Quiz Result', path: '/storeowner/quiz-result', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> },
      { id: 'assignment-result', label: 'Assignment Result', path: '/storeowner/assignment-result', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg> },
      { id: 'course-certificate', label: 'Course Certificate', path: '/storeowner/course-certificate', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6.414A2 2 0 0015.414 5L13 2.586A2 2 0 0011.586 2H6zm4 12a2 2 0 100-4 2 2 0 000 4zm-1 1.5v3.5l1-1 1 1v-3.5a3.5 3.5 0 01-2 0z" clipRule="evenodd" /></svg> },
    ],
  },
  {
    id: 'analytics', label: 'Analytics',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-4a1 1 0 011-1h2a1 1 0 011 1v13a1 1 0 01-1 1h-2a1 1 0 01-1-1V3z" /></svg>,
    items: [
      { id: 'track-analysis', label: 'Track & Analysis', path: '/storeowner/track-analysis', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-4a1 1 0 011-1h2a1 1 0 011 1v13a1 1 0 01-1 1h-2a1 1 0 01-1-1V3z" /></svg> },
      { id: 'reports',        label: 'Reports',          path: '/storeowner/reports',        icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" /></svg> },
    ],
  },
  {
    id: 'report', label: 'Report',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" /></svg>,
    // Report pages aren't built yet — these items have no path (no navigation).
    items: [
      { id: 'report-employees', label: 'My Organization Employees', path: '/storeowner/reports/my-organization-employees', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg> },
      { id: 'report-employee-progress', label: 'Employee Progress', path: '/storeowner/reports/employee-progress', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" /></svg> },
      { id: 'report-test-results', label: 'Test Results', path: '/storeowner/reports/test-results', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> },
      { id: 'report-purchases', label: 'Purchases', path: '/storeowner/reports/purchases', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zm12 16a1 1 0 100-2 1 1 0 000 2zM7 17a1 1 0 100-2 1 1 0 000 2z" /></svg> },
      { id: 'report-summary', label: 'Summary', path: '/storeowner/reports/summary', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg> },
    ],
  },
  {
    id: 'account', label: 'Account',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>,
    items: [
      { id: 'subscription', label: 'Current Credit', path: '/storeowner/current-credits', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg> },
      { id: 'credits',      label: 'Credits Usage', path: '/storeowner/credits-usage', icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" /></svg> },
      { id: 'support',      label: 'Support',      path: '/storeowner/support',      icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-2 0c0 .993-.241 1.929-.668 2.754l-1.524-1.525a3.997 3.997 0 00.078-2.183l1.562-1.562C15.802 8.249 16 9.1 16 10zm-5.165 3.913l1.58 1.58A5.98 5.98 0 0110 16a5.976 5.976 0 01-2.516-.552l1.562-1.562a4.006 4.006 0 001.789.027zm-4.677-2.796a4.002 4.002 0 01-.041-2.08l-.08.08-1.53-1.533A5.98 5.98 0 004 10c0 .954.223 1.856.619 2.657l1.54-1.54zm1.088-6.45A5.974 5.974 0 0110 4c.954 0 1.856.223 2.657.619l-1.54 1.54a4.002 4.002 0 00-2.346.033L7.246 4.668z" clipRule="evenodd" /></svg> },
      { id: 'orders',       label: 'Orders',       path: '/storeowner/orders',       icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zm12 16a1 1 0 100-2 1 1 0 000 2zM7 17a1 1 0 100-2 1 1 0 000 2z" /></svg> },
      { id: 'invoices',     label: 'Invoices',     path: '/storeowner/invoices',     icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg> },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap(sec => sec.items).filter(i => i.path); // pages only

/** The menu item for a URL — the most specific path wins (/storeowner/reports/x over /storeowner/reports). */
function itemForPath(pathname) {
  return ALL_ITEMS
    .filter(i => pathname === i.path || pathname.startsWith(i.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

function getActiveSectionFromPath(pathname) {
  const item = itemForPath(pathname);
  if (!item) return SECTIONS[0];
  return SECTIONS.find(sec => sec.items.some(i => i.id === item.id)) || SECTIONS[0];
}

function getActiveLabelFromPath(pathname) {
  const item = itemForPath(pathname);
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

export default function StoreOwnerShell({ children }) {
  const user          = useSelector(selectUser);
  const authReady     = useSelector(selectAuthReady);
  const isAuthed      = useSelector(selectIsAuthenticated);
  const dispatch = useDispatch();
  const router   = useRouter();
  const pathname = usePathname();
  useIdleLogout();
  useStoreProfileGate();

  // Actual gate: once rehydration has run and there's still no valid session (never
  // logged in, or rehydrateAuth rejected a stale/expired token), stop rendering this
  // portal and bounce to login instead of silently showing an empty shell.
  useEffect(() => {
    if (authReady && !isAuthed) router.replace('/login');
  }, [authReady, isAuthed, router]);

  const activeSection  = getActiveSectionFromPath(pathname);
  const activeItemId   = itemForPath(pathname)?.id || 'dashboard';
  const pageLabel      = getActiveLabelFromPath(pathname);

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
    if (sessionStorage.getItem('storeSidebarOpen') === 'true') setPanelOpen(true);
  }, []);

  // keep openSection in sync when navigating
  useEffect(() => {
    setOpenSection(activeSection);
  }, [pathname]);

  // ── Notifications ───────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifications, setNotifications] = useState([
    { id: 1, time: '1d' }, { id: 2, time: '1d' }, { id: 3, time: '1d' },
    { id: 4, time: '1d' }, { id: 5, time: '1d' }, { id: 6, time: '1d' },
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
    window.location.href = '/superadmin/organizations'; // if the browser kept it open
  }

  function handleLogout() {
    dispatch(clearAuth());
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('BHARAT_TOKEN');
    }
    router.replace('/login');
  }

  const userName = mounted ? (user?.name || user?.email || 'Store Owner') : 'Store Owner';
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  function openSec(sec) {
    setOpenSection(sec);
    setPanelOpen(true);
    sessionStorage.setItem('storeSidebarOpen', 'true');
  }

  function closePanel() {
    setPanelOpen(false);
    sessionStorage.setItem('storeSidebarOpen', 'false');
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    setPanelOpen(false);
    sessionStorage.setItem('storeSidebarOpen', 'false');
  }

  function toggleMobileMenu() {
    if (mobileMenuOpen) {
      closeMobileMenu();
    } else {
      setMobileMenuOpen(true);
      setPanelOpen(true);
      sessionStorage.setItem('storeSidebarOpen', 'true');
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
                    className={`${s.stripBtn} ${openSection.id === sec.id ? s.stripBtnActive : ''}`}
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
          <span>Logged in as <strong>{impersonation.orgName || userName}</strong> (store owner) from super admin</span>
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
            Store Owner / <strong>{pageLabel}</strong>
          </div>
        </div>
        <div className={s.topbarActions}>
          <button className={s.btnAddLearner} onClick={() => router.push('/storeowner/add-learner')} title="Add Learner" aria-label="Add Learner">
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span><span className={s.btnAddLearnerText}> Add Learner</span>
          </button>
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
