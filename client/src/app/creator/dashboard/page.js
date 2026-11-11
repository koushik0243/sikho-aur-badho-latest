'use client';

import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectUser, selectUserType, clearAuth } from '../../../redux/slices/authSlice';

export default function CreatorDashboard() {
  const user = useSelector(selectUser);
  const userType = useSelector(selectUserType);
  const dispatch = useDispatch();
  const router = useRouter();

  function handleLogout() {
    dispatch(clearAuth());
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('BHARAT_TOKEN');
    }
    router.replace('/login');
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#0b7b7b' }}>Creator Dashboard</h1>
      <p style={{ color: '#6b7280', marginTop: 8 }}>
        Logged in as: <strong>{user?.name || user?.email || 'Creator'}</strong>
        &nbsp;·&nbsp;Role: <strong>{userType}</strong>
      </p>
      <button
        onClick={handleLogout}
        style={{
          marginTop: 24,
          padding: '10px 20px',
          background: '#0b7b7b',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Logout
      </button>
    </div>
  );
}
