import React, { useState, useMemo } from 'react';
import type { Debt, Bank, Broker, DailyExchangeRate, AppSettings } from '../types';
import { Currency } from '../types';
import { XIcon } from './Icons';
import { calculateFinancialsForDate, getTodayArgentinaDate } from '../utils/financials';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { useAppContext } from '../App';

interface AccruedInterestAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    allDebts: Debt[];
    banks: Bank[];
    brokers: Broker[];
    exchangeRates: DailyExchangeRate[];
    appSettings: AppSettings;
}

type AnalysisRow = {
    debtId: string;
    companyName?: string;
    debtType: string;
    counterparty: string;
    accruedInterestARS: number;
    accruedInterestUSD: number;
};

const AccruedInterestAnalysisModal: React.FC<AccruedInterestAnalysisModalProps> = ({ isOpen, onClose, allDebts, banks, brokers, exchangeRates, appSettings }) => {
    const { state } = useAppContext();
    const { viewMode, companies } = state;
    const [selectedDate, setSelectedDate] = useState(() => getTodayArgentinaDate().toISOString().split('T')[0]);

    const analysisData = useMemo(() => {
        if (!selectedDate) return { rows: [], totalARS: 0, totalUSD: 0 };

        const calculationDate = new Date(selectedDate + 'T00:00:00Z');

        const activeDebts = allDebts.filter(debt => {
            const startDate = debt.originationDate;
            const endDate = debt.actualCancellationDate || debt.dueDate;
            return startDate <= selectedDate && selectedDate < endDate;
        });
        
        const rows: AnalysisRow[] = [];
        let totalARS = 0;
        let totalUSD = 0;
        const rateForDay = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= selectedDate)?.rate || 1;


        activeDebts.forEach(debt => {
            const financials = calculateFinancialsForDate(debt, calculationDate, appSettings);
            const accruedInterestNative = financials.accruedInterest;

            let accruedInterestARS = 0;
            let accruedInterestUSD = 0;

            if (debt.currency === Currency.ARS) {
                accruedInterestARS = accruedInterestNative;
                accruedInterestUSD = accruedInterestNative / rateForDay;
            } else { // USD
                accruedInterestUSD = accruedInterestNative;
                accruedInterestARS = accruedInterestNative * rateForDay;
            }
            
            rows.push({
                debtId: debt.id,
                companyName: viewMode === 'consolidated' ? companies.find(c => c.id === debt.companyId)?.name : undefined,
                debtType: debt.type,
                counterparty: debt.bankId ? banks.find(b => b.id === debt.bankId)?.name || 'N/D' : brokers.find(b => b.id === debt.brokerId)?.name || 'N/D',
                accruedInterestARS,
                accruedInterestUSD,
            });
            
            totalARS += accruedInterestARS;
            totalUSD += accruedInterestUSD;
        });

        return { rows, totalARS, totalUSD };

    }, [selectedDate, allDebts, banks, brokers, appSettings, exchangeRates, viewMode, companies]);

    const exportData = useMemo(() => {
        if (!analysisData.rows.length) return [];
        const data: AnalysisRow[] = [...analysisData.rows];
        // Add a total row for excel
        data.push({
            debtId: 'TOTAL',
            companyName: '',
            debtType: 'Total',
            counterparty: '',
            accruedInterestARS: analysisData.totalARS,
            accruedInterestUSD: analysisData.totalUSD,
        });
        return data;
    }, [analysisData]);


    const exportColumns: ExportColumn<AnalysisRow>[] = useMemo(() => {
        const columns: ExportColumn<AnalysisRow>[] = [];
        if (viewMode === 'consolidated') {
            columns.push({ header: 'Empresa', accessor: (d) => d.companyName ?? '' });
        }
        columns.push(
            { header: 'Tipo de Deuda', accessor: d => d.debtType },
            { header: 'Contraparte', accessor: d => d.counterparty },
            { header: 'Intereses Devengados (ARS)', accessor: d => d.accruedInterestARS },
            { header: 'Intereses Devengados (USD)', accessor: d => d.accruedInterestUSD },
        );
        return columns;
    }, [viewMode]);
    
    const formatCurrencyValue = (value: number, currency: Currency) => {
        return value.toLocaleString('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl m-4 h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Análisis de Intereses Devengados</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">
                    <div className="flex justify-between items-end mb-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                        <div>
                            <label htmlFor="analysis-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seleccionar Fecha de Análisis</label>
                            <input
                                type="date"
                                id="analysis-date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                max={getTodayArgentinaDate().toISOString().split('T')[0]}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                            />
                        </div>
                        <ExportButtons 
                            data={exportData}
                            columns={exportColumns}
                            fileName={`intereses_devengados_${selectedDate}`}
                            pdfTitle={`Intereses Devengados al ${new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' })}`}
                        />
                    </div>

                    <div className="overflow-x-auto border dark:border-gray-700 rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                    {viewMode === 'consolidated' && <th className="p-2 text-left font-semibold">Empresa</th>}
                                    <th className="p-2 text-left font-semibold">Tipo de Deuda</th>
                                    <th className="p-2 text-left font-semibold">Contraparte</th>
                                    <th className="p-2 text-right font-semibold">Intereses Devengados (ARS)</th>
                                    <th className="p-2 text-right font-semibold">Intereses Devengados (USD)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {analysisData.rows.map(row => (
                                    <tr key={row.debtId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        {viewMode === 'consolidated' && <td className="p-2">{row.companyName}</td>}
                                        <td className="p-2">{row.debtType}</td>
                                        <td className="p-2">{row.counterparty}</td>
                                        <td className="p-2 text-right">
                                            {row.accruedInterestARS !== 0 ? formatCurrencyValue(row.accruedInterestARS, Currency.ARS) : '-'}
                                        </td>
                                        <td className="p-2 text-right font-semibold text-primary dark:text-accent-dm">
                                            {row.accruedInterestUSD !== 0 ? formatCurrencyValue(row.accruedInterestUSD, Currency.USD) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 dark:bg-gray-700 font-bold">
                                <tr>
                                    <td colSpan={viewMode === 'consolidated' ? 3 : 2} className="p-2 text-right">Totales Devengados</td>
                                    <td className="p-2 text-right text-lg text-gray-800 dark:text-gray-200">{formatCurrencyValue(analysisData.totalARS, Currency.ARS)}</td>
                                    <td className="p-2 text-right text-lg text-primary dark:text-accent-dm">{formatCurrencyValue(analysisData.totalUSD, Currency.USD)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                <div className="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 font-bold py-2 px-4 rounded-lg">Cerrar</button>
                </div>
            </div>
        </div>
    );
};

export default AccruedInterestAnalysisModal;