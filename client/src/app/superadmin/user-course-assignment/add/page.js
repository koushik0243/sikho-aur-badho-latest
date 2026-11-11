import { Suspense } from 'react';
import AddUserCourseAssignment from '../../../../Components/SuperAdmin/UserCourseAssignment/AddUserCourseAssignment';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <AddUserCourseAssignment />
    </Suspense>
  );
}
