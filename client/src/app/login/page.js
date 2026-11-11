import { Suspense } from 'react';
import AuthPage from '../../Components/Auth/AuthPage';

export const metadata = {
  title: 'Sign In — SikhoAurBadho',
  description: 'Sign in to your SikhoAurBadho account.',
};

export default function LoginPage() {
  return (
    <Suspense>
      <AuthPage />
    </Suspense>
  );
}
