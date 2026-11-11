'use client';

import { useParams } from 'next/navigation';
import PaymentMethodForm from './PaymentMethodForm';

export default function EditPaymentMethod() {
  const { id } = useParams();
  return <PaymentMethodForm id={id} />;
}
