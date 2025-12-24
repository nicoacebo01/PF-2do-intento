import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ArbitrageOperation, BusinessUnit, DailyExchangeRate, FutureExchangeRateSnapshot, ArbitrageCustomField, Bank, Broker, Assignment, Debt, Investment, Transaction, DebtType, InvestmentType, AppCurrency, MultiSelectOption, Company } from '../types';
import { PlusCircleIcon, PencilIcon, TrashIcon, LinkIcon, EyeIcon, FilterIcon, FilterSolidIcon, ChevronUpIcon, ChevronDownIcon, ArrowUturnLeftIcon } from './Icons';
import ExportButtons from './ExportButtons';
import { exportToPdf, exportMultiSheetExcel, exportMultiTablePdf } from '../utils/export';
import type { ExportColumn } from '../utils/export';
import { getInterpolatedRate, getTodayArgentinaDate } from '../utils/financials';
import { ExpiredArbitrageModal } from './ExpiredArbitrageModal';
import ArbitrageForm from './ArbitrageForm';
import PortfolioSnapshotModal from './PortfolioSnapshotModal';
import DebtDetailModal from './DebtDetailModal';
import InvestmentDetailModal from './InvestmentDetailModal';
import { useAppContext } from '../App';
import * as api from '../services/api';
import MultiSelectDropdown from './MultiSelectDropdown';
import HelpTooltip from './HelpTooltip';


// Assume XLSX is available globally from index.html
declare const XLSX: any;

// A new component for the visual summaries
const ArbitrageSummaryVisuals: React.FC<{
    activeOperations: any[];
    businessUnits: BusinessUnit[];
    assignments: Assignment[];
    banks: Bank[];
    brokers: Broker[];
    getBusinessUnitName: (id?: string) => string;
    getAssignmentName: (id?: string) => string;
    getOperatorName: (op: ArbitrageOperation) => string;
}> = ({ activeOperations, businessUnits, assignments, banks, brokers, getBusinessUnitName, getAssignmentName, getOperatorName }) => {
    
    type SummaryView = 'businessUnit' | 'operator' | 'assignment';
    const [summaryView, setSummaryView] = useState<SummaryView>('businessUnit');

    const summaryData = useMemo(() => {
        const byMonthBu = new Map<string, Map<string, number>>();
        const byMonthOp = new Map<string, Map<string, number>>();
        const byMonthAssign = new Map<string, Map<string, number>>();
        const months = new Set<string>();
        const buSet = new Set<string>();
        const opSet = new Set<string>();
        const assignSet = new Set<string>();

        activeOperations.forEach(op => {
            if (!op.arbitrageDate) return;
            const month = op.arbitrageDate.substring(0, 7); // YYYY-MM
            months.add(month);

            const netAmount = op.position === 'Comprada' ? op.usdAmount : -op.usdAmount;
            
            const buId = op.businessUnitId || 'unassigned';
            buSet.add(buId);
            if (!byMonthBu.has(month)) byMonthBu.set(month, new Map());
            byMonthBu.get(month)!.set(buId, (byMonthBu.get(month)!.get(buId) || 0) + netAmount);

            const opName = getOperatorName(op);
            opSet.add(opName);
            if (!byMonthOp.has(month)) byMonthOp.set(month, new Map());
            byMonthOp.get(month)!.set(opName, (byMonthOp.get(month)!.get(opName) || 0) + netAmount);
            
            const assignId = op.assignmentId || 'unassigned';
            assignSet.add(assignId);
            if (!byMonthAssign.has(month)) byMonthAssign.set(month, new Map());
            byMonthAssign.get(month)!.set(assignId, (byMonthAssign.get(month)!.get(assignId) || 0) + netAmount);
        });

        const sortedMonths = Array.from(months).sort();
        const sortedBuIds = Array.from(buSet).sort();
        const sortedOpNames = Array.from(opSet).sort();
        const sortedAssignIds = Array.from(assignSet).sort();

        return { byMonthBu, byMonthOp, byMonthAssign, sortedMonths, sortedBuIds, sortedOpNames, sortedAssignIds };
    }, [activeOperations, getOperatorName]);

    const { byMonthBu, byMonthOp, byMonthAssign, sortedMonths, sortedBuIds, sortedOpNames, sortedAssignIds } = summaryData;
    
    const formatUSDValue = (val: number) => val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const renderTable = (
        title: string, 
        data: Map<string, Map<string, number>>, 
        rowHeaderLabel: string,
        colKeys: string[],
        getColName: (id: string) => string
    ) => {
        const colTotals = new Map<string, number>();
        let grandTotal = 0;

        sortedMonths.forEach(month => {
            colKeys.forEach(colKey => {
                const value = data.get(month)?.get(colKey) || 0;
                colTotals.set(colKey, (colTotals.get(colKey) || 0) + value);
            });
        });

        colKeys.forEach(key => grandTotal += colTotals.get(key) || 0);

        if (sortedMonths.length === 0) {
            return (
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
                    <p className="text-center text-gray-500 py-8">No hay posiciones abiertas para mostrar.</p>
                </div>
            )
        }

        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-2 border dark:border-gray-600 text-left font-semibold">{rowHeaderLabel}</th>
                                {colKeys.map(key => <th key={key} className="p-2 border dark:border-gray-600 text-center font-semibold">{getColName(key)}</th>)}
                                <th className="p-2 border dark:border-gray-600 text-right font-semibold">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedMonths.map(month => {
                                let rowTotal = 0;
                                colKeys.forEach(key => rowTotal += data.get(month)?.get(key) || 0);
                                return (
                                    <tr key={month} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="p-2 border dark:border-gray-600 font-semibold">{month}</td>
                                        {colKeys.map(colKey => {
                                            const value = data.get(month)?.get(colKey) || 0;
                                            return <td key={colKey} className={`p-2 border dark:border-gray-600 text-right ${value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : ''}`}>{value !== 0 ? formatUSDValue(value) : '-'}</td>
                                        })}
                                        <td className={`p-2 border dark:border-gray-600 text-right font-bold ${rowTotal > 0 ? 'text-green-700 dark:text-green-500' : rowTotal < 0 ? 'text-red-700 dark:text-red-500' : ''}`}>{formatUSDValue(rowTotal)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="bg-gray-100 dark:bg-gray-700 font-bold">
                             <tr>
                                <td className="p-2 border dark:border-gray-600">Total</td>
                                {colKeys.map(key => {
                                    const value = colTotals.get(key) || 0;
                                    return <td key={key} className={`p-2 border dark:border-gray-600 text-right ${value > 0 ? 'text-green-700' : value < 0 ? 'text-red-700' : ''}`}>{formatUSDValue(value)}</td>
                                })}
                                <td className={`p-2 border dark:border-gray-600 text-right ${grandTotal > 0 ? 'text-green-700' : grandTotal < 0 ? 'text-red-700' : ''}`}>{formatUSDValue(grandTotal)}</td>
                             </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };
    
    const getBuNameWithDefault = (id: string) => {
        if (id === 'unassigned') return 'Sin Asignar';
        return getBusinessUnitName(id);
    };
    
    const getAssignNameWithDefault = (id: string) => {
        if (id === 'unassigned') return 'Sin Asignar';
        return getAssignmentName(id);
    };

    const TabButton: React.FC<{
        label: string;
        isActive: boolean;
        onClick: () => void;
    }> = ({ label, isActive, onClick }) => (
        <button
            onClick={onClick}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                isActive
                ? 'bg-primary text-white shadow'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
        >
            {label}
        </button>
    );

    const renderCurrentView = () => {
        switch (summaryView) {
            case 'businessUnit':
                return renderTable('Por Unidad de Negocio y Vencimiento', byMonthBu, 'Vencimiento', sortedBuIds, getBuNameWithDefault);
            case 'operator':
                return renderTable('Por Operador y Vencimiento', byMonthOp, 'Vencimiento', sortedOpNames, (name) => name);
            case 'assignment':
                return renderTable('Por Asignación y Vencimiento', byMonthAssign, 'Vencimiento', sortedAssignIds, getAssignNameWithDefault);
            default:
                return null;
        }
    }

    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Resumen de Posiciones Abiertas (Neto USD)</h2>
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
                    <TabButton label="Por U. de Negocio" isActive={summaryView === 'businessUnit'} onClick={() => setSummaryView('businessUnit')} />
                    <TabButton label="Por Operador" isActive={summaryView === 'operator'} onClick={() => setSummaryView('operator')} />
                    <TabButton label="Por Asignación" isActive={summaryView === 'assignment'} onClick={() => setSummaryView('assignment')} />
                </div>
            </div>
            {renderCurrentView()}
        </div>
    );
};

interface ArbitrageAnalysisProps {
    operations: ArbitrageOperation[];
    businessUnits: BusinessUnit[];
    assignments: Assignment[];
    banks: Bank[];
    brokers: Broker[];
    futureRateHistory: FutureExchangeRateSnapshot[];
    exchangeRates: DailyExchangeRate[];
    customFields: ArbitrageCustomField[];
    renderableColumns: any[];
    getBusinessUnitName: (id?: string) => string;
    getAssignmentName: (id?: string) => string;
    getOperatorName: (op: ArbitrageOperation) => string;
}

const calculatePortfolioSnapshot = (
    dateStr: string,
    ops: ArbitrageOperation[],
    futureRateHistory: FutureExchangeRateSnapshot[],
    exchangeRates: DailyExchangeRate[],
    customFields: ArbitrageCustomField[]
) => {
    const result = {
        totals: { ars: 0, usd: 0 },
        realized: [] as { op: ArbitrageOperation; pnlArs: number; pnlUsd: number }[],
        latent: [] as { op: ArbitrageOperation; pnlArs: number; pnlUsd: number }[],
        spotRateUsed: 1,
    };
    if (!dateStr || ops.length === 0) return result;
    const snapshotDateParts = dateStr.split('-').map(Number);
    const snapshotDate = new Date(Date.UTC(snapshotDateParts[0], snapshotDateParts[1] - 1, snapshotDateParts[2]));
    if (isNaN(snapshotDate.getTime())) return result;
    const snapshotDateStr = snapshotDate.toISOString().split('T')[0];

    const snapshot = [...futureRateHistory]
        .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))
        .find(s => s.snapshotDate <= snapshotDateStr);
    const spotRateForSnapshot = [...exchangeRates]
        .sort((a, b) => b.date.localeCompare(a.date))
        .find(r => r.date <= snapshotDateStr)?.rate;
        
    if (!spotRateForSnapshot) return result;
    result.spotRateUsed = spotRateForSnapshot;

    const realizedOps = ops.filter(op => (op.cancellationDate || op.arbitrageDate) <= snapshotDateStr);
    for (const op of realizedOps) {
        const closingDate = op.cancellationDate || op.arbitrageDate;
        const spotOnClose = [...exchangeRates]
            .sort((a, b) => b.date.localeCompare(a.date))
            .find(r => r.date <= closingDate)?.rate;

        if (!spotOnClose) continue;

        const closingRate = op.cancellationRate ?? (() => {
            const snapshotOnClose = [...futureRateHistory]
                .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))
                .find(s => s.snapshotDate <= closingDate);
            const spotForClosingDate = [...exchangeRates]
                .sort((a, b) => b.date.localeCompare(a.date))
                .find(r => r.date <= closingDate)?.rate;

            if (snapshotOnClose && spotForClosingDate) {
              return getInterpolatedRate(new Date(op.arbitrageDate), snapshotOnClose, spotForClosingDate);
            }
            return null;
        })();
        if (closingRate === null) continue;

        const pnlArs = (op.position === 'Vendida' ? op.arbitrageRate - closingRate : closingRate - op.arbitrageRate) * op.usdAmount;
        const pnlUsd = pnlArs / spotOnClose;
        result.realized.push({ op: { ...op, rofexRate: closingRate, calculatedCustomData: calculateAllFields(op, customFields) }, pnlArs, pnlUsd });
        result.totals.ars += pnlArs;
        result.totals.usd += pnlUsd;
    }

    const latentOps = ops.filter(op => op.startDate <= snapshotDateStr && snapshotDateStr < (op.cancellationDate || op.arbitrageDate));
    if(snapshot){
        for (const op of latentOps) {
            const rofexRate = getInterpolatedRate(new Date(op.arbitrageDate), snapshot, spotRateForSnapshot);
            if (rofexRate === null) continue;
            const pnlArs = (op.position === 'Vendida' ? op.arbitrageRate - rofexRate : rofexRate - op.arbitrageRate) * op.usdAmount;
            const pnlUsd = pnlArs / spotRateForSnapshot;
            result.latent.push({ op: { ...op, rofexRate, calculatedCustomData: calculateAllFields(op, customFields) }, pnlArs, pnlUsd });
            result.totals.ars += pnlArs;
            result.totals.usd += pnlUsd;
        }
    }
    return result;
};


const ArbitrageAnalysis: React.FC<ArbitrageAnalysisProps> = ({ operations, businessUnits, assignments, banks, brokers, futureRateHistory, exchangeRates, customFields, renderableColumns, getBusinessUnitName, getAssignmentName, getOperatorName }) => {
    const today = useMemo(() => new Date().toISOString().split('T')[0], []);
    const [summaryStartDate, setSummaryStartDate] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
    });
    const [summaryEndDate, setSummaryEndDate] = useState(today);
    const [operationStatus, setOperationStatus] = useState<'todas' | 'activas' | 'vencidas'>('todas');
    
    const [summaryFilters, setSummaryFilters] = useState({
        instruments: [] as string[],
        businessUnitIds: [] as string[],
        assignmentIds: [] as string[],
        operatorIds: [] as string[],
    });

    const [snapshotModalData, setSnapshotModalData] = useState<any>(null);

    const summaryResults = useMemo(() => {
        if (!summaryStartDate || !summaryEndDate) return { startSnapshot: null, endSnapshot: null, period: {usd:0, ars:0} };

        const statusFilteredOps = operations.filter(op => {
            if (operationStatus === 'activas') return !op.cancellationDate && op.arbitrageDate >= today;
            if (operationStatus === 'vencidas') return !!op.cancellationDate || op.arbitrageDate < today;
            return true;
        });
        
        const filteredOps = statusFilteredOps.filter(op => {
            if (summaryFilters.instruments.length > 0 && !summaryFilters.instruments.includes(op.instrument)) return false;
            if (summaryFilters.businessUnitIds.length > 0 && !summaryFilters.businessUnitIds.includes(op.businessUnitId || '')) return false;
            if (summaryFilters.assignmentIds.length > 0 && !summaryFilters.assignmentIds.includes(op.assignmentId || '')) return false;
            if (summaryFilters.operatorIds.length > 0) {
                const operatorId = op.bankId ? `bank-${op.bankId}` : op.brokerId ? `broker-${op.brokerId}` : '';
                if (!summaryFilters.operatorIds.includes(operatorId)) return false;
            }
            return true;
        });

        const endSnapshot = calculatePortfolioSnapshot(summaryEndDate, filteredOps, futureRateHistory, exchangeRates, customFields);
        
        const dateParts = summaryStartDate.split('-').map(Number);
        const startDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        startDate.setUTCDate(startDate.getUTCDate() - 1);
        const prevDayStr = startDate.toISOString().split('T')[0];
        const startSnapshot = calculatePortfolioSnapshot(prevDayStr, filteredOps, futureRateHistory, exchangeRates, customFields);

        const periodPnlUSD = endSnapshot.totals.usd - startSnapshot.totals.usd;
        const periodPnlARS = endSnapshot.totals.ars - startSnapshot.totals.ars;
        
        return { startSnapshot, endSnapshot, period: {usd: periodPnlUSD, ars: periodPnlARS} };
    }, [summaryStartDate, summaryEndDate, summaryFilters, operationStatus, operations, futureRateHistory, exchangeRates, today, customFields]);
    
     const [startDateDisplay, endDateDisplay] = useMemo(() => {
        if (!summaryStartDate) return ['', ''];

        const format = (dateStr: string) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));
            return date.toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
        };
        
        const [year, month, day] = summaryStartDate.split('-').map(Number);
        const startDateObj = new Date(Date.UTC(year, month - 1, day));
        startDateObj.setUTCDate(startDateObj.getUTCDate() - 1);
        const prevDayStr = startDateObj.toISOString().split('T')[0];

        return [format(prevDayStr), format(summaryEndDate)];
    }, [summaryStartDate, summaryEndDate]);

    const openSnapshotModal = (type: 'start' | 'end') => {
        if (type === 'start' && summaryResults.startSnapshot) {
            const [year, month, day] = summaryStartDate.split('-').map(Number);
            const startDateObj = new Date(Date.UTC(year, month - 1, day));
            startDateObj.setUTCDate(startDateObj.getUTCDate() - 1);
            const prevDayStr = startDateObj.toISOString().split('T')[0];

            setSnapshotModalData({
                ...summaryResults.startSnapshot,
                title: `Resultado Acumulado al: ${startDateDisplay}`,
                date: prevDayStr,
            });
        } else if (type === 'end' && summaryResults.endSnapshot) {
            setSnapshotModalData({
                ...summaryResults.endSnapshot,
                title: `Resultado Acumulado al: ${endDateDisplay}`,
                date: summaryEndDate,
            });
        }
    };

    const handleExport = useCallback((format: 'excel' | 'pdf') => {
        if (!summaryResults.startSnapshot || !summaryResults.endSnapshot) {
            alert("No hay datos para exportar.");
            return;
        }

        const realizedDataStart = summaryResults.startSnapshot.realized.map(({ op, pnlArs, pnlUsd }) => ({ ...op, pnl_ars: pnlArs, pnl_usd: pnlUsd }));
        const latentDataStart = summaryResults.startSnapshot.latent.map(({ op, pnlArs, pnlUsd }) => ({ ...op, pnl_ars: pnlArs, pnl_usd: pnlUsd }));
        
        const realizedDataEnd = summaryResults.endSnapshot.realized.map(({ op, pnlArs, pnlUsd }) => ({ ...op, pnl_ars: pnlArs, pnl_usd: pnlUsd }));
        const latentDataEnd = summaryResults.endSnapshot.latent.map(({ op, pnlArs, pnlUsd }) => ({ ...op, pnl_ars: pnlArs, pnl_usd: pnlUsd }));

        const columns: ExportColumn<any>[] = renderableColumns.map(col => ({
            header: col.header,
            accessor: (d: any) => col.accessor(d) ?? '',
        }));

        const fileName = `analisis_arbitraje_${summaryStartDate}_a_${summaryEndDate}`;
        
        if (format === 'excel') {
            exportMultiSheetExcel({
                fileName,
                sheets: [
                    { sheetName: `Realizado al ${startDateDisplay}`, data: realizedDataStart, columns },
                    { sheetName: `Latente al ${startDateDisplay}`, data: latentDataStart, columns },
                    { sheetName: `Realizado al ${endDateDisplay}`, data: realizedDataEnd, columns },
                    { sheetName: `Latente al ${endDateDisplay}`, data: latentDataEnd, columns },
                ]
            });
        } else { // pdf
            exportMultiTablePdf({
                fileName,
                mainTitle: `Análisis de Arbitraje del ${startDateDisplay} al ${endDateDisplay}`,
                tables: [
                    { title: `Resultados Realizados al ${startDateDisplay}`, data: realizedDataStart, columns },
                    { title: `Resultados Latentes al ${startDateDisplay}`, data: latentDataStart, columns },
                    { title: `Resultados Realizados al ${endDateDisplay}`, data: realizedDataEnd, columns },
                    { title: `Resultados Latentes al ${endDateDisplay}`, data: latentDataEnd, columns },
                ]
            });
        }
    }, [summaryResults, renderableColumns, summaryStartDate, summaryEndDate, startDateDisplay, endDateDisplay]);

    const formatARS = (val: number) => val.toLocaleString('es-AR', {style: 'currency', currency: 'ARS'});
    const formatUSD = (val: number) => `USD ${val.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    const operatorOptions = useMemo(() => [...banks.map(b => ({id: `bank-${b.id}`, name: b.name})), ...brokers.map(b => ({id: `broker-${b.id}`, name: b.name}))], [banks, brokers]);

    const ResultDisplay: React.FC<{title: string, ars: number, usd: number, isPeriod?: boolean, onClick?: () => void}> = ({title, ars, usd, isPeriod = false, onClick}) => {
        const color = ars >= 0 ? 'text-green-600' : 'text-red-600';
        const Wrapper = onClick ? 'button' : 'div';
        return (
            <Wrapper onClick={onClick} className={`p-3 rounded-lg text-left w-full ${isPeriod ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' : 'bg-gray-100 dark:bg-gray-800/50'} ${onClick ? 'hover:bg-gray-200 dark:hover:bg-gray-700/50 cursor-pointer transition-colors' : 'cursor-default'}`}>
                <p className={`text-sm font-semibold ${isPeriod ? 'text-blue-800 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300'}`}>{title}</p>
                <p className={`text-xl font-bold ${isPeriod ? color : 'text-gray-800 dark:text-gray-100'}`}>{formatARS(ars)}</p>
                <p className={`text-md font-semibold ${isPeriod ? color : 'text-gray-600 dark:text-gray-300'}`}>{formatUSD(usd)}</p>
            </Wrapper>
        );
    }
    
    const commonInputClass = "mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-700 dark:bg-gray-800 dark:border-gray-600";

    return (
        <>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">Análisis de Resultados Acumulados</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleExport('excel')} className="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-md transition-colors">
                            Exportar Excel
                        </button>
                        <button onClick={() => handleExport('pdf')} className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md transition-colors">
                            Exportar PDF
                        </button>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div><label className="text-sm font-medium text-gray-900 dark:text-gray-300">Desde (inclusive):</label><input type="date" value={summaryStartDate} onChange={e => setSummaryStartDate(e.target.value)} max={summaryEndDate} className={commonInputClass}/></div>
                        <div><label className="text-sm font-medium text-gray-900 dark:text-gray-300">Hasta (inclusive):</label><input type="date" value={summaryEndDate} onChange={e => setSummaryEndDate(e.target.value)} min={summaryStartDate} max={today} className={commonInputClass}/></div>
                        <div>
                            <label className="text-sm font-medium text-gray-900 dark:text-gray-300">Estado:</label>
                            <select value={operationStatus} onChange={(e) => setOperationStatus(e.target.value as any)} className={commonInputClass}>
                               <option value="todas">Todas</option>
                               <option value="activas">Activas</option>
                               <option value="vencidas">Vencidas</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div><label className="text-sm font-medium text-gray-900 dark:text-gray-300">Instrumento</label><MultiSelectDropdown options={[{value: 'ROFEX', label: 'ROFEX'}, {value: 'NDF', label: 'NDF'}, {value: 'NDF Cliente', label: 'NDF Cliente'}]} selectedValues={summaryFilters.instruments} onChange={sel => setSummaryFilters(f => ({...f, instruments: sel}))} placeholder="Todos" /></div>
                        <div><label className="text-sm font-medium text-gray-900 dark:text-gray-300">Unidad Negocio</label><MultiSelectDropdown options={businessUnits.map(o => ({ value: o.id, label: o.name }))} selectedValues={summaryFilters.businessUnitIds} onChange={sel => setSummaryFilters(f => ({...f, businessUnitIds: sel}))} placeholder="Todas" /></div>
                        <div><label className="text-sm font-medium text-gray-900 dark:text-gray-300">Asignación</label><MultiSelectDropdown options={assignments.map(o => ({ value: o.id, label: o.name }))} selectedValues={summaryFilters.assignmentIds} onChange={sel => setSummaryFilters(f => ({...f, assignmentIds: sel}))} placeholder="Todas" /></div>
                        <div><label className="text-sm font-medium text-gray-900 dark:text-gray-300">Operador</label><MultiSelectDropdown options={operatorOptions.map(o => ({ value: o.id, label: o.name }))} selectedValues={summaryFilters.operatorIds} onChange={sel => setSummaryFilters(f => ({...f, operatorIds: sel}))} placeholder="Todos" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t dark:border-gray-600">
                        <ResultDisplay title={`Resultado Acumulado Inicial`} ars={summaryResults.startSnapshot?.totals.ars || 0} usd={summaryResults.startSnapshot?.totals.usd || 0} onClick={() => openSnapshotModal('start')} />
                        <ResultDisplay title={`Resultado Acumulado Final`} ars={summaryResults.endSnapshot?.totals.ars || 0} usd={summaryResults.endSnapshot?.totals.usd || 0} onClick={() => openSnapshotModal('end')} />
                        <ResultDisplay title="Resultado del Período" ars={summaryResults.period.ars} usd={summaryResults.period.usd} isPeriod />
                    </div>
                </div>
            </div>
            {snapshotModalData && (
                <PortfolioSnapshotModal
                    isOpen={!!snapshotModalData}
                    onClose={() => setSnapshotModalData(null)}
                    title={snapshotModalData.title}
                    snapshotDate={snapshotModalData.date}
                    realizedOps={snapshotModalData.realized}
                    latentOps={snapshotModalData.latent}
                    totals={snapshotModalData.totals}
                    renderableColumns={renderableColumns}
                />
            )}
        </>
    );
};


const evaluateFormula = (formula: string, rowData: Record<string, number | undefined>): number | null => {
    if (!formula) return null;
    try {
        const sanitizedFormula = formula.replace(/\{([^}]+)\}/g, (match, fieldName) => {
            const trimmedName = fieldName.trim();
            const value = rowData[trimmedName];
            if (typeof value === 'number' && isFinite(value)) return String(value);
            throw new Error(`Field '${trimmedName}' not found or invalid.`);
        });
        if (!/^[0-9+\-*/().\s]+$/.test(sanitizedFormula)) throw new Error("Invalid characters in formula.");
        return new Function(`return ${sanitizedFormula}`)();
    } catch (error) {
        return null;
    }
};

const calculateAllFields = (op: ArbitrageOperation, customFields: ArbitrageCustomField[]): Record<string, number | string> => {
    const calculatedValues: Record<string, number | string> = { ...op.customData };
    const manualCustomValues: Record<string, number> = {};
    const baseRowData: Record<string, number | undefined> = {
        'Monto USD': op.usdAmount, 'TC Arbitraje': op.arbitrageRate, 'TC Cancelación': op.cancellationRate
    };

    customFields.forEach(field => {
        if (field.fieldType === 'manual' && field.type === 'number' && op.customData?.[field.id]) {
            manualCustomValues[field.name] = Number(op.customData[field.id]);
        }
    });
    Object.assign(baseRowData, manualCustomValues);

    const fieldsToCalculate = customFields.filter(f => f.fieldType === 'calculated');
    let hasChanged = true;
    let iterations = 0;
    while (hasChanged && iterations < fieldsToCalculate.length) {
        hasChanged = false;
        fieldsToCalculate.forEach(field => {
            if (field.formula && !calculatedValues[field.id]) {
                const result = evaluateFormula(field.formula, baseRowData);
                if (result !== null) {
                    calculatedValues[field.id] = result; baseRowData[field.name] = result; hasChanged = true;
                }
            }
        });
        iterations++;
    }
    
    return calculatedValues;
};

const safeFormatDate = (dateString: string | undefined | null) => {
  if (!dateString) return '-';
  const dateParts = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
  if (isNaN(date.getTime())) return 'Fecha Inválida';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

interface ArbitrageModuleProps {}

const DEFAULT_COLUMN_ORDER = [
    'company', 'instrument', 'operator', 'position', 'assignmentId', 'businessUnitId', 'detail', 'startDate', 'arbitrageDate', 'usdAmount',
    'arbitrageRate', 'rofexRate', 'pnlArs', 'pnlUsd', 'cancellationDate'
];

type SortDirection = 'ascending' | 'descending';
interface SortConfig {
  key: string | null;
  direction: SortDirection;
}

const initialAdvancedFilters = {
    instrument: [] as string[],
    position: '',
    businessUnit: [] as string[],
    assignment: [] as string[],
    operator: [] as string[],
    vencimientoStart: '',
    vencimientoEnd: '',
};

export const ArbitrageModule: React.FC<ArbitrageModuleProps> = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, arbitrageOperations: operations, businessUnits, assignments, futureRateHistory, exchangeRates, viewMode, customFields, banks, brokers, debts, investments, debtTypes, investmentTypes, currencies, companies, selectedCompanyId } = state;

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingOperation, setEditingOperation] = useState<ArbitrageOperation | null>(null);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [viewingDetail, setViewingDetail] = useState<{ type: 'debt', debt: Debt } | { type: 'investment', investment: Investment, transaction: Transaction } | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(() => getTodayArgentinaDate().toISOString().split('T')[0]);
    
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [openFilter, setOpenFilter] = useState<string | null>(null);
    const filterPopoverRef = useRef<HTMLDivElement>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'arbitrageDate', direction: 'ascending' });
    const [advancedFilters, setAdvancedFilters] = useState(initialAdvancedFilters);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);

    const onSave = async (opData: Omit<ArbitrageOperation, 'id' | 'companyId'>, id?: string) => {
        try {
            // FIX: Pass selectedCompanyId to the API function.
            const updatedOps = await api.saveArbitrage({ ...opData, companyId: selectedCompanyId! }, id, selectedCompanyId);
            dispatch({ type: 'SAVE_ARBITRAGE_SUCCESS', payload: updatedOps });
        } catch (e) {
            alert('Error al guardar la operación.');
        }
    };
    
    const onDelete = async (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar esta operación?')) {
            try {
                const updatedOps = await api.deleteArbitrage(id);
                dispatch({ type: 'DELETE_ARBITRAGE_SUCCESS', payload: updatedOps });
            } catch (e) {
                alert('Error al eliminar la operación.');
            }
        }
    };

    const arbitrageColumnOrder: string[] = []; 

    const requestSort = (key: string) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
                setOpenFilter(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);


    const canEdit = useMemo(() => {
        if (!currentUser) return false;
        const permission = currentUser.permissions.arbitrage;
        return permission === 'admin' || permission === 'operator';
    }, [currentUser]);


    const handleStartEdit = (op: ArbitrageOperation) => {
        setEditingOperation(op);
        setIsFormOpen(true);
    };

    const handleViewLink = useCallback((op: ArbitrageOperation) => {
        if (op.linkedDebtId) {
            const debt = debts.find(d => d.id === op.linkedDebtId);
            if (debt) setViewingDetail({ type: 'debt', debt });
            else alert('No se pudo encontrar la deuda vinculada.');
        } else if (op.linkedTransactionId) {
            let foundInvestment: Investment | undefined;
            let foundTransaction: Transaction | undefined;
            for (const inv of investments) {
                const tx = inv.transactions.find(t => t.id === op.linkedTransactionId);
                if (tx) { foundInvestment = inv; foundTransaction = tx; break; }
            }
            if (foundInvestment && foundTransaction) setViewingDetail({ type: 'investment', investment: foundInvestment, transaction: foundTransaction });
            else alert('No se pudo encontrar la transacción de inversión vinculada.');
        }
    }, [debts, investments]);

    const getOperatorName = useCallback((op: ArbitrageOperation) => {
        if (op.bankId) return banks.find(b => b.id === op.bankId)?.name || 'N/D';
        if (op.brokerId) return brokers.find(b => b.id === op.brokerId)?.name || 'N/D';
        return 'N/A';
    }, [banks, brokers]);

    const getBusinessUnitName = useCallback((id?: string) => id ? businessUnits.find(bu => bu.id === id)?.name || 'N/D' : 'N/A', [businessUnits]);
    const getAssignmentName = useCallback((id?: string) => id ? assignments.find(a => a.id === id)?.name || 'N/D' : 'N/A', [assignments]);

    const processedOperations = useMemo(() => {
        const snapshotDate = new Date(selectedDate + 'T00:00:00Z');
        const snapshot = [...futureRateHistory].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate)).find(s => s.snapshotDate <= selectedDate);
        const spotRateForSnapshot = [...exchangeRates].sort((a, b) => b.date.localeCompare(a.date)).find(r => r.date <= selectedDate)?.rate;

        return operations.map(op => {
            const calculatedCustomData = calculateAllFields(op, customFields);
            let rofexRate: number | null = null;
            let pnl_ars: number | undefined, pnl_usd: number | undefined;
            const isSettled = (op.cancellationDate || op.arbitrageDate) <= selectedDate;

            if (isSettled) {
                const closingDate = op.cancellationDate || op.arbitrageDate;
                const spotOnClose = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= closingDate)?.rate;
                if(spotOnClose) {
                    rofexRate = op.cancellationRate || spotOnClose;
                    pnl_ars = (op.position === 'Vendida' ? op.arbitrageRate - rofexRate : rofexRate - op.arbitrageRate) * op.usdAmount;
                    pnl_usd = pnl_ars / spotOnClose;
                }
            } else { // Latent P&L
                if (snapshot && spotRateForSnapshot) {
                    rofexRate = getInterpolatedRate(new Date(op.arbitrageDate), snapshot, spotRateForSnapshot);
                    if (rofexRate !== null) {
                        pnl_ars = (op.position === 'Vendida' ? op.arbitrageRate - rofexRate : rofexRate - op.arbitrageRate) * op.usdAmount;
                        pnl_usd = pnl_ars / spotRateForSnapshot;
                    }
                }
            }
            return { ...op, pnl_ars, pnl_usd, rofexRate, calculatedCustomData };
        });
    }, [operations, selectedDate, futureRateHistory, exchangeRates, customFields]);

    const { activeOperations, archivedOperations } = useMemo(() => {
        const snapshotDateStr = new Date().toISOString().split('T')[0];
        const active: any[] = [], archived: any[] = [];
        processedOperations.forEach(op => {
            const closingDate = op.cancellationDate || op.arbitrageDate;
            if (closingDate < snapshotDateStr) archived.push(op);
            else active.push(op);
        });
        return { activeOperations: active, archivedOperations: archived };
    }, [processedOperations]);

    const columnDefinitions = useMemo(() => {
        const defs: Record<string, { header: string; render: (op: typeof activeOperations[0]) => React.ReactNode; accessor: (d: any) => string | number, helpText?: string }> = {
          instrument: { header: 'Instrumento', accessor: d => d.instrument, render: op => <td className="p-2"><div className="flex items-center gap-2"><span className="font-bold text-gray-800 dark:text-gray-100">{op.instrument}</span>{(op.linkedDebtId || op.linkedTransactionId) && (<button onClick={() => handleViewLink(op)} className="flex items-center gap-1 text-xs font-normal bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 hover:bg-blue-200 transition-colors" title={op.linkedDebtId ? "Ver Deuda Vinculada" : "Ver Inversión Vinculada"}><LinkIcon /></button>)}</div></td> },
          operator: { header: 'Operador', accessor: d => getOperatorName(d), render: op => <td className="p-2 text-gray-800 dark:text-gray-200">{getOperatorName(op)}</td> },
          position: { header: 'Posición', accessor: d => d.position, render: op => <td className={`p-2 font-bold ${op.position === 'Comprada' ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{op.position}</td> },
          assignmentId: { header: 'Asignación', accessor: d => getAssignmentName(d.assignmentId), render: op => <td className="p-2 text-gray-800 dark:text-gray-200">{getAssignmentName(op.assignmentId)}</td> },
          businessUnitId: { header: 'Unidad de Negocio', accessor: d => getBusinessUnitName(d.businessUnitId), render: op => <td className="p-2 text-gray-800 dark:text-gray-200">{getBusinessUnitName(op.businessUnitId)}</td> },
          detail: { header: 'Detalle', accessor: d => d.detail || '', render: op => <td className="p-2 text-gray-600 dark:text-gray-400 truncate max-w-xs">{op.detail}</td> },
          startDate: { header: 'Fecha Inicio', accessor: d => d.startDate, render: op => <td className="p-2 text-center text-gray-800 dark:text-gray-200">{safeFormatDate(op.startDate)}</td> },
          arbitrageDate: { header: 'Fecha Vto.', accessor: d => d.arbitrageDate, render: op => <td className="p-2 text-center text-gray-800 dark:text-gray-200">{safeFormatDate(op.arbitrageDate)}</td> },
          usdAmount: { header: 'Monto USD', accessor: d => d.usdAmount, render: op => <td className="p-2 text-right font-bold text-gray-800 dark:text-gray-100">{op.usdAmount.toLocaleString('es-AR')}</td> },
          arbitrageRate: { header: 'TC Arbitraje', accessor: d => d.arbitrageRate, render: op => <td className="p-2 text-right text-gray-800 dark:text-gray-200">{op.arbitrageRate.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td> },
          rofexRate: { header: 'TC Cierre (MTM)', helpText: "Es el 'Mark-to-Market' o 'Marcación a Mercado'. Representa el tipo de cambio de cierre para la fecha de vencimiento de esta operación, según la curva de futuros del día del snapshot. Se usa para calcular el resultado latente (no realizado) de la operación.", accessor: d => d.rofexRate || -Infinity, render: op => <td className="p-2 text-right text-gray-800 dark:text-gray-200">{op.rofexRate ? op.rofexRate.toLocaleString('es-AR', {minimumFractionDigits: 2}) : '-'}</td> },
          pnlArs: { header: 'Res. (ARS)', helpText: "Muestra la Ganancia o Pérdida latente de la operación, calculada como la diferencia entre el 'TC de Arbitraje' y el 'TC de Cierre (MTM)'.", accessor: d => d.pnl_ars || -Infinity, render: op => <td className={`p-2 text-right font-bold ${op.pnl_ars === null || op.pnl_ars === undefined ? 'text-gray-800 dark:text-gray-200' : op.pnl_ars >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{op.pnl_ars?.toLocaleString('es-AR', {style: 'currency', currency: 'ARS'}) ?? '-'}</td> },
          pnlUsd: { header: 'Res. (USD)', helpText: "Muestra la Ganancia o Pérdida latente de la operación en USD, calculada dividiendo el resultado en ARS por el tipo de cambio spot del día del snapshot.", accessor: d => d.pnl_usd || -Infinity, render: op => <td className={`p-2 text-right font-bold ${op.pnl_usd === null || op.pnl_usd === undefined ? 'text-gray-800 dark:text-gray-200' : op.pnl_usd >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{op.pnl_usd?.toLocaleString('es-AR', {minimumFractionDigits: 2}) ?? '-'}</td> },
          cancellationDate: { header: 'Fecha Canc.', accessor: d => d.cancellationDate || 'N/A', render: op => <td className="p-2 text-center text-gray-800 dark:text-gray-200">{safeFormatDate(op.cancellationDate)}</td> },
        };
        
        if (viewMode === 'consolidated') {
            defs.company = { 
                header: 'Empresa', 
                accessor: d => companies.find(c => c.id === d.companyId)?.name || 'N/D',
                render: op => <td className="p-2 text-gray-800 dark:text-gray-200 font-semibold">{companies.find(c => c.id === op.companyId)?.name || 'N/D'}</td> 
            };
        }

        customFields.forEach(field => {
          defs[field.id] = { header: field.name, accessor: (d: any) => d.customData[field.name] || '', render: op => {
            const value = op.calculatedCustomData?.[field.id];
            const formatted = typeof value === 'number' ? value.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : value || '';
            return <td className="p-2 text-gray-800 dark:text-gray-200 text-right">{formatted}</td>;
          }};
        });
        return defs;
    }, [customFields, banks, brokers, businessUnits, assignments, handleViewLink, getOperatorName, getAssignmentName, getBusinessUnitName, viewMode, companies]);

    const renderableColumns = useMemo(() => {
        const order = arbitrageColumnOrder.length > 0 ? arbitrageColumnOrder : DEFAULT_COLUMN_ORDER;
        const allKeys = new Set([...order, ...Object.keys(columnDefinitions), ...customFields.map(f => f.id)]);
        return Array.from(allKeys).map(key => ({ key, ...columnDefinitions[key] })).filter(c => c.header);
    }, [arbitrageColumnOrder, columnDefinitions, customFields]);

    const advancedFilteredOperations = useMemo(() => {
        const { instrument, position, businessUnit, assignment, operator, vencimientoStart, vencimientoEnd } = advancedFilters;
        const hasAdvancedFilters = instrument.length > 0 || position || businessUnit.length > 0 || assignment.length > 0 || operator.length > 0 || vencimientoStart || vencimientoEnd;

        if (!hasAdvancedFilters) return activeOperations;

        return activeOperations.filter(op => {
            const opOperatorId = op.bankId ? `bank-${op.bankId}` : op.brokerId ? `broker-${op.brokerId}` : '';
            const instrumentMatch = instrument.length === 0 || instrument.includes(op.instrument);
            const positionMatch = !position || op.position === position;
            const buMatch = businessUnit.length === 0 || (op.businessUnitId && businessUnit.includes(op.businessUnitId));
            const assignmentMatch = assignment.length === 0 || (op.assignmentId && assignment.includes(op.assignmentId));
            const operatorMatch = operator.length === 0 || (opOperatorId && operator.includes(opOperatorId));
            const startDateMatch = !vencimientoStart || op.arbitrageDate >= vencimientoStart;
            const endDateMatch = !vencimientoEnd || op.arbitrageDate <= vencimientoEnd;
            return instrumentMatch && positionMatch && buMatch && assignmentMatch && operatorMatch && startDateMatch && endDateMatch;
        });
    }, [activeOperations, advancedFilters]);
    
    const sortedOperations = useMemo(() => {
        let sortableItems = [...advancedFilteredOperations];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aValue = (columnDefinitions as any)[sortConfig.key!].accessor(a);
                const bValue = (columnDefinitions as any)[sortConfig.key!].accessor(b);
                if (aValue === null || aValue === undefined || aValue === -Infinity) return 1;
                if (bValue === null || bValue === undefined || bValue === -Infinity) return -1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [advancedFilteredOperations, sortConfig, columnDefinitions]);
    
    const filteredOperations = useMemo(() => {
        if (Object.keys(columnFilters).every(key => !columnFilters[key] || (columnFilters[key] as string[]).length === 0)) return sortedOperations;
        return sortedOperations.filter(op => {
            return Object.entries(columnFilters).every(([key, values]) => {
                if ((values as string[]).length === 0) return true;
                const colDef = (columnDefinitions as any)[key];
                if (!colDef || !colDef.accessor) return true;
                const value = String(colDef.accessor(op));
                return (values as string[]).includes(value);
            });
        });
    }, [sortedOperations, columnFilters, columnDefinitions]);

    const exportColumns = useMemo((): ExportColumn<any>[] => {
        const columns: ExportColumn<any>[] = [
            { header: 'Instrumento', accessor: d => d.instrument },
            { header: 'Operador', accessor: d => getOperatorName(d) },
            { header: 'Posición', accessor: d => d.position },
            { header: 'Asignación', accessor: d => getAssignmentName(d.assignmentId) },
            { header: 'Unidad de Negocio', accessor: d => getBusinessUnitName(d.businessUnitId) },
            { header: 'Detalle', accessor: d => d.detail || '' },
            { header: 'Fecha Inicio', accessor: d => safeFormatDate(d.startDate) },
            { header: 'Fecha Vto.', accessor: d => safeFormatDate(d.arbitrageDate) },
            { header: 'Monto USD', accessor: d => d.usdAmount },
            { header: 'TC Arbitraje', accessor: d => d.arbitrageRate },
            { header: 'TC Cierre (MTM)', accessor: d => d.rofexRate ?? '' },
            { header: 'Res. (ARS)', accessor: d => d.pnl_ars ?? '' },
            { header: 'Res. (USD)', accessor: d => d.pnl_usd ?? '' },
            { header: 'Fecha Canc.', accessor: d => safeFormatDate(d.cancellationDate) },
            ...customFields.map(field => ({
                header: field.name,
                accessor: (d: any) => d.calculatedCustomData?.[field.id] ?? d.customData?.[field.id] ?? ''
            }))
        ];
        if (viewMode === 'consolidated') {
            columns.unshift({ header: 'Empresa', accessor: d => companies.find(c => c.id === d.companyId)?.name || 'N/D' });
        }
        return columns;
    }, [getOperatorName, getAssignmentName, getBusinessUnitName, customFields, viewMode, companies]);

    const FilterPopover: React.FC<{ columnKey: string; onApply: (columnKey: string, values: string[]) => void; }> = ({ columnKey, onApply }) => {
      const colDef = (columnDefinitions as any)[columnKey];
      const allValues = useMemo(() => [...new Set(activeOperations.map(op => String(colDef.accessor(op))))].sort(), [activeOperations, colDef]);
      const currentFilter = columnFilters[columnKey] || [];
      const [searchTerm, setSearchTerm] = useState('');
      const [selected, setSelected] = useState(new Set(currentFilter));
      const filteredValues = useMemo(() => allValues.filter(val => val.toLowerCase().includes(searchTerm.toLowerCase())), [allValues, searchTerm]);
  
      const handleToggle = (value: string) => setSelected(prev => { const newSet = new Set(prev); if (newSet.has(value)) newSet.delete(value); else newSet.add(value); return newSet; });
      const handleSelectAll = () => setSelected(new Set(allValues));
      const handleClearAll = () => setSelected(new Set());
      const handleApply = () => { onApply(columnKey, Array.from(selected)); setOpenFilter(null); };
  
      return (
          <div className="w-64 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-xl p-3 space-y-2 text-gray-800 dark:text-gray-200" onClick={e => e.stopPropagation()}>
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-2 py-1 border border-gray-300 dark:border-gray-500 rounded-md text-sm bg-white dark:bg-gray-700" />
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 text-sm">
                  {filteredValues.map(value => (
                      <div key={value} className="flex items-center gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                          <input type="checkbox" checked={selected.has(value)} onChange={() => handleToggle(value)} id={`filter-opt-${columnKey}-${value}`} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:bg-gray-900"/>
                          <label htmlFor={`filter-opt-${columnKey}-${value}`} className="truncate flex-1 cursor-pointer">{value}</label>
                      </div>
                  ))}
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t dark:border-gray-600">
                  <button onClick={handleSelectAll} className="text-blue-600 hover:underline">Seleccionar todo</button>
                  <button onClick={handleClearAll} className="text-blue-600 hover:underline">Limpiar todo</button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setOpenFilter(null)} className="text-sm px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded">Cancelar</button>
                  <button onClick={handleApply} className="text-sm px-3 py-1 bg-primary text-white rounded">Aplicar</button>
              </div>
          </div>
      );
    };
    
    const ThWithSortingAndFiltering: React.FC<{ columnKey: string; }> = ({ columnKey }) => {
        const col = (columnDefinitions as any)[columnKey];
        if (!col) return null;
        const { header, helpText } = col;
        const isFilterActive = columnFilters[columnKey] && (columnFilters[columnKey] as string[]).length > 0;
        const sortIcon = sortConfig.key === columnKey ? (sortConfig.direction === 'ascending' ? <ChevronUpIcon /> : <ChevronDownIcon />) : null;
        return (
            <th className="p-2 text-left font-bold text-gray-700 dark:text-gray-300 group">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => requestSort(columnKey)}>
                      <span>{header}</span>
                      {helpText && <HelpTooltip text={helpText} />}
                      <div className="w-4 h-4 flex items-center justify-center">
                          {sortIcon ? sortIcon : <ChevronUpIcon className="text-gray-400 opacity-0 group-hover:opacity-50 transition-opacity" />}
                      </div>
                    </div>
                    <div className="relative">
                         <button
                            onClick={(e) => { e.stopPropagation(); setOpenFilter(prev => prev === columnKey ? null : columnKey)}}
                            className={`p-1 rounded transition-colors ${openFilter === columnKey ? 'bg-primary/20' : ''} ${isFilterActive ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
                            aria-label={`Filtrar por ${header}`}
                        >
                          {isFilterActive ? <FilterSolidIcon /> : <FilterIcon />}
                        </button>
                        {openFilter === columnKey && ( <div ref={filterPopoverRef} className="absolute top-full right-0 z-20 mt-2"><FilterPopover columnKey={columnKey} onApply={(key, values) => setColumnFilters(prev => ({...prev, [key]: values}))} /></div> )}
                    </div>
                </div>
            </th>
        );
    }

    const handleFilterChange = (filterName: keyof typeof advancedFilters, value: any) => setAdvancedFilters(prev => ({ ...prev, [filterName]: value }));
    const instrumentOptions: MultiSelectOption[] = [{value: 'ROFEX', label: 'ROFEX'}, {value: 'NDF', label: 'NDF'}, {value: 'NDF Cliente', label: 'NDF Cliente'}];
    const buOptions: MultiSelectOption[] = useMemo(() => businessUnits.map(o => ({ value: o.id, label: o.name })), [businessUnits]);
    const assignmentOptions: MultiSelectOption[] = useMemo(() => assignments.map(o => ({ value: o.id, label: o.name })), [assignments]);
    const operatorOptions: MultiSelectOption[] = useMemo(() => [
        ...banks.map(b => ({ value: `bank-${b.id}`, label: b.name })),
        ...brokers.map(b => ({ value: `broker-${b.id}`, label: b.name }))
    ].sort((a,b) => a.label.localeCompare(b.label)), [banks, brokers]);
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Módulo de Arbitrajes</h1>
                {canEdit && (
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsArchiveOpen(true)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold py-2 px-4 rounded-lg">Ver Archivo</button>
                        {viewMode === 'individual' && (
                            <button onClick={() => { setEditingOperation(null); setIsFormOpen(true); }} className="flex items-center gap-2 bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg shadow-md"><PlusCircleIcon /> Agregar Operación</button>
                        )}
                    </div>
                )}
            </div>
            <ArbitrageAnalysis operations={operations} businessUnits={businessUnits} assignments={assignments} banks={banks} brokers={brokers} futureRateHistory={futureRateHistory} exchangeRates={exchangeRates} customFields={customFields} renderableColumns={renderableColumns} getBusinessUnitName={getBusinessUnitName} getAssignmentName={getAssignmentName} getOperatorName={getOperatorName} />
            <ArbitrageSummaryVisuals activeOperations={filteredOperations} businessUnits={businessUnits} assignments={assignments} banks={banks} brokers={brokers} getBusinessUnitName={getBusinessUnitName} getAssignmentName={getAssignmentName} getOperatorName={getOperatorName} />
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border dark:border-gray-700">
                <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-2"><FilterIcon /><h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Filtros Avanzados</h3></div><button onClick={() => setIsFilterPanelOpen(p => !p)} className="text-primary dark:text-accent-dm">{isFilterPanelOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}</button></div>
                 {isFilterPanelOpen && (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end animate-fade-in">
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-sm font-medium">Instrumento</label><MultiSelectDropdown options={instrumentOptions} selectedValues={advancedFilters.instrument} onChange={v => handleFilterChange('instrument', v)} placeholder="Todos" /></div><div><label className="text-sm font-medium">Posición</label><select value={advancedFilters.position} onChange={e => handleFilterChange('position', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2 h-10"><option value="">Todas</option><option>Comprada</option><option>Vendida</option></select></div></div>
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="text-sm font-medium">Unidad Negocio</label><MultiSelectDropdown options={buOptions} selectedValues={advancedFilters.businessUnit} onChange={v => handleFilterChange('businessUnit', v)} placeholder="Todas" /></div><div><label className="text-sm font-medium">Asignación</label><MultiSelectDropdown options={assignmentOptions} selectedValues={advancedFilters.assignment} onChange={v => handleFilterChange('assignment', v)} placeholder="Todas" /></div><div><label className="text-sm font-medium">Operador</label><MultiSelectDropdown options={operatorOptions} selectedValues={advancedFilters.operator} onChange={v => handleFilterChange('operator', v)} placeholder="Todos" /></div></div>
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4"><div><label className="text-sm font-medium">Vencimiento Desde</label><input type="date" value={advancedFilters.vencimientoStart} onChange={e => handleFilterChange('vencimientoStart', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2 h-10"/></div><div><label className="text-sm font-medium">Vencimiento Hasta</label><input type="date" value={advancedFilters.vencimientoEnd} onChange={e => handleFilterChange('vencimientoEnd', e.target.value)} min={advancedFilters.vencimientoStart} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2 h-10"/></div></div>
                    <div className="lg:col-start-4 flex justify-end"><button onClick={() => setAdvancedFilters(initialAdvancedFilters)} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold py-2 px-4 rounded-lg h-10"><ArrowUturnLeftIcon /> Limpiar Filtros</button></div>
                 </div>)}
            </div>
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Cartera de Operaciones Activas</h2>
                    <div className="flex items-center gap-4">
                         <ExportButtons data={filteredOperations} columns={exportColumns} fileName={`arbitrajes_activos_${selectedDate}`} pdfTitle={`Arbitrajes Activos - Snapshot al ${new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'})}`} />
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Snapshot al:</label>
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} max={getTodayArgentinaDate().toISOString().split('T')[0]} className="block border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
                        </div>
                    </div>
                </div>
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
                    {filteredOperations.length > 0 ? (
                        <table className="min-w-full text-xs">
                            <thead className="bg-gray-100 dark:bg-gray-700"><tr>{renderableColumns.map(col => <ThWithSortingAndFiltering key={col.key} columnKey={col.key} />)}<th className="p-2 text-left font-bold text-gray-700 dark:text-gray-300">Acciones</th></tr></thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">{filteredOperations.map(op => (<tr key={op.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">{renderableColumns.map(col => col.render(op))}<td className="p-2">{viewMode === 'individual' && canEdit && (<div className="flex items-center justify-center gap-3"><button onClick={() => handleStartEdit(op)} className="text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed" disabled={!!op.linkedDebtId || !!op.linkedTransactionId} title={(op.linkedDebtId || op.linkedTransactionId) ? "Gestionar desde el módulo de origen" : "Editar"}><PencilIcon /></button><button onClick={() => onDelete(op.id)} className="text-red-600 disabled:text-gray-400 disabled:cursor-not-allowed" disabled={!!op.linkedDebtId || !!op.linkedTransactionId} title={(op.linkedDebtId || op.linkedTransactionId) ? "Gestionar desde el módulo de origen" : "Eliminar"}><TrashIcon /></button></div>)}</td></tr>))}</tbody>
                        </table>
                    ) : <p className="p-8 text-center text-gray-500">No hay operaciones activas que coincidan con los filtros.</p>}
                 </div>
            </div>
            {isFormOpen && <ArbitrageForm operationToEdit={editingOperation} onSave={onSave} onClose={() => setIsFormOpen(false)} {...{ businessUnits, assignments, customFields, banks, brokers }} />}
            <ExpiredArbitrageModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} allOperations={archivedOperations} onStartEdit={handleStartEdit} onDelete={onDelete} onShowLink={handleViewLink} {...{ banks, brokers, businessUnits, assignments, customFields, columnOrder: [], exchangeRates, futureRateHistory }}/>
            {viewingDetail?.type === 'debt' && <DebtDetailModal debt={viewingDetail.debt} banks={banks} brokers={brokers} debtTypes={debtTypes} currencies={currencies} onClose={() => setViewingDetail(null)} />}
            {viewingDetail?.type === 'investment' && <InvestmentDetailModal investment={viewingDetail.investment} transaction={viewingDetail.transaction} banks={banks} brokers={brokers} investmentTypes={investmentTypes} currencies={currencies} onClose={() => setViewingDetail(null)} />}
        </div>
    );
};
