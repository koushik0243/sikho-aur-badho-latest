'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  verifyOtp,
  resendOtp,
  setAuthView,
  selectAuthLoading,
  selectAuthError,
  selectOtpIdentifier,
  clearError,
} from '../../redux/slices/authSlice';
import styles from './Auth.module.css';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 42;

function maskIdentifier(id) {
  if (!id) return '';
  if (id.includes('@')) {
    const [local, domain] = id.split('@');
    return `${local.slice(0, 3)}****@${domain}`;
  }
  return `+91 ${id.slice(0, 4)}****${id.slice(-2)}`;
}

export default function OtpForm() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const identifier = useSelector(selectOtpIdentifier);

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  function handleDigitChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    dispatch(clearError());

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  function handleVerify() {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) return;
    dispatch(verifyOtp({ otp, identifier }));
  }

  function handleResend() {
    if (countdown > 0) return;
    setDigits(Array(OTP_LENGTH).fill(''));
    setCountdown(RESEND_SECONDS);
    dispatch(resendOtp({ identifier }));
  }

  const otp = digits.join('');
  const minutes = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const timerLabel = `${minutes}:${String(secs).padStart(2, '0')}`;

  return (
    <div className={styles.formBox}>
      {/* Logo */}
      <img src="/logo.png" alt="sikhoaurbadho" className={styles.logoImg} />
      <p className={styles.tagline}>Sign in to continue</p>

      <h2 className={`${styles.formTitle} ${styles.otpHeader}`}>Enter OTP</h2>
      <p className={styles.otpSubtext}>
        Sent to {maskIdentifier(identifier)}
      </p>

      <div className={styles.infoBox}>
        <span>❓</span>
        OTP delivered via SMS or email. Check your messages.
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <p className={styles.label} style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
        6-digit OTP
      </p>

      <div className={styles.otpBoxRow} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`${styles.otpBox} ${d ? styles.otpBoxFilled : ''}`}
            aria-label={`OTP digit ${i + 1}`}
          />
        ))}
      </div>

      <div className={styles.otpResendRow}>
        <span className={styles.resendTimer}>
          {countdown > 0 ? `Resend in ${timerLabel}` : 'Didn\'t receive it?'}
        </span>
        <button
          type="button"
          className={styles.link}
          onClick={handleResend}
          disabled={countdown > 0 || loading}
          style={{ opacity: countdown > 0 ? 0.5 : 1 }}
        >
          Resend OTP
        </button>
      </div>

      <button
        type="button"
        className={`${styles.btn} ${styles.btnPrimary}`}
        onClick={handleVerify}
        disabled={otp.length < OTP_LENGTH || loading}
      >
        {loading ? 'Verifying…' : 'Verify OTP'}
      </button>

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
