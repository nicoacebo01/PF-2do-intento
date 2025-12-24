import React, { useState, useEffect } from 'react';

const formatNumberInput = (value: string): string => {
  if (value === '' || value === null || value === undefined) return '';
  if (value === '-') return '-';

  const sign = value.startsWith('-') ? '-' : '';
  const numStr = value.replace(/[^0-9,]/g, '');
  const parts = numStr.split(',');
  const processedNumStr = parts.length > 2 ? `${parts[0]},${parts.slice(1).join('')}` : numStr;
  let [integerPart, decimalPart] = processedNumStr.split(',');
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (decimalPart !== undefined) {
      return `${sign}${integerPart},${decimalPart}`;
  }
  return `${sign}${integerPart}`;
};

export const parseFormattedNumber = (value: string): number | '' => {
    if (value === '' || value === null || value === undefined || value === '-') return '';
    const parsableValue = value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(parsableValue);
    return isNaN(num) ? '' : num;
};

interface FormattedNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | '';
  onChange: (value: number | '') => void;
  className?: string;
}

const FormattedNumberInput = React.forwardRef<HTMLInputElement, FormattedNumberInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
      if (parseFormattedNumber(displayValue) !== value) {
          setDisplayValue(formatNumberInput(String(value).replace('.', ',')));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatNumberInput(e.target.value);
      setDisplayValue(formatted);
      const numericValue = parseFormattedNumber(formatted);
      onChange(numericValue);
    };
    
    const commonInputClass = "block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 disabled:bg-gray-100 disabled:text-gray-800 dark:disabled:bg-gray-600 dark:disabled:text-gray-400 placeholder-gray-500 dark:placeholder-gray-400";

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        className={`${commonInputClass} ${className || ''}`}
        {...props}
      />
    );
  }
);

export default FormattedNumberInput;
