'use client';

import { useSearchParams } from 'next/navigation';
import SuperAdminShell from '../SuperAdminShell';
import AssignmentReview from '../../AssignmentSubmissions/AssignmentReview';
import useOrgName from '../Organizations/useOrgName';
import { BASE_PATH } from './AssignmentResultList';

/** Super admin · Assignment Result → Results: one learner's assignment videos, comments and review. */
export default function AssignmentResultReview() {
  const sp = useSearchParams();
  const orgId = sp.get('orgId') || '';
  const courseId = sp.get('courseId') || '';
  const chapterId = sp.get('chapterId') || '';
  const orgName = useOrgName(orgId);
  const back = new URLSearchParams();
  if (courseId) back.set('courseId', courseId);
  if (chapterId) back.set('chapterId', chapterId);
  return (
    <SuperAdminShell activeSection="assignment-result">
      <AssignmentReview
        key={`${orgId}|${sp.get('learnerId') || ''}|${chapterId}`}
        orgId={orgId}
        orgName={orgName}
        backHref={back.toString() ? `${BASE_PATH}?${back}` : BASE_PATH}
        initialLearnerId={sp.get('learnerId') || ''}
        initialCourseId={courseId}
        initialChapterId={chapterId}
        // The "Assignment Review" box (learner / course / chapter dropdowns) is left out here —
        // the learner, course and chapter were already chosen on the Assignment Result list.
        showFilters={false}
      />
    </SuperAdminShell>
  );
}
