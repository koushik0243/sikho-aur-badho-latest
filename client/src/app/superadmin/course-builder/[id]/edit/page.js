import EditCourseBuilder from '../../../../../Components/SuperAdmin/Courses/EditCourseBuilder';

export default async function CourseBuilderEditPage({ params }) {
  const { id } = await params;
  return <EditCourseBuilder editId={id} />;
}
