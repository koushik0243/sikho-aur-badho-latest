'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  forgotPassword,
  setAuthView,
  selectAuthLoading,
  selectResetIdentifier,
} from '../../redux/slices/authSlice';
import styles from './Auth.module.css';

export default function ResetLinkSentForm() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const resetIdentifier = useSelector(selectResetIdentifier);
  const [resent, setResent] = useState(true);

  function handleResend() {
    if (!resetIdentifier || loading) return;
    dispatch(forgotPassword({ identifier: resetIdentifier }));
    setResent(true);
  }

  return (
    <div className={styles.formBox} style={{ textAlign: 'center' }}>
      {/* Brand Logo */}
      <img src="/logo.png" alt="sikhoaurbadho" className={styles.logoImg} />
      <p className={styles.tagline}>Sign in to continue</p>

      {/* Success circle */}
      <div className={styles.successCircle} style={{ margin: '16px auto' }}>
        <span className={styles.checkIcon}>✓</span>
      </div>

      <h2 className={styles.formTitle} style={{ alignSelf: 'center' }}>
        Check your inbox
      </h2>
      <p style={{ fontSize: 13, color: '#4b5563', marginBottom: 16, textAlign: 'center' }}>
        A reset link was sent to{' '}
        <strong>{resetIdentifier}</strong>.
      </p>

      <div className={styles.infoBox} style={{ justifyContent: 'center' }}>
        Link expires in 15 minutes. If you don&apos;t receive it, check spam or resend.
      </div>

      {!resent && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleResend}
          disabled={loading}
          style={{ marginBottom: 8 }}
        >
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      )}

      {resent && (
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
          Didn&apos;t receive it?{' '}
          <button
            type="button"
            onClick={() => { setResent(false); handleResend(); }}
            style={{ background: 'none', border: 'none', color: '#0b7b7b', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}
          >
            Resend
          </button>
        </p>
      )}

      <button
        type="button"
        className={styles.backLink}
        onClick={() => dispatch(setAuthView('login'))}
      >
        ← or back to login
      </button>
    </div>
  );
}
