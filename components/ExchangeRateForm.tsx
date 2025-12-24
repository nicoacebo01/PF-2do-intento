

import React, { useState, useCallback } from 'react';
import type { DailyExchangeRate } from '../types';
import FormattedNumberInput from './FormattedNumberInput';

interface ExchangeRateFormProps {
  onAddExchangeRate: (rate: Omit<DailyExchangeRate, 'companyId'>) => void;
  latestRate: number;
}

const ExchangeRateForm: React.FC<ExchangeRateFormProps> = ({ onAddExchangeRate, latestRate }) => {
  const [rate, setRate] = useState<number | ''>('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (rate === '' || rate === null) return;
    onAddExchangeRate({
      date: new Date().toISOString().split('T')[0],
      rate: rate,
    });
    setRate('');
  }, [rate, onAddExchangeRate]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
        <div>
            <p className="text-sm text-gray-500">Último valor: ${latestRate.toLocaleString('es-AR')}</p>
        </div>
        <div className="flex items-center gap-2">
            <FormattedNumberInput
                value={rate}
                onChange={setRate}
                placeholder="Valor de hoy..."
                className="w-full"
            />
            <button
            type="submit"
            className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg text-sm"
            >
            Guardar
            </button>
      </div>
    </form>
  );
};

export default ExchangeRateForm;