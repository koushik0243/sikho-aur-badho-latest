'use client';

import { useParams } from 'next/navigation';
import DepartmentForm from './DepartmentForm';

export default function EditDepartment() {
  const { id } = useParams();
  return <DepartmentForm id={id} />;
}
