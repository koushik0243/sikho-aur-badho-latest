import { Suspense } from 'react';
import AssignmentResultList from '../../../Components/SuperAdmin/AssignmentResult/AssignmentResultList';

export default function AssignmentResultPage() {
  return <Suspense fallback={null}><AssignmentResultList /></Suspense>;
}
