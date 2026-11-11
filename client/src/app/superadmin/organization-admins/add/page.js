import { Suspense } from 'react';
import AddOrgAdmin from '../../../../Components/SuperAdmin/OrgAdmins/AddOrgAdmin';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <AddOrgAdmin />
    </Suspense>
  );
}
