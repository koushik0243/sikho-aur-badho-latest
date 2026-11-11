'use client';

import { useParams } from 'next/navigation';
import DesignationForm from './DesignationForm';

export default function EditDesignation() {
  const { id } = useParams();
  return <DesignationForm id={id} />;
}
