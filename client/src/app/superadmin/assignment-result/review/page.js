import { Suspense } from 'react';
import AssignmentResultReview from '../../../../Components/SuperAdmin/AssignmentResult/AssignmentResultReview';

export default function AssignmentResultReviewPage() {
  return <Suspense fallback={null}><AssignmentResultReview /></Suspense>;
}
