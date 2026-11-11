'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  forgotPassword,
  setAuthView,
  selectAuthLoading,
  selectAuthError,
  clearError,
} from '../../redux/slices/authSlice';
import styles from './Auth.module.css';

export default function ForgotPasswordForm() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);

  const [identifier, setIdentifier] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!identifier.trim() || loading) return;
    dispatch(clearError());
    dispatch(forgotPassword({ identifier: identifier.trim() }));
  }

  return (
    <div className={styles.formBox}>
      {/* Brand Logo */}
      <img src="/logo.png" alt="sikhoaurbadho" className={styles.logoImg} />
      <p className={styles.tagline}>Sign in to continue</p>

      <h2 className={styles.formTitle}>Forgot password?</h2>
      <p className={styles.formSubtitle}>
        Enter your registered email or phone and we&apos;ll send a reset link.
      </p>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="fp-identifier">
            Email or Phone Number
          </label>
          <input
            id="fp-identifier"
            type="text"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); dispatch(clearError()); }}
            placeholder="entername@womenka.in"
            autoComplete="username"
            required
          />
        </div>

        <div className={styles.infoBox}>
          <span>ℹ️</span>
          <span>
            <strong>Note:</strong> The reset link will be sent to your registered email.
            Valid for 15 minutes.
          </span>
        </div>

        <button
          type="submit"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={loading || !identifier.trim()}
        >
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>

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
