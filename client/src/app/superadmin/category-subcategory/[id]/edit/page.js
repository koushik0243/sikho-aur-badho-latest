import { Suspense } from 'react';
import EditCategorySubcategory from '../../../../../Components/SuperAdmin/CategorySubcategory/EditCategorySubcategory';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <EditCategorySubcategory />
    </Suspense>
  );
}
