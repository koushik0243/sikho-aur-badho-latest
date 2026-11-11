'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  loginUser,
  setAuthView,
  selectAuthLoading,
  selectAuthError,
  selectLoginAttempts,
  selectMaxLoginAttempts,
  clearError,
} from '../../redux/slices/authSlice';
import styles from './Auth.module.css';

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function EyeOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginForm() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const attempts = useSelector(selectLoginAttempts);
  const maxAttempts = useSelector(selectMaxLoginAttempts);
  const isLocked = attempts >= maxAttempts;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const hasError = Boolean(error);
  const remaining = maxAttempts - attempts;

  function handleSubmit(e) {
    e.preventDefault();
    if (isLocked || loading) return;
    dispatch(clearError());
    dispatch(loginUser({ identifier: identifier.trim(), password }));
  }

  return (
    <div className={styles.formBox}>
      {/* Brand Logo */}
      <img src="/logo.png" alt="sikhoaurbadho" className={styles.logoImg} />
      <p className={styles.tagline}>Sign in to continue</p>

      {hasError && (
        <div className={styles.errorBanner}>
          {error}
          {attempts > 0 && attempts < maxAttempts && (
            <> {remaining} attempt{remaining !== 1 ? 's' : ''} remaining before lockout.</>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ width: '100%', marginTop: hasError ? 0 : 8 }}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="login-identifier">
            Phone / Email
          </label>
          <input
            id="login-identifier"
            name="identifier"
            type="text"
            className={`${styles.input} ${hasError ? styles.inputError : ''}`}
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); dispatch(clearError()); }}
            autoComplete="username"
            required
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="login-password">
            Password
          </label>
          <div className={styles.inputWrap}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className={`${styles.input} ${styles.inputWithEye} ${hasError ? styles.inputError : ''}`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); dispatch(clearError()); }}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOnIcon /> : <EyeOffIcon />}
            </button>
          </div>
        </div>

        <div className={styles.linkRow}>
          <button
            type="button"
            className={styles.link}
            onClick={() => dispatch(setAuthView('forgotPassword'))}
          >
            Forgot Password?
          </button>
        </div>

        <button
          type="submit"
          className={`${styles.btn} ${hasError ? styles.btnError : styles.btnPrimary}`}
          disabled={loading || isLocked}
        >
          {loading ? 'Signing in…' : isLocked ? 'Account Locked' : hasError ? 'Try Again' : 'Sign In'}
        </button>
      </form>

    </div>
  );
}
