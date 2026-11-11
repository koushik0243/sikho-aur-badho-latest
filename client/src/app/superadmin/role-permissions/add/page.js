import { Suspense } from 'react';
import AddRolePermission from '../../../../Components/SuperAdmin/RolePermissions/AddRolePermission';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <AddRolePermission />
    </Suspense>
  );
}
