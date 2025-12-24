import React, { useState } from 'react';
import ExchangeRateSettings from './ExchangeRateSettings';
import MarketPriceSettings from './MarketPriceSettings';
import { TrashIcon } from '../Icons';
import FormattedNumberInput from '../FormattedNumberInput';

interface HolidaySettingsProps {
  holidays: string[];
  onUpdateHolidays: (holidays: string[]) => void;
}

const HolidaySettings: React.FC<HolidaySettingsProps> = ({ holidays, onUpdateHolidays }) => {
  const [newHoliday, setNewHoliday] = useState('');

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliday) return;
    
    const date = new Date(newHoliday + 'T00:00:00Z');
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        alert('No se pueden agregar sábados o domingos como feriados.');
        return;
    }

    if (holidays.includes(newHoliday)) {
        alert('Este feriado ya ha sido agregado.');
        return;
    }
    
    const updatedHolidays = [...holidays, newHoliday].sort();
    onUpdateHolidays(updatedHolidays);
    setNewHoliday('');
  };

  const handleDeleteHoliday = (holidayToDelete: string) => {
    onUpdateHolidays(holidays.filter(h => h !== holidayToDelete));
  };
  
  const commonInputClass = "border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600";

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b dark:border-gray-700 pb-2">Gestionar Feriados</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Agregue los días feriados que no deben ser considerados en los cálculos de días hábiles.
        Los sábados y domingos se excluyen automáticamente.
      </p>
      <form onSubmit={handleAddHoliday} className="space-y-4 bg-gray-100 dark:bg-gray-800/50 p-6 rounded-lg mb-6">
        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200">Agregar Feriado</h4>
        <div className="flex items-end gap-4">
          <div className="flex-grow">
            <label htmlFor="holiday-date" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Fecha</label>
            <input
              id="holiday-date"
              type="date"
              value={newHoliday}
              onChange={e => setNewHoliday(e.target.value)}
              className={`mt-1 block w-full ${commonInputClass}`}
              required
            />
          </div>
          <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg h-10">
            Agregar
          </button>
        </div>
      </form>
      
      <div>
        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Feriados Cargados</h4>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border rounded-lg p-2 bg-gray-100 dark:bg-gray-800/50 dark:border-gray-700">
          {holidays.length > 0 ? [...holidays].sort().map(holiday => (
            <div key={holiday} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm">
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {new Date(holiday + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <button onClick={() => handleDeleteHoliday(holiday)} className="text-red-500 hover:text-red-700" title="Eliminar">
                <TrashIcon />
              </button>
            </div>
          )) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">No hay feriados registrados.</p>
          )}
        </div>
      </div>
    </div>
  );
};


const MarketDataSettings: React.FC<any> = (props) => {
    const [activeView, setActiveView] = useState<'rates' | 'prices' | 'holidays'>('rates');
    
    const TabButton: React.FC<{view: 'rates' | 'prices' | 'holidays', label: string}> = ({view, label}) => (
      <button 
        onClick={() => setActiveView(view)}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeView === view 
            ? 'bg-primary text-white shadow' 
            : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'}`}
      >
          {label}
      </button>
  );

    return (
        <div>
            <div className="flex items-center gap-2 border-b dark:border-gray-700 pb-4 mb-6">
                <TabButton view="rates" label="Tipos de Cambio" />
                <TabButton view="prices" label="Cotizaciones de Mercado" />
                <TabButton view="holidays" label="Feriados" />
            </div>
            {activeView === 'rates' && <ExchangeRateSettings {...props} />}
            {activeView === 'prices' && <MarketPriceSettings {...props} priceHistory={props.marketPriceHistory} />}
            {activeView === 'holidays' && <HolidaySettings holidays={props.holidays} onUpdateHolidays={props.onUpdateHolidays} />}
        </div>
    );
};

export default MarketDataSettings;