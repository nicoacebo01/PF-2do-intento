
import React, { useState } from 'react';
import ExchangeRateSettings from './ExchangeRateSettings';
import MarketPriceSettings from './MarketPriceSettings';
import { TrashIcon, ArrowsUpDownIcon, SparklesIcon } from '../Icons';

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
  
  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b dark:border-gray-700 pb-2">Gestionar Feriados</h3>
      <form onSubmit={handleAddHoliday} className="space-y-4 bg-gray-100 dark:bg-gray-800/50 p-6 rounded-lg mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-grow">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Fecha</label>
            <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm bg-white dark:bg-gray-700" required />
          </div>
          <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg h-10">Agregar</button>
        </div>
      </form>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {holidays.map(h => (
              <div key={h} className="bg-white dark:bg-gray-800 p-2 border rounded flex justify-between items-center text-xs">
                  <span>{h}</span>
                  <button onClick={() => handleDeleteHoliday(h)} className="text-red-500"><TrashIcon /></button>
              </div>
          ))}
      </div>
    </div>
  );
};

const MarketDataSettings: React.FC<any> = (props) => {
    const [activeView, setActiveView] = useState<'rates' | 'prices' | 'holidays'>('rates');
    const [isSyncing, setIsSyncing] = useState(false);

    const simulateSync = () => {
        setIsSyncing(true);
        setTimeout(() => {
            setIsSyncing(false);
            alert("Sincronización con Matba-Rofex y Bloomberg completada (Simulado)");
        }, 2000);
    };

    const TabButton: React.FC<{view: any, label: string}> = ({view, label}) => (
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
            <div className="flex justify-between items-center border-b dark:border-gray-700 pb-4 mb-6">
                <div className="flex items-center gap-2">
                    <TabButton view="rates" label="Tipos de Cambio" />
                    <TabButton view="prices" label="Cotizaciones de Mercado" />
                    <TabButton view="holidays" label="Feriados" />
                </div>
                <button 
                    onClick={simulateSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-lg disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <ArrowsUpDownIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'SINCRONIZANDO...' : 'AUTO-SYNC MERCADO'}
                </button>
            </div>
            {activeView === 'rates' && <ExchangeRateSettings {...props} />}
            {activeView === 'prices' && <MarketPriceSettings {...props} priceHistory={props.marketPriceHistory} />}
            {activeView === 'holidays' && <HolidaySettings holidays={props.holidays} onUpdateHolidays={props.onUpdateHolidays} />}
        </div>
    );
};

export default MarketDataSettings;
