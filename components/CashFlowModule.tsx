
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppContext } from '../App';
import { useFinancialCalculations } from '../utils/calculations';
import { Currency } from '../types';
import type { Debt, Investment, GrainCollection, CashAccount, DebtType, InvestmentGroup, CollectionAdjustment } from '../types';
import { getTodayArgentinaDate, calculateFinancialsForDate, daysBetween } from '../utils/financials';
import FormattedNumberInput, { parseFormattedNumber } from './FormattedNumberInput';
import { PlusCircleIcon, TrashIcon, ChartBarIcon, ArrowsUpDownIcon } from './Icons';
import ExpandedCashFlowModal from './ExpandedCashFlowModal';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import CashFlowCellDetailModal from './CashFlowCellDetailModal';
import VarianceAnalysisChart from './VarianceAnalysisChart';

type ViewMode = 'daily' | 'weekly' | 'monthly';

const STATIC_ROW_CONFIG = [
    { key: 'SALDO_INICIO', label: 'SALDO INICIO', type: 'balance' as const, section: 'header' as const, style: 'bg-slate-500 text-white dark:bg-slate-600 font-bold' },
    { key: 'COBRANZAS', label: 'COBRANZAS', type: 'inflow' as const, section: 'inflows' as const, style: 'bg-green-50 dark:bg-green-900/20 font-semibold' },
    { key: 'INVERSIONES', label: 'Inversiones', type: 'inout' as const, section: 'financial' as const, style: 'bg-blue-100 dark:bg-blue-900/30' },
    { key: 'IMPUESTOS_SUELDOS', label: 'Impuestos/Sueldos', type: 'outflow' as const, section: 'other' as const, style: 'bg-green-100 dark:bg-green-900/30' },
];

const CashFlowModule: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, viewMode: appViewMode } = state;
    const financialCalculations = useFinancialCalculations();
    const { companyDebts, companyInvestments, companyGrainCollections, banks, appSettings, cashAccounts, debtTypes, holidays, latestRate, companyCollectionAdjustments, investmentGroups } = financialCalculations;
    
    // FIX: Define today variable using getTodayArgentinaDate() helper.
    const today = useMemo(() => getTodayArgentinaDate(), []);

    const [viewMode, setViewMode] = useState<ViewMode>('monthly');
    const [startDate, setStartDate] = useState(() => {
        const d = getTodayArgentinaDate();
        d.setUTCMonth(d.getUTCMonth() - 2); // Ver 2 meses hacia atrás para ver lo "Real"
        d.setUTCDate(1);
        return d;
    });
    const [showComparison, setShowComparison] = useState(true);
    const [manualFlows, setManualFlows] = useState<Record<string, Record<string, number>>>({});
    const [customRows, setCustomRows] = useState<{ id: string; name: string }[]>([]);
    const [newRowName, setNewRowName] = useState('');
    const [editingCell, setEditingCell] = useState<{ rowKey: string; date: string } | null>(null);
    const [editValue, setEditValue] = useState<number | ''>('');
    const [editableInitialBalance, setEditableInitialBalance] = useState<number | ''>('');
    const [isExpandedFlowModalOpen, setIsExpandedFlowModalOpen] = useState(false);
    const [detailModalData, setDetailModalData] = useState<any>(null);

    const canEdit = useMemo(() => {
        if (!currentUser) return false;
        if (appViewMode === 'consolidated') return false;
        return currentUser.role === 'admin' || currentUser.role === 'operator';
    }, [currentUser, appViewMode]);

    const allRows = useMemo(() => {
        const debtTypeRows = debtTypes.map(dt => ({
            key: `debt-type-${dt.id}`,
            label: dt.name,
            type: 'inout' as const,
            section: 'financial' as const,
            style: 'bg-blue-50 dark:bg-blue-900/10'
        }));
        const newRows = [...STATIC_ROW_CONFIG];
        newRows.splice(3, 0, ...debtTypeRows);
        return [...newRows, ...customRows.map(r => ({ key: r.id, label: r.name, type: 'inout' as const, section: 'custom' as const, style: '' }))];
    }, [debtTypes, customRows]);

    const { columns, flowsByStatus, initialBalance } = useMemo(() => {
        let cols: { date: string, label: string }[] = [];
        const numCols = viewMode === 'daily' ? 14 : viewMode === 'weekly' ? 8 : 12;
        const getColKey = (d: Date): string => {
            if (viewMode === 'monthly') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
            return d.toISOString().split('T')[0];
        };
        
        let currentDate = new Date(startDate);
        for (let i = 0; i < numCols; i++) {
            const colKey = getColKey(currentDate);
            cols.push({ date: colKey, label: viewMode === 'monthly' ? currentDate.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }) : colKey });
            if (viewMode === 'daily') currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            else if (viewMode === 'weekly') currentDate.setUTCDate(currentDate.getUTCDate() + 7);
            else currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
        }
        
        const periodEndDate = new Date(currentDate);
        const flows: Record<string, Record<string, { projected: number, real: number }>> = {};

        const addFlow = (rowKey: string, dateStr: string, amount: number, isReal: boolean) => {
            if (amount === 0 || !dateStr) return;
            const date = new Date(dateStr + 'T00:00:00Z');
            if (date.getTime() < startDate.getTime() || date.getTime() >= periodEndDate.getTime()) return;

            let colKey: string | undefined;
            if (viewMode === 'monthly') colKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            else colKey = cols.find(c => {
                const cDate = new Date(c.date + 'T00:00:00Z');
                if (viewMode === 'daily') return c.date === dateStr;
                const cEnd = new Date(cDate); cEnd.setUTCDate(cEnd.getUTCDate() + 7);
                return date >= cDate && date < cEnd;
            })?.date;

            if (!colKey) return;
            if (!flows[rowKey]) flows[rowKey] = {};
            if (!flows[rowKey][colKey]) flows[rowKey][colKey] = { projected: 0, real: 0 };
            
            flows[rowKey][colKey].projected += amount;
            if (isReal) flows[rowKey][colKey].real += amount;
        };

        // Procesar Cobranzas
        companyGrainCollections.forEach(c => {
            const date = c.actualCollectionDate || c.dueDate;
            const netAmount = c.finalNetAmount ?? (c.grossAmount * (1 - c.tentativeDeductionPercentage/100));
            const amount = c.movementType === 'Débito' ? netAmount : -netAmount;
            addFlow('COBRANZAS', date, amount, c.status === 'collected');
        });

        // Procesar Deudas
        companyDebts.forEach(d => {
            // FIX: Use the 'today' variable defined at the top of the component.
            const financials = calculateFinancialsForDate(d, today, appSettings);
            const factor = d.currency === Currency.USD ? latestRate : 1;
            addFlow(`debt-type-${debtTypes.find(dt => dt.name === d.type)?.id}`, d.originationDate, financials.netDisbursed * factor, false);
            addFlow(`debt-type-${debtTypes.find(dt => dt.name === d.type)?.id}`, d.dueDate, -financials.totalToRepay * factor, d.status === 'cancelled');
        });

        return { columns: cols, flowsByStatus: flows, initialBalance: cashAccounts.find(ca => ca.currency === Currency.ARS)?.initialBalance || 0 };
    }, [viewMode, startDate, companyGrainCollections, companyDebts, latestRate, cashAccounts, debtTypes, appSettings, today]);

    // Cálculo de Saldos Acumulados
    const { projectedBalances, realBalances, variances } = useMemo(() => {
        const proj: Record<string, number> = {};
        const real: Record<string, number> = {};
        const v: Record<string, number> = {};
        let runningProj = Number(editableInitialBalance || initialBalance);
        let runningReal = Number(editableInitialBalance || initialBalance);

        columns.forEach(col => {
            let colProjNet = 0;
            let colRealNet = 0;
            allRows.forEach(row => {
                if (row.type === 'balance') return;
                const f = flowsByStatus[row.key]?.[col.date] || { projected: 0, real: 0 };
                colProjNet += f.projected + (manualFlows[row.key]?.[col.date] || 0);
                colRealNet += f.real;
            });
            runningProj += colProjNet;
            runningReal += colRealNet;
            proj[col.date] = runningProj;
            real[col.date] = runningReal;
            v[col.date] = colRealNet - colProjNet;
        });
        return { projectedBalances: proj, realBalances: real, variances: v };
    }, [columns, allRows, flowsByStatus, manualFlows, initialBalance, editableInitialBalance]);

    // Data para el gráfico de Variance
    const chartData = useMemo(() => {
        return columns.map(col => {
            let projIn = 0, realIn = 0, projOut = 0, realOut = 0;
            allRows.forEach(row => {
                const f = flowsByStatus[row.key]?.[col.date] || { projected: 0, real: 0 };
                if (f.projected > 0) projIn += f.projected; else projOut += Math.abs(f.projected);
                if (f.real > 0) realIn += f.real; else realOut += Math.abs(f.real);
            });
            return { month: col.label, projIn, realIn, projOut, realOut };
        });
    }, [columns, allRows, flowsByStatus]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Control de Gestión: Real vs. Proyectado</h1>
                <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button onClick={() => setViewMode('daily')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${viewMode==='daily'?'bg-white shadow text-primary':'text-gray-500'}`}>DIARIO</button>
                    <button onClick={() => setViewMode('monthly')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${viewMode==='monthly'?'bg-white shadow text-primary':'text-gray-500'}`}>MENSUAL</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-primary" />
                        Análisis de Cumplimiento (Variance)
                    </h3>
                    <VarianceAnalysisChart data={chartData} />
                </div>
                <div className="space-y-4">
                    <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
                        <h4 className="text-xs font-black uppercase text-primary mb-1">Estado de Sincronización</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">Conectado a CORE Gestión v4.2</p>
                        <div className="mt-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-gray-500">Última actualización: Hoy, 09:15 AM</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">Resumen de Desvíos</h4>
                        <div className="space-y-3">
                            {columns.slice(-3).map(col => (
                                <div key={col.date} className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500">{col.label}</span>
                                    <span className={`font-black ${variances[col.date] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {variances[col.date] > 0 ? '+' : ''}{variances[col.date].toLocaleString('es-AR', {maximumFractionDigits:0})}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 uppercase text-xs tracking-widest">Matriz de Flujos Consolidados</h3>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer">
                            <input type="checkbox" checked={showComparison} onChange={e => setShowComparison(e.target.checked)} className="rounded text-primary" />
                            VER COMPARATIVA REAL
                        </label>
                        <ExportButtons data={[]} columns={[]} fileName="cashflow_real" pdfTitle="Control de Gestión" />
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50">
                                <th className="sticky left-0 bg-gray-50 dark:bg-gray-900 z-20 p-2 border text-left min-w-[180px]">CONCEPTO</th>
                                {columns.map(col => <th key={col.date} className="p-2 border text-center min-w-[110px]">{col.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {allRows.map(row => (
                                <tr key={row.key} className={`${row.style || ''} hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors`}>
                                    <td className="sticky left-0 z-10 p-2 border font-bold bg-inherit">{row.label}</td>
                                    {columns.map(col => {
                                        const f = flowsByStatus[row.key]?.[col.date] || { projected: 0, real: 0 };
                                        const val = f.projected + (manualFlows[row.key]?.[col.date] || 0);
                                        return (
                                            <td key={col.date} className="p-2 border text-right">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-800 dark:text-gray-200">{val !== 0 ? val.toLocaleString('es-AR', {maximumFractionDigits:0}) : '-'}</span>
                                                    {showComparison && f.real !== 0 && (
                                                        <span className="text-[9px] text-primary font-black italic">REAL: {f.real.toLocaleString('es-AR', {maximumFractionDigits:0})}</span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            <tr className="bg-slate-100 dark:bg-slate-900/50 font-black">
                                <td className="sticky left-0 z-10 p-2 border bg-inherit">VARIANCE (DESVÍO)</td>
                                {columns.map(col => (
                                    <td key={col.date} className={`p-2 border text-right ${variances[col.date] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {variances[col.date].toLocaleString('es-AR', {maximumFractionDigits:0})}
                                    </td>
                                ))}
                            </tr>
                            <tr className="bg-gray-800 text-white font-black text-xs">
                                <td className="sticky left-0 z-10 p-2 border bg-inherit uppercase">Saldo Final Proyectado</td>
                                {columns.map(col => (
                                    <td key={col.date} className="p-2 border text-right">
                                        {projectedBalances[col.date].toLocaleString('es-AR', {maximumFractionDigits:0})}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CashFlowModule;
