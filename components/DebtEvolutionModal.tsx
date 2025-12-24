import React, { useMemo, useState } from 'react';
import type { Debt, DebtType, Bank, Broker, DailyExchangeRate, FutureExchangeRateSnapshot, AppSettings, ArbitrageOperation, MultiSelectOption } from '../types';
import DebtChart from './DebtChart';
import HistoricalDebtLog from './HistoricalDebtLog';
import { XIcon, FilterIcon, ArrowUturnLeftIcon, ChevronUpIcon, ChevronDownIcon } from './Icons';
import MultiSelectDropdown from './MultiSelectDropdown';
import { calculateFinancialsForDate, calculateUsdAnalysisForDate } from '../utils/financials';
// FIX: Import `Currency` as a value, not just a type, to use it in comparisons.
import { Currency } from '../types';

interface DebtEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allDebts: Debt[];
  debtTypes: DebtType[];
  banks: Bank[];
  brokers: Broker[];
  exchangeRates: DailyExchangeRate[];
  futureRateHistory: FutureExchangeRateSnapshot[];
  appSettings: AppSettings;
  arbitrageOperations: ArbitrageOperation[];
}

const initialAdvancedFilters = {
    debtType: [] as string[],
    counterparty: [] as string[],
    currency: [] as string[],
    dateStart: '',
    dateEnd: '',
};

const DebtEvolutionModal: React.FC<DebtEvolutionModalProps> = ({ 
  isOpen, 
  onClose,
  allDebts,
  debtTypes,
  banks,
  brokers,
  exchangeRates,
  futureRateHistory,
  appSettings,
  arbitrageOperations
}) => {
  const [advancedFilters, setAdvancedFilters] = useState(initialAdvancedFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);

  const filteredDebts = useMemo(() => {
    const hasAdvancedFilters =
        advancedFilters.debtType.length > 0 ||
        advancedFilters.counterparty.length > 0 ||
        advancedFilters.currency.length > 0;

    if (!hasAdvancedFilters) return allDebts;

    return allDebts.filter(debt => {
        const { debtType, counterparty, currency } = advancedFilters;
        const debtCounterpartyId = debt.bankId ? `bank-${debt.bankId}` : debt.brokerId ? `broker-${debt.brokerId}` : '';
        const debtTypeDetails = debtTypes.find(dt => dt.name === debt.type);
        
        const typeMatch = debtType.length === 0 || (debtTypeDetails && debtType.includes(debtTypeDetails.id));
        const counterpartyMatch = counterparty.length === 0 || (debtCounterpartyId && counterparty.includes(debtCounterpartyId));
        const currencyMatch = currency.length === 0 || currency.includes(debt.currency);

        return typeMatch && counterpartyMatch && currencyMatch;
    });
  }, [allDebts, advancedFilters, debtTypes]);

  const historicalDebtLog = useMemo(() => {
    const debtsToProcess = filteredDebts;
    if (debtsToProcess.length === 0 || exchangeRates.length === 0) return [];
    
    const log: any[] = [];
    const allDates = new Set<string>(exchangeRates.map(r => r.date));
    debtsToProcess.forEach(d => {
        allDates.add(d.originationDate);
        if (d.actualCancellationDate) allDates.add(d.actualCancellationDate);
        else allDates.add(d.dueDate);
    });

    let sortedDates = Array.from(allDates).sort();

    if (advancedFilters.dateStart) sortedDates = sortedDates.filter(d => d >= advancedFilters.dateStart);
    if (advancedFilters.dateEnd) sortedDates = sortedDates.filter(d => d <= advancedFilters.dateEnd);

    if (sortedDates.length === 0) return [];

    const firstDate = new Date(sortedDates[0]);
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);

    for (let d = firstDate; d <= lastDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const rateForDay = [...exchangeRates].reverse().find(r => r.date <= dateStr)?.rate;
        if (!rateForDay) continue;

        const snapshotForDay = [...futureRateHistory].reverse().find(s => s.snapshotDate <= dateStr);
        const activeDebtsOnDate = debtsToProcess.filter(debt => {
            const startDate = debt.originationDate;
            const endDate = debt.actualCancellationDate || debt.dueDate;
            return startDate <= dateStr && dateStr <= endDate;
        });

        if (activeDebtsOnDate.length === 0) continue;

        let totalDebtStockUSD = 0;
        let totalWeightedCftNumerator = 0;
        let totalPrincipalUSD = 0;
        const byType: Record<string, { stock: number; weightedCftNumerator: number; principalUSD: number }> = {};

        activeDebtsOnDate.forEach(debt => {
            const financials = calculateFinancialsForDate(debt, d, appSettings);
            const usdAnalysis = calculateUsdAnalysisForDate(debt, financials, snapshotForDay, appSettings, exchangeRates, arbitrageOperations);
            const debtStockUSD = debt.currency === Currency.USD ? debt.amount : debt.amount / rateForDay;
            const principalUSD = debt.currency === Currency.USD ? debt.amount : debt.amount / debt.exchangeRateAtOrigination;

            totalDebtStockUSD += debtStockUSD;
            let cftInUsd: number | null = null;
            // FIX: Property 'tea' does not exist on type '{ cft: number; ... }'. Changed to 'cft'.
            if (debt.currency === Currency.USD) cftInUsd = financials.cft;
            // FIX: Property 'usd_tea' does not exist on type '{ usd_cft: number; ... }'. Changed to 'usd_cft'.
            else if (usdAnalysis?.usd_cft) cftInUsd = usdAnalysis.usd_cft;

            if (cftInUsd !== null && isFinite(cftInUsd)) {
                totalWeightedCftNumerator += cftInUsd * principalUSD;
                totalPrincipalUSD += principalUSD;
            }

            if (!byType[debt.type]) byType[debt.type] = { stock: 0, weightedCftNumerator: 0, principalUSD: 0 };
            byType[debt.type].stock += debtStockUSD;
            if (cftInUsd !== null && isFinite(cftInUsd)) {
                byType[debt.type].weightedCftNumerator += cftInUsd * principalUSD;
                byType[debt.type].principalUSD += principalUSD;
            }
        });

        const logEntry: any = {
            date: dateStr,
            totalDebtStockUSD,
            overallWeightedCft: totalPrincipalUSD > 0 ? totalWeightedCftNumerator / totalPrincipalUSD : 0,
        };
        
        debtTypes.forEach(dt => {
            const data = byType[dt.name];
            if (data) {
                logEntry[dt.name] = {
                    stock: data.stock,
                    weightedCft: data.principalUSD > 0 ? data.weightedCftNumerator / data.principalUSD : 0
                };
            }
        });
        log.push(logEntry);
    }
    return log;
  }, [filteredDebts, exchangeRates, futureRateHistory, appSettings, debtTypes, arbitrageOperations, advancedFilters.dateStart, advancedFilters.dateEnd]);

  const debtTypeOptions: MultiSelectOption[] = useMemo(() => debtTypes.map(dt => ({ value: dt.id, label: dt.name })), [debtTypes]);
  const counterpartyOptions: MultiSelectOption[] = useMemo(() => [
      ...banks.map(b => ({ value: `bank-${b.id}`, label: b.name })),
      ...brokers.map(b => ({ value: `broker-${b.id}`, label: b.name }))
  ].sort((a,b) => a.label.localeCompare(b.label)), [banks, brokers]);
  const currencyOptions: MultiSelectOption[] = [{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }];
  
  const handleFilterChange = (filterName: keyof typeof advancedFilters, value: any) => {
      setAdvancedFilters(prev => ({ ...prev, [filterName]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl m-4 h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Evolución Histórica de Deuda</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
        </div>
        <div className="p-6 flex-grow overflow-y-auto space-y-8">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg shadow-sm mb-4 border dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <FilterIcon />
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Filtros</h3>
                    </div>
                    <button onClick={() => setIsFilterPanelOpen(p => !p)} className="text-primary dark:text-accent-dm">
                        {isFilterPanelOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                </div>
                {isFilterPanelOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end animate-fade-in">
                        <div><label className="text-sm font-medium">Tipo de Deuda</label><MultiSelectDropdown options={debtTypeOptions} selectedValues={advancedFilters.debtType} onChange={v => handleFilterChange('debtType', v)} placeholder="Todos" /></div>
                        <div><label className="text-sm font-medium">Contraparte</label><MultiSelectDropdown options={counterpartyOptions} selectedValues={advancedFilters.counterparty} onChange={v => handleFilterChange('counterparty', v)} placeholder="Todas" /></div>
                        <div><label className="text-sm font-medium">Moneda</label><MultiSelectDropdown options={currencyOptions} selectedValues={advancedFilters.currency} onChange={v => handleFilterChange('currency', v)} placeholder="Todas" /></div>
                        <div className="grid grid-cols-2 gap-2">
                           <div><label className="text-sm font-medium">Fecha Desde</label><input type="date" value={advancedFilters.dateStart} onChange={e => handleFilterChange('dateStart', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2 h-10"/></div>
                           <div><label className="text-sm font-medium">Fecha Hasta</label><input type="date" value={advancedFilters.dateEnd} onChange={e => handleFilterChange('dateEnd', e.target.value)} min={advancedFilters.dateStart} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2 h-10"/></div>
                        </div>
                        <div className="lg:col-start-4 flex justify-end">
                             <button onClick={() => setAdvancedFilters(initialAdvancedFilters)} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold py-2 px-4 rounded-lg h-10">
                                <ArrowUturnLeftIcon /> Limpiar Filtros
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Gráfico de Evolución (USD)</h3>
                <DebtChart data={historicalDebtLog} debtTypes={debtTypes} />
            </div>
             <div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Registro Histórico Diario</h3>
                <HistoricalDebtLog logData={historicalDebtLog} debtTypes={debtTypes} />
            </div>
        </div>
        <div className="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 font-bold py-2 px-4 rounded-lg">Cerrar</button>
        </div>
         <style>{`
          @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
          .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
      </div>
    </div>
  );
};

export default DebtEvolutionModal;