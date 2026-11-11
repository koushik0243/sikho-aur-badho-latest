'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  resetPassword,
  setAuthView,
  selectAuthLoading,
  selectAuthError,
  clearError,
} from '../../redux/slices/authSlice';
import styles from './Auth.module.css';
import PasswordInput from '../PasswordInput/PasswordInput';

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

function getPasswordStrength(pwd) {
  if (pwd.length === 0) return null;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { label: 'Weak', color: '#d32f2f' };
  if (score === 2) return { label: 'Fair', color: '#f57c00' };
  if (score === 3) return { label: 'Good', color: '#388e3c' };
  return { label: 'Strong', color: '#0b7b7b' };
}

export default function SetNewPasswordForm({ resetToken }) {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [localError, setLocalError] = useState('');

  const strength = getPasswordStrength(newPassword);

  function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');
    dispatch(clearError());

    if (newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    dispatch(resetPassword({ token: resetToken, newPassword, confirmPassword }));
  }

  const displayError = localError || error;

  return (
    <div className={styles.formBox}>
      {/* Brand Logo */}
      <img src="/logo.png" alt="sikhoaurbadho" className={styles.logoImg} />
      <p className={styles.tagline}>Create new password</p>

      <h2 className={styles.formTitle}>Set New Password</h2>
      <p className={styles.formSubtitle}>Must be at least 8 characters</p>

      {displayError && <div className={styles.errorBanner}>{displayError}</div>}

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        {/* New + Confirm Password — side by side */}
        <div className={styles.passwordPair}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="new-password">
            New Password
          </label>
          <div className={styles.inputWrap}>
            <input
              id="new-password"
              type={showNew ? 'text' : 'password'}
              className={`${styles.input} ${styles.inputWithEye}`}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setLocalError(''); dispatch(clearError()); }}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowNew((v) => !v)}
              aria-label={showNew ? 'Hide password' : 'Show password'}
            >
              {showNew ? <EyeOnIcon /> : <EyeOffIcon />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="confirm-password">
            Confirm Password
          </label>
          <PasswordInput
            id="confirm-password"
            className={styles.input}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setLocalError(''); dispatch(clearError()); }}
            autoComplete="new-password"
            required
          />
        </div>
        </div>

        {strength && (
          <div className={styles.strengthRow}>
            <span className={styles.strengthLabel} style={{ color: strength.color }}>
              {strength.label} password
            </span>
          </div>
        )}

        <button
          type="submit"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={loading || !newPassword || !confirmPassword}
          style={{ marginBottom: 8 }}
        >
          {loading ? 'Updating…' : 'Update Password'}
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
