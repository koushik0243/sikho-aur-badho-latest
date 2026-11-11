'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from "./AddLearnerAssignCourses.module.css";

// ── Icons (content-area only) ────────────────────────────────────
const Icon = {
  users:      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM6.865 14c.41-1.135 1.53-2 2.635-2h1c1.105 0 2.226.865 2.635 2H6.865zM1 14a5.002 5.002 0 019-3h.001A5 5 0 0119 14v1H1v-1z" /></svg>,
  arrowLeft:  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>,
  arrowRight: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
  credit:     <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>,
  check:      <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>,
};

const STEPS = [
  { num: '01', label: 'Learner Details' },
  { num: '02', label: 'Assign Courses' },
  { num: '03', label: 'Notification & Confirm' },
];

const COURSES = [
  { id: 1, name: 'Safety At Workplace',              meta: '4 Chapters · 16 Videos · AI Quiz · Bonus Content On', selected: false },
  { id: 2, name: 'QC Basics',                        meta: '3 Chapters · 11 Videos · AI Quiz',                    selected: false },
  { id: 3, name: 'Compliance & Ethics',              meta: '2 Chapters · 8 Videos · In Review',                  selected: true  },
  { id: 4, name: 'Leadership Basics',                meta: '3 Chapters · 10 Videos · AI Quiz',                   selected: true  },
  { id: 5, name: 'Fire Safety & Emergency Response', meta: '3 Chapters · 12 Videos · AI Quiz',                   selected: true  },
  { id: 6, name: '5S Methodology At The Workplace',  meta: '3 Chapters · 12 Videos · AI Quiz',                   selected: true  },
];

export default function AssignCoursesStep() {
  const router = useRouter();

  const [courses, setCourses] = useState(COURSES);

  function toggleCourse(id) {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  }

  return (
    <>
      {/* Content */}
      <div className={s.content}>

        {/* Page heading row */}
        <div className={s.pageHeadRow}>
          <div className={s.pageHeadLeft}>
            <h1 className={s.pageTitle}>Add New Learner</h1>
            <span className={s.planBadge}>Pro plan</span>
          </div>
          <div className={s.pageHeadMeta}>
            <span className={s.metaItem}>
              <span className={s.metaIcon}>{Icon.users}</span>
              Learners <strong>91</strong>
            </span>
            <span className={s.metaDivider} />
            <span className={s.metaItem}>
              <span className={s.metaIcon}>{Icon.credit}</span>
              Credits Remaining <strong>50</strong>
            </span>
          </div>
        </div>

        {/* Step indicator — step 1 done, step 2 active */}
        <div className={s.stepper}>
          {STEPS.map((step, i) => (
            <div key={step.num} className={s.stepperItem}>
              <div className={`${s.stepCircle} ${i === 0 ? s.stepCircleCheck : i === 1 ? s.stepCircleActive : ''}`}>
                {i === 0 ? <span style={{ display: 'flex', alignItems: 'center', width: 12, height: 12 }}>{Icon.check}</span> : step.num}
              </div>
              <span className={`${s.stepLabel} ${i === 1 ? s.stepLabelActive : ''}`}>{step.label}</span>
              {i < STEPS.length - 1 && <div className={s.stepLine} />}
            </div>
          ))}
        </div>

        {/* Select Courses info card */}
        <div className={s.selectCoursesCard}>
          <strong>Select Courses To Assign</strong>
          <p>Courses follow sequential access — learner must complete each video before unlocking the quiz and the next chapter.</p>
        </div>

        {/* Course list */}
        <div className={s.courseListCard}>
          <div className={s.courseListTitle}>Available Courses</div>

          {courses.map(course => (
            <div key={course.id} className={s.courseItem} onClick={() => toggleCourse(course.id)}>
              <button
                type="button"
                className={`${s.courseCircleBtn} ${course.selected ? s.courseCircleBtnSelected : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleCourse(course.id); }}
                aria-label={course.selected ? 'Deselect' : 'Select'}
              >
                {course.selected && <span className={s.courseCircleCheck} />}
              </button>
              <div className={s.courseInfo}>
                <div className={s.courseName}>{course.name}</div>
                <div className={s.courseMeta}>{course.meta}</div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Footer nav */}
      <div className={s.footer}>
        <button className={s.btnCancel} onClick={() => router.push('/storeowner/add-learner')}>
          <span className={s.footerArrow}>{Icon.arrowLeft}</span>
          Back
        </button>
        <button className={s.btnNext} onClick={() => router.push('/storeowner/add-learner/confirm')}>
          Next: Confirm &amp; Notify
          <span className={s.footerArrow}>{Icon.arrowRight}</span>
        </button>
      </div>
    </>
  );
}
