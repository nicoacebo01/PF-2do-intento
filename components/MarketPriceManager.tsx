import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Investment, MarketPriceSnapshot } from '../types';
import FormattedNumberInput from './FormattedNumberInput';
import { getTodayArgentinaDate } from '../utils/financials';
import { PencilIcon, TrashIcon } from './Icons';

interface MarketPriceManagerProps {
  investments: Investment[];
  priceHistory: MarketPriceSnapshot[];
  onSavePrices: (snapshot: MarketPriceSnapshot) => void;
  onDeleteMarketPriceSnapshot: (date: string) => void;
}

const MarketPriceManager: React.FC<MarketPriceManagerProps> = ({ investments, priceHistory, onSavePrices, onDeleteMarketPriceSnapshot }) => {
  const [date, setDate] = useState(() => getTodayArgentinaDate().toISOString().split('T')[0]);
  const [prices, setPrices] = useState<Record<string, number | ''>>({});

  const relevantInstruments = useMemo(() => {
    const instrumentSet = new Set<string>();
    
    const fixedRateOnlyInstruments = new Set<string>();
    const instrumentsWithVariableRateTxs = new Set<string>();

    // Determine which instruments are exclusively fixed-rate
    investments.forEach(inv => {
        inv.transactions.forEach(tx => {
            const instrumentKey = inv.instrumentName.toLowerCase();
            if (tx.isFixedRate) {
                if (!instrumentsWithVariableRateTxs.has(instrumentKey)) {
                    fixedRateOnlyInstruments.add(instrumentKey);
                }
            } else {
                instrumentsWithVariableRateTxs.add(instrumentKey);
                if (fixedRateOnlyInstruments.has(instrumentKey)) {
                    fixedRateOnlyInstruments.delete(instrumentKey);
                }
            }
        });
    });
    
    // Add all non-fixed-rate instruments from the portfolio
    investments.forEach(inv => {
        const instrumentKey = inv.instrumentName.toLowerCase();
        if (!fixedRateOnlyInstruments.has(instrumentKey)) {
            instrumentSet.add(instrumentKey);
        }
    });
    
    // Add any instruments from history that are not identified as fixed-rate only
    const snapshotForDate = priceHistory.find(s => s.date === date);
    if (snapshotForDate) {
        Object.keys(snapshotForDate.prices).forEach(instrumentName => {
            const instrumentKey = instrumentName.toLowerCase();
            if (!fixedRateOnlyInstruments.has(instrumentKey)) {
                instrumentSet.add(instrumentKey);
            }
        });
    }

    return Array.from(instrumentSet).sort();
  }, [investments, date, priceHistory]);

  useEffect(() => {
    const snapshotForDate = priceHistory.find(s => s.date === date);
    const initialPrices: Record<string, number | ''> = {};
    relevantInstruments.forEach(instrument => {
      initialPrices[instrument] = snapshotForDate?.prices[instrument] || '';
    });
    setPrices(initialPrices);
  }, [date, relevantInstruments, priceHistory]);

  const handlePriceChange = (instrumentName: string, value: number | '') => {
    setPrices(prev => ({ ...prev, [instrumentName]: value }));
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const pricesToSave: Record<string, number> = {};
    let allValid = true;
    for (const instrument in prices) {
      const price = prices[instrument];
      if (typeof price === 'number' && price > 0) {
        pricesToSave[instrument] = price;
      } else if (price !== '') {
        allValid = false;
        break;
      }
    }
    
    if (!allValid) {
        alert("Por favor, ingrese valores numéricos válidos para los precios.");
        return;
    }
    
    onSavePrices({ date, prices: pricesToSave });
    alert(`Cotizaciones para el ${new Date(date + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone:'UTC'})} guardadas.`);
  }, [date, prices, onSavePrices]);

  const handleDeleteSnapshot = (dateToDelete: string) => {
    onDeleteMarketPriceSnapshot(dateToDelete);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b dark:border-gray-700 pb-2">Gestionar Cotizaciones de Mercado</h3>
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg mb-6">
        <div>
          <label htmlFor="price-date" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Fecha de Cotización</label>
          <input
            id="price-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="mt-1 block w-full max-w-xs border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t dark:border-gray-700">
            {relevantInstruments.length > 0 ? relevantInstruments.map(instrument => (
                <div key={instrument}>
                    <label htmlFor={`price-${instrument}`} className="block text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{instrument}</label>
                    <FormattedNumberInput
                        id={`price-${instrument}`}
                        value={prices[instrument] || ''}
                        onChange={(value) => handlePriceChange(instrument, value)}
                        className="mt-1"
                        placeholder="0,00"
                    />
                </div>
            )) : (
                <p className="col-span-full text-center text-gray-500 dark:text-gray-400">No hay instrumentos de renta variable para cotizar.</p>
            )}
        </div>

        {relevantInstruments.length > 0 && (
            <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">Guardar Cotizaciones del Día</button>
            </div>
        )}
      </form>

      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Histórico de Cotizaciones Guardadas</h3>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border rounded-lg p-2 bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
          {priceHistory.length > 0 ? (
            [...priceHistory].sort((a,b) => b.date.localeCompare(a.date)).map(s => (
              <div key={s.date} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm">
                <p className="font-semibold text-gray-800 dark:text-gray-200">
                  {new Date(s.date + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setDate(s.date)} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-2 rounded-md">Cargar para Editar</button>
                  <button onClick={() => handleDeleteSnapshot(s.date)} className="text-red-400 hover:text-red-600"><TrashIcon/></button>
                </div>
              </div>
            ))
          ) : (
             <p className="text-center text-gray-500 py-4">No hay cotizaciones históricas guardadas.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketPriceManager;