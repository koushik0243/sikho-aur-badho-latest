'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import s from "./DashboardPage.module.css";
import { orDash } from '../../../lib/displayValue';

// ── Constants ─────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COURSE_COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444'];

const ALL_FETCHES = [
  { key: 'courses',      fetch: () => apiServiceHandler('GET', 'course/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
  { key: 'orgs',         fetch: () => apiServiceHandler('GET', 'organization/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
  { key: 'employees',    fetch: () => apiServiceHandler('GET', 'user/admin/list-pagination?page=1&limit=1&user_type=employee').then(r => r?.total ?? 0) },
  { key: 'orders',       fetch: () => apiServiceHandler('GET', 'order/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
  { key: 'invoices',     fetch: () => apiServiceHandler('GET', 'invoice/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
  { key: 'credits',      fetch: () => apiServiceHandler('GET', 'credit/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
  { key: 'categories',   fetch: () => apiServiceHandler('GET', 'course-category/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
  { key: 'certs',        fetch: () => apiServiceHandler('GET', 'certificate-template/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
  { key: 'tags',         fetch: () => apiServiceHandler('GET', 'tags/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
  { key: 'users',        fetch: () => apiServiceHandler('GET', 'user/admin/list-pagination?page=1&limit=1&user_type=superadmin&deletedAt=null').then(r => r?.total ?? 0) },
  { key: 'orgAdmins',    fetch: () => apiServiceHandler('GET', 'user/admin/list-pagination?page=1&limit=1&user_type=organization&orgRole=admin&deletedAt=null').then(r => r?.total ?? 0) },
  { key: 'learners',     fetch: () => apiServiceHandler('GET', 'user/admin/list-pagination?page=1&limit=1&user_type=employee&orgRole=employee&deletedAt=null').then(r => r?.total ?? 0) },
  { key: 'industryType', fetch: () => apiServiceHandler('GET', 'industry-type/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
  { key: 'roles',        fetch: () => apiServiceHandler('GET', 'role/list-pagination?page=1&limit=1').then(r => r?.total ?? 0) },
];

// ── Helpers ───────────────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtAmt(n) {
  if (!n) return '₹0';
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(2)}`;
}

function fmtRevenue(n) {
  if (!n) return '₹0';
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hr ago`;
  return `${Math.floor(secs / 86400)} days ago`;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
function avatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Icons ─────────────────────────────────────────────────────────────
const StudentsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const CoursesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const EnrollIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const RevenueIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <text x="12" y="18" textAnchor="middle" fontSize="19" fontWeight="700" fontFamily="Arial, Helvetica, sans-serif">₹</text>
  </svg>
);
const OrgsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

// ── KPI Card ──────────────────────────────────────────────────────────
function KpiCard({ icon, iconBg, iconColor, label, value, loading, hint }) {
  return (
    <div className={s.kpiCard}>
      <div className={s.kpiTop}>
        <div className={s.kpiIcon} style={{ background: iconBg, color: iconColor }}>{icon}</div>
        <div className={s.kpiText}>
          <div className={s.kpiLabel}>{label}</div>
          <div className={s.kpiValue}>
            {loading ? <span className={s.skel} style={{ width: 56, height: 22, display: 'inline-block' }} /> : fmt(value)}
          </div>
        </div>
      </div>
      {hint && <div className={s.kpiHint}>{hint}</div>}
    </div>
  );
}

// ── Enrollment Donut Chart ─────────────────────────────────────────────
// Turns the filtered period-by-period enrollment counts (months, or days within a
// month) into a circle chart: the busiest periods get their own slice, the long tail
// rolls up into "Others" so the chart stays legible even for a 31-day month view.
const DONUT_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const MAX_ENROLL_SLICES = 8;

function EnrollDonutChart({ data }) {
  if (!data || data.every(d => d.value === 0)) {
    return <div className={s.chartEmpty}>No enrollment data for this period</div>;
  }
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const sorted = data.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, MAX_ENROLL_SLICES);
  const othersTotal = sorted.slice(MAX_ENROLL_SLICES).reduce((sum, d) => sum + d.value, 0);

  const legendItems = top.map((d, i) => ({ label: d.label, value: d.value, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  if (othersTotal > 0) legendItems.push({ label: 'Others', value: othersTotal, color: '#9ca3af' });

  return (
    <div className={s.enrollDonutRow}>
      <DonutChart segments={legendItems.map(item => ({ v: item.value, c: item.color }))} total={total} />
      <div className={s.sysLegend}>
        {legendItems.map((item, i) => {
          const pct = total ? ((item.value / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={i} className={s.sysLegItem}>
              <span className={s.sysLegDot} style={{ background: item.color }} />
              <div>
                <div className={s.sysLegLabel}>{item.label}</div>
                <div className={s.sysLegVal}>
                  {item.value.toLocaleString()} {item.value === 1 ? 'enrollment' : 'enrollments'} <span>({pct}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────
function DonutChart({ segments, total }) {
  const R = 62, sw = 22, viewSize = (R + sw) * 2 + 4;
  const cx = viewSize / 2, cy = viewSize / 2;
  const C = 2 * Math.PI * R;
  const safeTotal = total || 1;

  let cum = 0;
  return (
    <svg width={viewSize} height={viewSize} viewBox={`0 0 ${viewSize} ${viewSize}`} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f3f4f6" strokeWidth={sw} />
      {segments.map((seg, i) => {
        const dash = (seg.v / safeTotal) * C;
        const offset = C - cum;
        cum += dash;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={seg.c}
            strokeWidth={sw}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={offset}
            style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }}
          />
        );
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="20" fontWeight="800" fill="#111827">{fmt(total)}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="11" fill="#9ca3af">Total</text>
    </svg>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    success:  { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'Success' },
    pending:  { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'Pending' },
    failed:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Failed' },
    canceled: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', label: 'Canceled' },
    refunded: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', label: 'Refunded' },
  };
  const style = map[(status || '').toLowerCase()] || map.pending;
  return (
    <span style={{
      display: 'inline-block',
      background: style.bg,
      color: style.color,
      border: `1px solid ${style.border}`,
      borderRadius: 20,
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 10px',
      whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const user = useSelector(selectUser);
  const adminName = user?.name || user?.email?.split('@')[0] || 'Admin';

  const [counts, setCounts]           = useState({});
  const [loading, setLoading]         = useState(true);
  const [dashData, setDashData]       = useState({
    recentOrders: [], topCourses: [], topOrgs: [], recentEnrollments: [],
    revenue: 0, totalEnrollments: 0,
  });
  const [rawOrgCourses, setRawOrgCourses] = useState([]);
  const [chartYear, setChartYear]         = useState(new Date().getFullYear());
  const [chartMonth, setChartMonth]       = useState(-1);
  const [dashLoading, setDashLoading] = useState(true);
  const [orgRows, setOrgRows]         = useState([]);
  const [orgRowsLoading, setOrgRowsLoading] = useState(true);

  // ── KPI totals ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(ALL_FETCHES.map(f => f.fetch().then(v => ({ key: f.key, val: v })))).then(results => {
      if (cancelled) return;
      const map = {};
      results.forEach(r => { if (r.status === 'fulfilled') map[r.value.key] = r.value.val; });
      setCounts(map);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Detailed dashboard data ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      apiServiceHandler('GET', 'order/list-pagination?page=1&limit=100'),
      apiServiceHandler('GET', 'organization-course/list'),
    ]).then(([ordersRes, orgCoursesRes]) => {
      if (cancelled) return;

      const orders = ordersRes.status === 'fulfilled' ? (Array.isArray(ordersRes.value?.data) ? ordersRes.value.data : []) : [];
      const orgCourses = orgCoursesRes.status === 'fulfilled' ? (Array.isArray(orgCoursesRes.value?.data) ? orgCoursesRes.value.data : []) : [];

      const revenue = orders.reduce((sum, o) => sum + (parseFloat(o.credit_amount) || 0), 0);

      const recentOrders = [...orders]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(o => ({
          orderId: `#ORD-${String(o._id || '').slice(-5).toUpperCase()}`,
          company: o.organizer_id?.org_name || '—',
          amount: `₹${(parseFloat(o.credit_amount) || 0).toFixed(0)}`,
          status: (o.status || 'pending').toLowerCase(),
        }));

      const cMap = {}, cNames = {};
      orgCourses.forEach(item => {
        const cid = (typeof item.courseId === 'object' ? item.courseId?._id : item.courseId)?.toString();
        if (!cid) return;
        cMap[cid] = (cMap[cid] ?? 0) + 1;
        if (item.courseId?.title) cNames[cid] = item.courseId.title;
      });
      const topCourses = Object.entries(cMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ id, name: cNames[id] || 'Unnamed Course', enrollments: count }));

      const oMap = {}, oNames = {};
      orgCourses.forEach(item => {
        const oid = (typeof item.orgId === 'object' ? item.orgId?._id : item.orgId)?.toString();
        if (!oid) return;
        oMap[oid] = (oMap[oid] ?? 0) + 1;
        if (item.orgId?.org_name) oNames[oid] = item.orgId.org_name;
      });
      const topOrgs = Object.entries(oMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ id, name: oNames[id] || 'Unknown Org', enrollments: count }));

      const recentEnrollments = [...orgCourses]
        .filter(item => item.createdAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(item => ({
          name: item.orgId?.org_name || '—',
          course: item.courseId?.title || '—',
          time: item.createdAt,
        }));

      setRawOrgCourses(orgCourses);
      setDashData({ recentOrders, topCourses, topOrgs, recentEnrollments, revenue, totalEnrollments: orgCourses.length });
      setDashLoading(false);
    }).catch(() => { if (!cancelled) setDashLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Overview table (org breakdown) ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    apiServiceHandler('GET', 'organization/list-pagination?page=1&limit=10')
      .then(async r => {
        if (cancelled) return;
        const items = Array.isArray(r?.data) ? r.data : [];
        if (items.length === 0) { setOrgRows([]); setOrgRowsLoading(false); return; }

        const toId = v => (typeof v === 'object' ? v?._id : v)?.toString() ?? null;

        const [adminsRes, learnersRes, coursesRes, ordersRes] = await Promise.allSettled([
          apiServiceHandler('GET', 'user/admin/list-pagination?user_type=organization&orgRole=admin&deletedAt=null&limit=500&page=1'),
          apiServiceHandler('GET', 'user/admin/list-pagination?user_type=employee&orgRole=employee&deletedAt=null&limit=500&page=1'),
          apiServiceHandler('GET', 'organization-course/list'),
          apiServiceHandler('GET', 'order/list-pagination?limit=1000&page=1'),
        ]);

        if (cancelled) return;

        const allAdmins   = adminsRes.status   === 'fulfilled' ? (Array.isArray(adminsRes.value?.data)   ? adminsRes.value.data   : []) : [];
        const allLearners = learnersRes.status === 'fulfilled' ? (Array.isArray(learnersRes.value?.data) ? learnersRes.value.data : []) : [];

        const courseMap = {};
        if (coursesRes.status === 'fulfilled') {
          (Array.isArray(coursesRes.value?.data) ? coursesRes.value.data : [])
            .forEach(item => { const id = toId(item.orgId); if (id) courseMap[id] = (courseMap[id] ?? 0) + 1; });
        }
        const orderMap = {};
        if (ordersRes.status === 'fulfilled') {
          (Array.isArray(ordersRes.value?.data) ? ordersRes.value.data : [])
            .forEach(order => {
              const id = toId(order.organizer_id);
              const amt = parseFloat(order.credit_amount) || 0;
              if (id && amt > 0) orderMap[id] = (orderMap[id] ?? 0) + amt;
            });
        }

        setOrgRows(items.map(org => {
          const id = org._id?.toString();
          const adminCount = allAdmins.filter(u =>
            u.user_type === 'organization' && u.orgRole === 'admin' && !u.deletedAt && toId(u.orgId) === id
          ).length;
          const learnerCount = allLearners.filter(u =>
            u.user_type === 'employee' && u.orgRole === 'employee' && !u.deletedAt && toId(u.orgId) === id
          ).length;
          return { ...org, _adminCount: adminCount, _courseCount: courseMap[id] ?? 0, _learnerCount: learnerCount, _orderAmount: orderMap[id] ?? 0 };
        }));
        setOrgRowsLoading(false);
      })
      .catch(() => { if (!cancelled) { setOrgRows([]); setOrgRowsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const availYears = useMemo(() => {
    const years = new Set();
    rawOrgCourses.forEach(item => {
      const y = new Date(item.createdAt).getFullYear();
      if (!isNaN(y) && y > 2000) years.add(y);
    });
    if (!years.size) years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [rawOrgCourses]);

  const enrollmentChart = useMemo(() => {
    if (chartMonth === -1) {
      const monthly = Array.from({ length: 12 }, (_, i) => ({ label: MONTHS[i], value: 0 }));
      rawOrgCourses.forEach(item => {
        const d = new Date(item.createdAt);
        if (!isNaN(d) && d.getFullYear() === chartYear) monthly[d.getMonth()].value++;
      });
      const hasData = monthly.some(m => m.value > 0);
      return hasData ? monthly.filter(m => m.value > 0) : monthly.slice(0, 6);
    }
    const daysInMonth = new Date(chartYear, chartMonth + 1, 0).getDate();
    // Label includes the month (e.g. "Jun 23") — a bare day number reads too much like
    // a count of its own once it's sitting next to the donut legend's real count.
    const daily = Array.from({ length: daysInMonth }, (_, i) => ({ label: `${MONTHS[chartMonth]} ${i + 1}`, value: 0 }));
    rawOrgCourses.forEach(item => {
      const d = new Date(item.createdAt);
      if (!isNaN(d) && d.getFullYear() === chartYear && d.getMonth() === chartMonth) {
        daily[d.getDate() - 1].value++;
      }
    });
    return daily;
  }, [rawOrgCourses, chartYear, chartMonth]);

  const sysTotal = (counts.users || 0) + (counts.orgAdmins || 0) + (counts.learners || 0);

  return (
    <SuperAdminShell activeSection="dashboard">
      <div className={s.dashWrap}>

        {/* ── Welcome Row ── */}
        <div className={s.welcomeRow}>
          <div>
            <h1 className={s.welcomeTitle}>Welcome back, {adminName}! 👋</h1>
            <p className={s.welcomeSub}>Here&rsquo;s what&rsquo;s happening with your LMS today.</p>
          </div>
          {/* <button className={s.createBtn} onClick={() => router.push('/superadmin/course-builder')}>
            + Create New &nbsp;▾
          </button> */}
        </div>

        {/* ── KPI Cards ── */}
        <div className={s.kpiRow}>
          <KpiCard icon={<StudentsIcon />} iconBg="#ede9fe" iconColor="#7c3aed" label="Total Students"      value={counts.employees}  loading={loading}     hint="Learners in all organizations" />
          <KpiCard icon={<CoursesIcon />}  iconBg="#dbeafe" iconColor="#2563eb" label="Total Courses"       value={counts.courses}    loading={loading}     hint="In the course catalogue" />
          <KpiCard icon={<EnrollIcon />}   iconBg="#d1fae5" iconColor="#059669" label="Total Enrollments"   value={dashData.totalEnrollments} loading={dashLoading} hint="Courses assigned to organizations" />
          <KpiCard icon={<RevenueIcon />}  iconBg="#fef3c7" iconColor="#d97706" label="Total Revenue"       value={fmtRevenue(dashData.revenue)} loading={dashLoading} hint="Total of all orders" />
          <KpiCard icon={<OrgsIcon />}     iconBg="#fee2e2" iconColor="#dc2626" label="Total Organizations" value={counts.orgs}       loading={loading}     hint="Registered organizations" />
        </div>

        {/* ── Enrollments Overview + Top Courses + Top Organizations: three columns ── */}
        <div className={s.overviewRow}>

            {/* Enrollments Overview */}
            <div className={s.card}>
              <div className={s.cardHead}>
                <span className={s.cardTitle}>Enrollments Overview</span>
                <div className={s.chartFilters}>
                  <select className={s.filterSel} value={chartYear} onChange={e => setChartYear(Number(e.target.value))}>
                    {availYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className={s.filterSel} value={chartMonth} onChange={e => setChartMonth(Number(e.target.value))}>
                    <option value={-1}>All Months</option>
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
              </div>
              {dashLoading
                ? <div className={s.chartSkel}><span className={s.skel} style={{ width: '100%', height: 200, display: 'block', borderRadius: 8 }} /></div>
                : <EnrollDonutChart data={enrollmentChart} />
              }
            </div>

            {/* Top Courses */}
            <div className={s.card}>
              <div className={s.cardHead}>
                <span className={s.cardTitle}>Top Courses</span>
                <span className={s.viewAllLink} onClick={() => router.push('/superadmin/course-builder')}>View all</span>
              </div>
              <div className={s.topListScroll}>
                {dashLoading ? [1,2,3,4,5].map(n => (
                  <div key={n} className={s.topItem}>
                    <span className={s.skel} style={{ width: 36, height: 36, borderRadius: 6, display: 'inline-block', flexShrink: 0 }} />
                    <span className={s.skel} style={{ flex: 1, height: 14, display: 'inline-block' }} />
                  </div>
                )) : dashData.topCourses.length === 0
                  ? <div className={s.emptyMsg}>No course assignments yet</div>
                  : dashData.topCourses.map((c, i) => {
                      const maxE = Math.max(...dashData.topCourses.map(x => x.enrollments), 1);
                      return (
                        <div key={c.id || i} className={s.topItem}>
                          <div className={s.topThumb} style={{ background: COURSE_COLORS[i % COURSE_COLORS.length] }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className={s.topInfo}>
                            <div className={s.topName}>{c.name}</div>
                            <div className={s.topBarWrap}>
                              <div className={s.topBar} style={{ width: `${(c.enrollments / maxE) * 100}%`, background: COURSE_COLORS[i % COURSE_COLORS.length] }} />
                            </div>
                          </div>
                          <div className={s.topCount}>{c.enrollments} <span>Enrollments</span></div>
                        </div>
                      );
                    })}
              </div>
            </div>

            {/* Top Organizations */}
            <div className={s.card}>
              <div className={s.cardHead}>
                <span className={s.cardTitle}>Top Organizations</span>
                <span className={s.viewAllLink} onClick={() => router.push('/superadmin/organizations')}>View all</span>
              </div>
              <div className={s.topListScroll}>
                {dashLoading ? [1,2,3,4,5].map(n => (
                  <div key={n} className={s.topItem}>
                    <span className={s.skel} style={{ width: 36, height: 36, borderRadius: 6, display: 'inline-block', flexShrink: 0 }} />
                    <span className={s.skel} style={{ flex: 1, height: 14, display: 'inline-block' }} />
                  </div>
                )) : dashData.topOrgs.length === 0
                  ? <div className={s.emptyMsg}>No organization enrollments yet</div>
                  : dashData.topOrgs.map((o, i) => {
                      const maxE = Math.max(...dashData.topOrgs.map(x => x.enrollments), 1);
                      return (
                        <div key={o.id || i} className={s.topItem}>
                          <div className={s.topThumb} style={{ background: COURSE_COLORS[i % COURSE_COLORS.length] }}>
                            {o.name.charAt(0).toUpperCase()}
                          </div>
                          <div className={s.topInfo}>
                            <div className={s.topName}>{o.name}</div>
                            <div className={s.topBarWrap}>
                              <div className={s.topBar} style={{ width: `${(o.enrollments / maxE) * 100}%`, background: COURSE_COLORS[i % COURSE_COLORS.length] }} />
                            </div>
                          </div>
                          <div className={s.topCount}>{o.enrollments} <span>Enrollments</span></div>
                        </div>
                      );
                    })}
              </div>
            </div>

        </div>

        {/* ── Bottom Row: Recent Enrollments | Recent Orders | System Overview ── */}
        <div className={s.bottomRow}>

          {/* Recent Enrollments */}
          <div className={`${s.card} ${s.bottomCard}`}>
            <div className={s.cardHead}>
              <span className={s.cardTitle}>Recent Enrollments</span>
              {/* <span className={s.viewAllLink} onClick={() => router.push('/superadmin/organizations')}>View all</span> */}
            </div>
            <div className={s.scrollContent}>
              <div className={s.enrollList}>
                {dashLoading ? [1,2,3,4,5].map(n => (
                  <div key={n} className={s.enrollItem}>
                    <span className={s.skel} style={{ width: 38, height: 38, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
                    <span className={s.skel} style={{ flex: 1, height: 14, display: 'inline-block' }} />
                  </div>
                )) : dashData.recentEnrollments.length === 0
                  ? <div className={s.emptyMsg}>No enrollments yet</div>
                  : dashData.recentEnrollments.map((e, i) => (
                    <div key={i} className={s.enrollItem}>
                      <div className={s.avatar} style={{ background: avatarColor(e.name) }}>{initials(e.name)}</div>
                      <div className={s.enrollInfo}>
                        <div className={s.enrollName}>{e.name}</div>
                        <div className={s.enrollCourse}>{e.course}</div>
                      </div>
                      <div className={s.enrollTime}>{timeAgo(e.time)}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className={`${s.card} ${s.bottomCard}`}>
            <div className={s.cardHead}>
              <span className={s.cardTitle}>Recent Orders</span>
              {/* <span className={s.viewAllLink} onClick={() => router.push('/superadmin/payments/orders')}>View all</span> */}
            </div>
            <div className={s.scrollContent}>
              <table className={s.orderTbl}>
                <tbody>
                  {dashLoading ? [1,2,3,4,5].map(n => (
                    <tr key={n}><td colSpan={4}><span className={s.skel} style={{ width: '100%', height: 14, display: 'inline-block' }} /></td></tr>
                  )) : dashData.recentOrders.length === 0
                    ? <tr><td colSpan={4} className={s.emptyMsg}>No orders yet</td></tr>
                    : dashData.recentOrders.map((o, i) => (
                      <tr key={i} className={s.orderRow} onClick={() => router.push('/superadmin/payments/orders')}>
                        <td className={s.orderId}>{o.orderId}</td>
                        <td className={s.orderCompany}>{o.company}</td>
                        <td className={s.orderAmt}>{o.amount}</td>
                        <td><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* System Overview */}
          <div className={`${s.card} ${s.bottomCard}`}>
            <div className={s.cardHead}>
              <span className={s.cardTitle}>System Overview</span>
              {/* <span className={s.viewAllLink} onClick={() => router.push('/superadmin/user')}>View Report</span> */}
            </div>
            <div className={s.scrollContent}>
              <div className={s.sysRow}>
                {loading
                  ? <span className={s.skel} style={{ width: 172, height: 172, borderRadius: '50%', display: 'inline-block' }} />
                  : <DonutChart
                      segments={[
                        { v: counts.users     || 0, c: '#6366f1' },
                        { v: counts.orgAdmins || 0, c: '#3b82f6' },
                        { v: counts.learners  || 0, c: '#10b981' },
                      ]}
                      total={sysTotal}
                    />
                }
                <div className={s.sysLegend}>
                  {[
                    { c: '#6366f1', label: 'Superadmin',        v: counts.users     || 0 },
                    { c: '#3b82f6', label: 'Organization Admin', v: counts.orgAdmins || 0 },
                    { c: '#10b981', label: 'Learner',            v: counts.learners  || 0 },
                  ].map((item, i) => {
                    const pct = sysTotal ? ((item.v / sysTotal) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={i} className={s.sysLegItem}>
                        <span className={s.sysLegDot} style={{ background: item.c }} />
                        <div>
                          <div className={s.sysLegLabel}>{item.label}</div>
                          <div className={s.sysLegVal}>{item.v.toLocaleString()} <span>({pct}%)</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Overview Table ── */}
        <div className={s.card}>
          <div className={s.cardHead}>
            <span className={s.cardTitle}>Overview</span>
          </div>
          <div className={s.tblWrap}>
            <table className={s.tbl}>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Admin</th>
                  <th>Courses</th>
                  <th>Learners</th>
                  <th>Total Order Amount</th>
                </tr>
              </thead>
              <tbody>
                {orgRowsLoading ? [1,2,3].map(n => (
                  <tr key={n}>
                    {[80,28,28,28,50].map((w, c) => (
                      <td key={c}><span className={s.skel} style={{ width: w, height: 12 }} /></td>
                    ))}
                  </tr>
                )) : orgRows.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0' }}>No organizations found</td></tr>
                  : orgRows.map((org, i) => (
                    <tr key={org._id ?? i} style={{ cursor: 'pointer' }} onClick={() => router.push('/superadmin/organizations')}>
                      <td style={{ fontWeight: 500, color: '#111827' }}>{orDash(org.org_name)}</td>
                      <td className={s.modCount}>{org._adminCount ?? 0}</td>
                      <td className={s.modCount}>{org._courseCount ?? 0}</td>
                      <td className={s.modCount}>{org._learnerCount ?? 0}</td>
                      <td className={s.modCount}>{fmtAmt(org._orderAmount ?? 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </SuperAdminShell>
  );
}
