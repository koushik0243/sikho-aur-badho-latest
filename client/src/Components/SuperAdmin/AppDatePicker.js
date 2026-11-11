'use client';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AppDatePicker({ value, onChange, className, placeholder, disabled, maxDate, minDate }) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <DatePicker
        selected={parseDate(value)}
        onChange={date => onChange(date ? formatDate(date) : '')}
        dateFormat="dd MMM yyyy"
        placeholderText={placeholder || 'Select date'}
        className={className}
        wrapperClassName="app-datepicker-wrapper"
        disabled={disabled}
        maxDate={maxDate}
        minDate={minDate}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        autoComplete="off"
      />
    </div>
  );
}
