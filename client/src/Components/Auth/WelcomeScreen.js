'use client';

import { useDispatch, useSelector } from 'react-redux';
import {
  activateAccount,
  selectAuthLoading,
  selectAuthError,
  selectWelcomeData,
  clearError,
} from '../../redux/slices/authSlice';
import { useState } from 'react';
import styles from './Auth.module.css';
import PasswordInput from '../PasswordInput/PasswordInput';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  creator: 'Creator',
  organization: 'Store Owner',
  employee: 'Learner',
};

export default function WelcomeScreen() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const welcomeData = useSelector(selectWelcomeData);

  const [step, setStep] = useState('info'); // 'info' | 'setPassword'
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  function handleNext() {
    setStep('setPassword');
  }

  function handleActivate(e) {
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

    dispatch(
      activateAccount({
        token: welcomeData?.activationToken,
        newPassword,
        confirmPassword,
      })
    );
  }

  const displayError = localError || error;
  const roleLabel = ROLE_LABELS[welcomeData?.role] || welcomeData?.role;

  if (step === 'setPassword') {
    return (
      <div className={styles.formBox}>
        <img src="/logo.png" alt="sikhoaurbadho" className={styles.logoImg} />
        <p className={styles.tagline}>Create new password</p>

        <h2 className={styles.formTitle}>Set Your Password</h2>
        <p className={styles.formSubtitle}>Must be at least 8 characters</p>

        {displayError && <div className={styles.errorBanner}>{displayError}</div>}

        <form onSubmit={handleActivate} style={{ width: '100%' }}>
          {/* New + Confirm Password — side by side */}
          <div className={styles.passwordPair}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="welcome-new-pwd">New Password</label>
            <PasswordInput
              id="welcome-new-pwd"
              className={styles.input}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setLocalError(''); dispatch(clearError()); }}
              autoComplete="new-password"
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="welcome-confirm-pwd">Confirm Password</label>
            <PasswordInput
              id="welcome-confirm-pwd"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setLocalError(''); dispatch(clearError()); }}
              autoComplete="new-password"
              required
            />
          </div>
          </div>

          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={loading || !newPassword || !confirmPassword}
          >
            {loading ? 'Activating…' : 'Activate Account'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.formBox} style={{ textAlign: 'center' }}>
      <img src="/logo.png" alt="sikhoaurbadho" className={styles.logoImg} />
      <p className={styles.tagline}>Sign In Your Account</p>

      {/* Success circle */}
      <div className={styles.successCircle} style={{ margin: '20px auto' }}>
        <span className={styles.checkIcon}>✓</span>
      </div>

      <h2 className={styles.formTitle} style={{ alignSelf: 'center' }}>
        Welcome, {welcomeData?.name || 'User'}
      </h2>
      <p style={{ fontSize: 13, color: '#4b5563', marginBottom: 16, textAlign: 'center' }}>
        Your account was created by your store admin.
        <br />
        Set a password to activate your access.
      </p>

      <div className={styles.welcomeCard}>
        <div><strong>Store:</strong> {welcomeData?.store}</div>
        <div><strong>Role:</strong> {roleLabel}</div>
        <div><strong>Plan:</strong> {welcomeData?.plan}</div>
      </div>

      <button
        type="button"
        className={`${styles.btn} ${styles.btnPrimary}`}
        onClick={handleNext}
      >
        Next
      </button>
    </div>
  );
}
