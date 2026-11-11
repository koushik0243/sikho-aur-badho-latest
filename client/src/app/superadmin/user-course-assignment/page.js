import { Suspense } from 'react';
import UserCourseAssignmentList from '../../../Components/SuperAdmin/UserCourseAssignment/UserCourseAssignmentList';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <UserCourseAssignmentList />
    </Suspense>
  );
}
