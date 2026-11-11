import { Suspense } from 'react';
import OrgAdminsList from '../../../Components/SuperAdmin/OrgAdmins/OrgAdminsList';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <OrgAdminsList />
    </Suspense>
  );
}
