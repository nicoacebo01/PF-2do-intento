import React, { useState, useCallback, useMemo, useRef, useEffect, createRef } from 'react';
import type { DailyExchangeRate, FutureExchangeRate, FutureExchangeRateSnapshot } from '../types';
import { PencilIcon, XIcon, TrashIcon } from './Icons';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import FormattedNumberInput from './FormattedNumberInput';
// Assume XLSX is available globally from index.html
declare const XLSX: any;


const SpotRateEditModal: React.FC<{
  rate: DailyExchangeRate;
  onSave: (rate: Omit<DailyExchangeRate, 'companyId'>) => void;
  onClose: () => void;
}> = ({ rate, onSave, onClose }) => {
  const [rateValue, setRateValue] = useState<number | ''>(rate.rate);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (rateValue !== '') {
      onSave({ date: rate.date, rate: rateValue });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md m-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Editar TC Spot</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><XIcon /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Fecha</label>
            <p className="mt-1 text-gray-800 dark:text-gray-100 font-semibold">{new Date(rate.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</p>
          </div>
          <div>
            <label htmlFor="edit-spot-rate" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Nueva Cotización</label>
            <FormattedNumberInput
              id="edit-spot-rate"
              value={rateValue}
              onChange={setRateValue}
              className="mt-1"
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
            <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200">Cancelar</button>
            <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HistoricalSnapshotEditor: React.FC<{
  snapshot: FutureExchangeRateSnapshot;
  onSave: (updatedRates: FutureExchangeRate[]) => void;
  onClose: () => void;
}> = ({ snapshot, onSave, onClose }) => {
  const [rates, setRates] = useState<FutureExchangeRate[]>(() => 
    [...snapshot.rates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  );
  const [editingRate, setEditingRate] = useState<FutureExchangeRate | null>(null);
  const [rateDate, setRateDate] = useState('');
  const [rateValue, setRateValue] = useState<number | ''>('');

  React.useEffect(() => {
    if (editingRate) {
      setRateDate(editingRate.date);
      setRateValue(editingRate.rate);
    } else {
      setRateDate('');
      setRateValue('');
    }
  }, [editingRate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateDate || rateValue === '') return;

    const newRateData = {
      date: rateDate,
      rate: rateValue,
    };

    if (editingRate) {
      setRates(prev => prev.map(r => r.id === editingRate.id ? { ...editingRate, ...newRateData } : r));
    } else {
      const newRate = { ...newRateData, id: crypto.randomUUID() };
      setRates(prev => [...prev, newRate]);
    }
    setEditingRate(null);
  };

  const handleDelete = (id: string) => {
    setRates(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveAndClose = () => {
    onSave(rates);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Editar Curva de Futuros - {new Date(snapshot.snapshotDate).toLocaleDateString('es-AR', {timeZone: 'UTC'})}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><XIcon /></button>
        </div>

        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
          {/* Form */}
          <div className="p-4 border rounded-lg dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">{editingRate ? 'Editar Tasa' : 'Agregar Tasa'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="hist-future-date" className="text-sm font-medium text-gray-600 dark:text-gray-300">Fecha</label>
                <input id="hist-future-date" type="date" value={rateDate} onChange={e => setRateDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" required />
              </div>
              <div>
                <label htmlFor="hist-future-rate" className="text-sm font-medium text-gray-600 dark:text-gray-300">Cotización</label>
                <FormattedNumberInput id="hist-future-rate" value={rateValue} onChange={setRateValue} placeholder="1250,50" className="mt-1" required />
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" className="flex-grow flex justify-center items-center gap-2 bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">
                  {editingRate ? 'Guardar Cambios' : 'Agregar'}
                </button>
                {editingRate && <button type="button" onClick={() => setEditingRate(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200">Cancelar</button>}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="p-2">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Tasas en esta Curva</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2 border rounded-lg p-2 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-700">
              {rates.length > 0 ? [...rates].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(rate => (
                <div key={rate.id} className="flex justify-between items-center text-sm bg-white dark:bg-gray-800 px-3 py-2 rounded shadow-sm">
                  <div><span className="font-semibold">{new Date(rate.date).toLocaleDateString('es-AR', {timeZone: 'UTC'})}:</span> <span className="ml-2 text-primary font-bold dark:text-accent-dm">${rate.rate.toLocaleString('es-AR')}</span></div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditingRate(rate)} className="text-blue-500 hover:text-blue-700" title="Editar"><PencilIcon/></button>
                    <button onClick={() => handleDelete(rate.id)} className="text-red-400 hover:text-red-600" title="Eliminar"><TrashIcon/></button>
                  </div>
                </div>
              )) : <p className="text-center text-gray-500 dark:text-gray-400 py-4">No hay tasas en esta curva.</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 mt-4 border-t dark:border-gray-700">
          <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200">Cancelar</button>
          <button type="button" onClick={handleSaveAndClose} className="bg-success text-white font-bold py-2 px-4 rounded-lg">Guardar y Cerrar</button>
        </div>
      </div>
    </div>
  );
};


interface ExchangeRateManagerProps {
  spotRates: DailyExchangeRate[];
  onAddSpotRate: (rate: Omit<DailyExchangeRate, 'companyId'>) => void;
  onDeleteSpotRate: (date: string) => void;
  onSaveDailyRates: (spotRate: { date: string; rate: number }, futureRates: Array<{ date: string; rate: number }>) => void;
  futureRateHistory: FutureExchangeRateSnapshot[];
  onUpdateFutureRateHistorySnapshot: (snapshotDate: string, updatedRates: FutureExchangeRate[]) => void;
  onBulkImportSpotRates: (rates: DailyExchangeRate[]) => void;
  onBulkImportFutureRates: (snapshots: FutureExchangeRateSnapshot[]) => void;
}

const excelDateToJSDate = (excelDate: number): string => {
    if (excelDate < 1) return '';
    const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    if (isNaN(jsDate.getTime())) return '';
    return jsDate.toISOString().split('T')[0];
};

const parseDateValue = (value: any): string => {
    if (typeof value === 'number') {
        return excelDateToJSDate(value);
    }
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
        // Attempt to parse other common formats if needed, e.g., DD/MM/YYYY
        const parts = value.match(/(\d+)/g);
        if (parts && parts.length === 3) {
            const d = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
    }
    return '';
};

const parseNumericValue = (value: any): number => {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const parsableValue = value.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(parsableValue);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

export const ExchangeRateManager: React.FC<ExchangeRateManagerProps> = ({ 
    spotRates,
    onAddSpotRate,
    onDeleteSpotRate,
    onSaveDailyRates,
    futureRateHistory, 
    onUpdateFutureRateHistorySnapshot,
    onBulkImportSpotRates,
    onBulkImportFutureRates,
}) => {
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [spotRateValue, setSpotRateValue] = useState<number | ''>('');
  const [generatedFutureRates, setGeneratedFutureRates] = useState<Array<{ date: string; rate: number | '' }>>([]);
  const [editingSnapshot, setEditingSnapshot] = useState<FutureExchangeRateSnapshot | null>(null);
  const [editingSpotRate, setEditingSpotRate] = useState<DailyExchangeRate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const futureRateInputsRef = useRef<React.RefObject<HTMLInputElement>[]>([]);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    futureRateInputsRef.current = generatedFutureRates.map(
      (_, i) => futureRateInputsRef.current[i] ?? createRef<HTMLInputElement>()
    );
  }, [generatedFutureRates.length]);
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault(); 
        
        const nextEmptyIndex = generatedFutureRates.findIndex((rate, i) => i > index && rate.rate === '');
        
        if (nextEmptyIndex !== -1) {
            futureRateInputsRef.current[nextEmptyIndex].current?.focus();
        } else {
             saveButtonRef.current?.focus();
        }
    }
  };


  const [exportStartDate, setExportStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { exportData, exportColumns } = useMemo(() => {
    if (!exportStartDate || !exportEndDate) return { exportData: [], exportColumns: [] };
    const startDate = new Date(exportStartDate + 'T00:00:00Z');
    const endDate = new Date(exportEndDate + 'T00:00:00Z');
    
    const futureDates = new Set<string>();
    futureRateHistory.forEach(s => {
        const snapshotDate = new Date(s.snapshotDate + 'T00:00:00Z');
        if (snapshotDate >= startDate && snapshotDate <= endDate) {
            s.rates.forEach(r => futureDates.add(r.date));
        }
    });
    const sortedFutureDates = Array.from(futureDates).sort();

    const columns: ExportColumn<any>[] = [
        { header: 'Fecha', accessor: d => d.date },
        { header: 'Spot', accessor: d => d.spotRate ?? '' },
        ...sortedFutureDates.map(date => ({
            header: new Date(date + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' }),
            accessor: (d: any) => d.futures[date] ?? ''
        }))
    ];

    const dataForExport = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const spotRate = [...spotRates].reverse().find(r => r.date <= dateStr)?.rate;
        const snapshot = [...futureRateHistory].find(s => s.snapshotDate <= dateStr); 
        const futures: Record<string, number> = {};
        if (snapshot) {
            snapshot.rates.forEach(rate => { futures[rate.date] = rate.rate; });
        }
        dataForExport.push({
            date: d.toLocaleDateString('es-AR', { timeZone: 'UTC' }),
            spotRate,
            futures
        });
    }

    return { exportData: dataForExport, exportColumns: columns };
  }, [exportStartDate, exportEndDate, spotRates, futureRateHistory]);


  const handleGenerateMonthEnds = useCallback(() => {
    const rates: Array<{ date: string; rate: '' }> = [];
    if (!dailyDate) return;

    const dateParts = dailyDate.split('-').map(Number);
    const baseDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));

    if (isNaN(baseDate.getTime())) return;

    const nextDay = new Date(baseDate.getTime());
    nextDay.setUTCDate(baseDate.getUTCDate() + 1);
    const isLastDayOfMonth = nextDay.getUTCMonth() !== baseDate.getUTCMonth();
    const startingMonthOffset = isLastDayOfMonth ? 1 : 0;

    for (let i = 0; i < 12; i++) {
        const targetMonthIndex = baseDate.getUTCMonth() + i + startingMonthOffset;
        const targetYear = baseDate.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
        const correctedMonthIndex = targetMonthIndex % 12;
        const lastDay = new Date(Date.UTC(targetYear, correctedMonthIndex + 1, 0));
        const y = lastDay.getUTCFullYear();
        const m = String(lastDay.getUTCMonth() + 1).padStart(2, '0');
        const d = String(lastDay.getUTCDate()).padStart(2, '0');
        rates.push({ date: `${y}-${m}-${d}`, rate: '' });
    }
    setGeneratedFutureRates(rates);
  }, [dailyDate]);

  const handleFutureRateChange = (index: number, value: number | '') => {
    const newRates = [...generatedFutureRates];
    newRates[index].rate = value;
    setGeneratedFutureRates(newRates);
  };

  const handleRemoveFutureRate = (indexToRemove: number) => {
    setGeneratedFutureRates(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveAll = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const spot = spotRateValue;
    if (spot === '' || !dailyDate) {
      alert('Por favor, ingrese una fecha y un valor para el tipo de cambio spot.');
      return;
    }
  
    if (generatedFutureRates.some(r => r.rate === '')) {
       alert('Por favor, complete todos los valores de la curva de futuros o elimine los innecesarios antes de registrar.');
       return;
    }
    
    const futureRatesData = generatedFutureRates
      .filter((r): r is { date: string; rate: number } => typeof r.rate === 'number' && r.rate > 0)
      .map(r => ({ date: r.date, rate: r.rate }));
    
    onSaveDailyRates({ date: dailyDate, rate: spot }, futureRatesData);
    
    setSpotRateValue('');
    setGeneratedFutureRates([]);
    setDailyDate(new Date().toISOString().split('T')[0]);
    alert('Tipos de cambio registrados correctamente.');

  }, [dailyDate, spotRateValue, generatedFutureRates, onSaveDailyRates]);
  
  const handleDownloadTemplate = () => {
    const spotHeaders = ["fecha_YYYY-MM-DD", "tasa_spot"];
    const futureHeaders = ["fecha_snapshot_YYYY-MM-DD", "fecha_vencimiento_YYYY-MM-DD", "tasa_futuro"];
    
    const wsSpot = XLSX.utils.aoa_to_sheet([spotHeaders]);
    const wsFuture = XLSX.utils.aoa_to_sheet([futureHeaders]);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSpot, "SpotRates");
    XLSX.utils.book_append_sheet(wb, wsFuture, "FutureRates");
    
    XLSX.writeFile(wb, "plantilla_importacion_tc.xlsx");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });

            // Process Spot Rates
            const spotSheet = workbook.Sheets["SpotRates"];
            if (!spotSheet) {
                console.warn("Sheet 'SpotRates' not found in the imported file.");
            }
            const spotRatesToImport = spotSheet ? (XLSX.utils.sheet_to_json(spotSheet, { header: 1, raw: true }) as any[][]).slice(1).map(row => ({
                date: parseDateValue(row[0]),
                rate: parseNumericValue(row[1])
            })).filter(r => r.date && r.rate > 0) as DailyExchangeRate[] : [];

            // Process Future Rates
            const futureSheet = workbook.Sheets["FutureRates"];
             if (!futureSheet) {
                console.warn("Sheet 'FutureRates' not found in the imported file.");
            }
            const snapshotsMap = new Map<string, FutureExchangeRate[]>();
            if (futureSheet) {
                const futureData: any[][] = XLSX.utils.sheet_to_json(futureSheet, { header: 1, raw: true });
                futureData.slice(1).forEach(row => {
                    const snapshotDate = parseDateValue(row[0]);
                    const futureDate = parseDateValue(row[1]);
                    const rate = parseNumericValue(row[2]);
                    if (snapshotDate && futureDate && rate > 0) {
                        if (!snapshotsMap.has(snapshotDate)) snapshotsMap.set(snapshotDate, []);
                        snapshotsMap.get(snapshotDate)!.push({ id: crypto.randomUUID(), date: futureDate, rate });
                    }
                });
            }


            const futureSnapshotsToImport: FutureExchangeRateSnapshot[] = Array.from(snapshotsMap.entries())
                .map(([snapshotDate, rates]) => ({ snapshotDate, rates }));
            
            if(spotRatesToImport.length > 0) onBulkImportSpotRates(spotRatesToImport);
            if(futureSnapshotsToImport.length > 0) onBulkImportFutureRates(futureSnapshotsToImport);

            if (spotRatesToImport.length === 0 && futureSnapshotsToImport.length === 0) {
                alert("No se encontraron datos válidos para importar. Verifique el archivo y las pestañas 'SpotRates' y 'FutureRates'.");
            } else {
                alert(`Importación completada: ${spotRatesToImport.length} tasas spot y ${futureSnapshotsToImport.length} snapshots de futuros procesados.`);
            }

        } catch (error) {
            console.error("Error processing file:", error);
            alert(`Hubo un error al procesar el archivo: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const formattedStartDate = useMemo(() => new Date(exportStartDate + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' }), [exportStartDate]);
  const formattedEndDate = useMemo(() => new Date(exportEndDate + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' }), [exportEndDate]);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b dark:border-gray-700 pb-2">Registrar Tipos de Cambio del Día</h3>
      <form onSubmit={handleSaveAll} className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label htmlFor="daily-date" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Fecha de Registro</label>
                <input id="daily-date" type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" required />
            </div>
            <div>
                <label htmlFor="spot-rate" className="block text-sm font-medium text-gray-600 dark:text-gray-300">TC Spot (CCL)</label>
                <FormattedNumberInput id="spot-rate" value={spotRateValue} onChange={setSpotRateValue} placeholder="1250,00" className="mt-1" required />
            </div>
        </div>
         <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Curva de Futuros (Opcional)</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Genere vencimientos de fin de mes o agréguelos manualmente.</p>
            <button type="button" onClick={handleGenerateMonthEnds} className="text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 dark:border-gray-600">Generar Vencimientos Fin de Mes</button>
         </div>
         {generatedFutureRates.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 border-t dark:border-gray-700 pt-4">
                {generatedFutureRates.map((rate, index) => (
                    <div key={index} className="grid grid-cols-3 gap-3 items-center">
                        <input type="date" value={rate.date} readOnly className="block w-full border border-gray-300 rounded-md py-1 px-2 text-sm bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300 dark:border-gray-500" />
                        <FormattedNumberInput 
                          ref={futureRateInputsRef.current[index]}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          value={rate.rate} 
                          onChange={v => handleFutureRateChange(index, v)} 
                          placeholder="1300,50" 
                          className="block w-full" />
                        <button type="button" onClick={() => handleRemoveFutureRate(index)} className="text-red-500 hover:text-red-700 justify-self-start"><TrashIcon /></button>
                    </div>
                ))}
            </div>
         )}
        <div className="flex justify-end pt-4 border-t dark:border-gray-700">
          <button ref={saveButtonRef} type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">Registrar Valores</button>
        </div>
      </form>

      <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg mb-6">
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">Importar Tasas desde Excel</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Suba un archivo para cargar masivamente tasas spot y de futuros.</p>
        <div className="flex items-center gap-4">
          <button onClick={handleDownloadTemplate} className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md">Descargar Plantilla</button>
          <input ref={fileInputRef} type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Histórico de TC Spot</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border rounded-lg p-2 bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
            {[...spotRates].reverse().map(r => (
              <div key={r.date} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm">
                <div>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{new Date(r.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}:</span>
                  <span className="ml-2 text-primary font-bold dark:text-accent-dm">${r.rate.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setEditingSpotRate(r)} className="text-blue-500 hover:text-blue-700"><PencilIcon/></button>
                    <button onClick={() => onDeleteSpotRate(r.date)} className="text-red-400 hover:text-red-600"><TrashIcon/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
           <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Histórico de Curvas Futuras</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border rounded-lg p-2 bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
             {[...futureRateHistory].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate)).map(snapshot => (
                <div key={snapshot.snapshotDate} className="bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm">
                    <div className="flex justify-between items-center">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">Curva del: {new Date(snapshot.snapshotDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</p>
                        <button onClick={() => setEditingSnapshot(snapshot)} className="text-blue-500 hover:text-blue-700"><PencilIcon/></button>
                    </div>
                </div>
             ))}
            </div>
        </div>
      </div>
       <div className="mt-8">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4 border-t dark:border-gray-700 pt-4">Exportar Histórico de Curvas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Desde</label>
                    <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Hasta</label>
                    <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} min={exportStartDate} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" />
                </div>
                <ExportButtons data={exportData} columns={exportColumns} fileName={`historico_curvas_${exportStartDate}_a_${exportEndDate}`} pdfTitle={`Histórico de Curvas (${formattedStartDate} - ${formattedEndDate})`} />
            </div>
        </div>
        {editingSnapshot && <HistoricalSnapshotEditor snapshot={editingSnapshot} onClose={() => setEditingSnapshot(null)} onSave={(updatedRates) => { onUpdateFutureRateHistorySnapshot(editingSnapshot.snapshotDate, updatedRates); setEditingSnapshot(null);}} />}
        {editingSpotRate && <SpotRateEditModal rate={editingSpotRate} onClose={() => setEditingSpotRate(null)} onSave={onAddSpotRate} />}
    </div>
  );
};