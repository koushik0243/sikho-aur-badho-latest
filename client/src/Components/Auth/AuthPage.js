'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  selectAuthView,
  selectIsAuthenticated,
  selectDashboardRoute,
  setResetToken,
  setWelcomeData,
} from '../../redux/slices/authSlice';
import AuthSlider from './AuthSlider';
import LoginForm from './LoginForm';
import OtpForm from './OtpForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ResetLinkSentForm from './ResetLinkSentForm';
import SetNewPasswordForm from './SetNewPasswordForm';
import WelcomeScreen from './WelcomeScreen';
import styles from './Auth.module.css';

export default function AuthPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const authView = useSelector(selectAuthView);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const dashboardRoute = useSelector(selectDashboardRoute);

  // Handle reset-password token from URL (?token=xxx)
  useEffect(() => {
    const resetToken = searchParams.get('token');
    const type = searchParams.get('type'); // 'reset' | 'activate'

    if (resetToken && type === 'reset') {
      dispatch(setResetToken(resetToken));
    }

    if (resetToken && type === 'activate') {
      // Invitation link — decode welcome data from query params
      dispatch(
        setWelcomeData({
          name: searchParams.get('name') || '',
          store: searchParams.get('store') || '',
          role: searchParams.get('role') || '',
          plan: searchParams.get('plan') || '',
          activationToken: resetToken,
        })
      );
    }
  }, [dispatch, searchParams]);

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(dashboardRoute);
    }
  }, [isAuthenticated, dashboardRoute, router]);

  function renderForm() {
    switch (authView) {
      case 'otp':
        return <OtpForm />;
      case 'forgotPassword':
        return <ForgotPasswordForm />;
      case 'resetLinkSent':
        return <ResetLinkSentForm />;
      case 'setNewPassword':
        return <SetNewPasswordForm resetToken={searchParams.get('token')} />;
      case 'welcome':
        return <WelcomeScreen />;
      case 'login':
      default:
        return <LoginForm />;
    }
  }

  return (
    <div className={styles.authWrapper}>
      <AuthSlider />
      <div className={styles.formPanel}>
        {renderForm()}
      </div>
    </div>
  );
}
