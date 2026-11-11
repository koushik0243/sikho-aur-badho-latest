import { Suspense } from 'react';
import ViewCategorySubcategory from '../../../../Components/SuperAdmin/CategorySubcategory/ViewCategorySubcategory';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <ViewCategorySubcategory />
    </Suspense>
  );
}
