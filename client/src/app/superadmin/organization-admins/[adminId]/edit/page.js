import { Suspense } from 'react';
import EditOrgAdmin from '../../../../../Components/SuperAdmin/OrgAdmins/EditOrgAdmin';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <EditOrgAdmin />
    </Suspense>
  );
}
