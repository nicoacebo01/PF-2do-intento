export const formatNumberInput = (value: string): string => {
  if (value === '' || value === null || value === undefined) return '';
  if (value === '-') return '-';

  const sign = value.startsWith('-') ? '-' : '';
  // From the original string, remove everything that is not a digit or a comma
  const numStr = value.replace(/[^0-9,]/g, '');

  // Ensure only one comma exists
  const parts = numStr.split(',');
  const processedNumStr = parts.length > 2 ? `${parts[0]},${parts.slice(1).join('')}` : numStr;
  
  // Split into integer and decimal parts
  let [integerPart, decimalPart] = processedNumStr.split(',');

  // Format integer part with thousand separators (dots)
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (decimalPart !== undefined) {
      return `${sign}${integerPart},${decimalPart}`;
  }
  
  return `${sign}${integerPart}`;
};

export const parseFormattedNumber = (value: string): number | '' => {
    if (value === '' || value === null || value === undefined || value === '-') return '';
    
    // Remove thousand separators (dots) and replace comma with a dot for parsing
    const parsableValue = value.replace(/\./g, '').replace(',', '.');
    
    const num = parseFloat(parsableValue);
    
    return isNaN(num) ? '' : num;
};

export const formatDateForExport = (dateString: string | undefined | null): string => {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('T')[0].split('-');
    if (!year || !month || !day) return dateString;
    return `${day}-${month}-${year}`;
  } catch {
    return dateString;
  }
};

export const formatNumberForExport = (value: number | null | undefined, decimals = 2): string => {
    if (value === null || value === undefined || !isFinite(value)) {
        return '';
    }
    // Use toFixed for consistent decimal places and replace dot with comma.
    // This avoids locale-specific thousand separators.
    return value.toFixed(decimals).replace('.', ',');
};

export const formatPercentageForExport = (value: number | null | undefined): string => {
    if (value === null || value === undefined || !isFinite(value)) {
        return '';
    }
    // Reuse number formatting logic and append '%'
    return `${formatNumberForExport(value, 2)}%`;
};

export const formatRateForDisplay = (value: number | null | undefined): string => {
    if (value === null || value === undefined || !isFinite(value)) {
        return '-';
    }
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatPercentageForDisplay = (value: number | null | undefined): string => {
    if (value === null || value === undefined || !isFinite(value)) {
        return '-';
    }
    const formattedRate = formatRateForDisplay(value);
    return formattedRate === '-' ? '-' : `${formattedRate}%`;
};
