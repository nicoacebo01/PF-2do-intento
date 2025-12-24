// This is a new file: components/ExpandedCashFlowModal.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Currency } from '../types';
import type { Debt, Investment, GrainCollection, CashAccount, DebtType, InvestmentGroup } from '../types';
import { getTodayArgentinaDate, calculateFinancialsForDate, daysBetween } from '../utils/financials';
import FormattedNumberInput, { parseFormattedNumber } from './FormattedNumberInput';
import { PlusCircleIcon, TrashIcon, XIcon } from './Icons';
import type { useFinancialCalculations } from '../utils/calculations';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import CashFlowCellDetailModal from './CashFlowCellDetailModal';

type ViewMode = 'daily' | 'weekly' | 'monthly';

const STATIC_ROW_CONFIG = [
    { key: 'SALDO_INICIO', label: 'SALDO INICIO', type: 'balance' as const, section: 'header' as const, style: 'bg-slate-500 text-white dark:bg-slate-600 font-bold' },
    { key: 'COBRANZAS', label: 'COBRANZAS', type: 'inflow' as const, section: 'inflows' as const, style: 'bg-green-50 dark:bg-green-900/20 font-semibold' },
    { key: 'PRODUCTORES_TRANSFERENCIA', label: 'Productores (Transferencia)', type: 'inflow' as const, section: 'inflows' as const },
    { key: 'PRODUCTORES_CHEQUES', label: 'Productores (Cheques)', type: 'inflow' as const, section: 'inflows' as const },
    { key: 'PROVEEDORES_ACSA', label: 'Proveedores', type: 'outflow' as const, section: 'outflows' as const },
    { key: 'FLETES', label: 'Fletes', type: 'outflow' as const, section: 'outflows' as const },
    { key: 'PROVEEDORES_INSUMOS', label: 'Proveedores Insumos', type: 'outflow' as const, section: 'outflows' as const },
    { key: 'INVERSIONES', label: 'Inversiones', type: 'inout' as const, section: 'financial' as const, style: 'bg-blue-100 dark:bg-blue-900/30' },
    { key: 'IMPUESTOS_SUELDOS', label: 'Impuestos/Sueldos', type: 'outflow' as const, section: 'other' as const, style: 'bg-green-100 dark:bg-green-900/30' },
];

interface ExpandedCashFlowModalProps {
    isOpen: boolean;
    onClose: () => void;
    financialData: ReturnType<typeof useFinancialCalculations>;
}

const ExpandedCashFlowModal: React.FC<ExpandedCashFlowModalProps> = ({ isOpen, onClose, financialData }) => {
    const { companyDebts, companyInvestments, companyGrainCollections, banks, appSettings, cashAccounts, debtTypes, holidays, latestRate, companyCollectionAdjustments } = financialData;
    
    const [viewMode, setViewMode] = useState<ViewMode>('daily');
    const [startDate, setStartDate] = useState(() => getTodayArgentinaDate());
    const [manualFlows, setManualFlows] = useState<Record<string, Record<string, number>>>({});
    const [customRows, setCustomRows] = useState<{ id: string; name: string }[]>([]);
    const [newRowName, setNewRowName] = useState('');
    const [editingCell, setEditingCell] = useState<{ rowKey: string; date: string } | null>(null);
    const [editValue, setEditValue] = useState<number | ''>('');
    const [editableInitialBalance, setEditableInitialBalance] = useState<number | ''>('');
    const [detailModalData, setDetailModalData] = useState<{
        isOpen: boolean;
        title: string;
        items: { description: string; amount: number; currency: string; date: string }[];
    } | null>(null);

    const allRows = useMemo(() => {
        const financialSectionIndex = STATIC_ROW_CONFIG.findIndex(r => r.section === 'financial');

        const debtTypeRows = debtTypes.map(dt => ({
            key: `debt-type-${dt.id}`,
            label: dt.name,
            type: 'inout' as const,
            section: 'financial' as const,
            style: 'bg-blue-100 dark:bg-blue-900/30'
        }));

        const newRows = [...STATIC_ROW_CONFIG];
        if (financialSectionIndex !== -1) {
            newRows.splice(financialSectionIndex + 1, 0, ...debtTypeRows);
        }
        
        return [...newRows, ...customRows.map(r => ({ key: r.id, label: r.name, type: 'inout' as const, section: 'custom' as const, style: '' }))];
    }, [debtTypes, customRows]);

    const { columns, automatedFlows, initialBalance } = useMemo(() => {
        let cols: { date: string, label: string }[] = [];
        const flows: Record<string, Record<string, number>> = {};
        const numCols = viewMode === 'daily' ? 90 : viewMode === 'weekly' ? 26 : 24;

        const getColKey = (d: Date): string => {
            if (viewMode === 'monthly') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
            return d.toISOString().split('T')[0];
        };
        
        let currentDate = new Date(startDate);
        for (let i = 0; i < numCols; i++) {
            const colKey = getColKey(currentDate);
            let label = '';
            if (viewMode === 'daily') {
                label = currentDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                cols.push({ date: colKey, label });
                currentDate.setDate(currentDate.getDate() + 1);
            } else if (viewMode === 'weekly') {
                const weekEnd = new Date(currentDate);
                weekEnd.setDate(weekEnd.getDate() + 6);
                label = `${currentDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`;
                cols.push({ date: colKey, label });
                currentDate.setDate(currentDate.getDate() + 7);
            } else { // monthly
                label = currentDate.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
                cols.push({ date: colKey, label });
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }
        
        const periodEndDate = new Date(currentDate);

        const arsCashAccount = cashAccounts.find(ca => ca.currency === Currency.ARS) || { initialBalance: 0, initialBalanceDate: '1970-01-01' };
        let balance = arsCashAccount.initialBalance;
        
        const addFlow = (rowKey: string, dateStr: string, amount: number) => {
            if (amount === 0 || !dateStr) return;
            const date = new Date(dateStr + 'T00:00:00Z');
            if (isNaN(date.getTime())) return;
            
            if (date.getTime() < startDate.getTime()) {
                balance += amount;
                return;
            }
            if (date.getTime() >= periodEndDate.getTime()) return;

            let colKey: string | undefined;
            if (viewMode === 'daily') colKey = dateStr;
            else if (viewMode === 'weekly') {
                const foundCol = cols.find(c => {
                    const colDate = new Date(c.date + 'T00:00:00Z');
                    const colEndDate = new Date(colDate);
                    colEndDate.setDate(colEndDate.getDate() + 7);
                    return date >= colDate && date < colEndDate;
                });
                colKey = foundCol?.date;
            } else { // monthly
                const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
                const foundCol = cols.find(c => c.date === monthKey);
                colKey = foundCol?.date;
            }
            if (!colKey) return;
            
            if (!flows[rowKey]) flows[rowKey] = {};
            flows[rowKey][colKey] = (flows[rowKey][colKey] || 0) + amount;
        };

        const grossTransfersByDate: Record<string, number> = {};
        companyGrainCollections.forEach(c => {
            if (c.status === 'collected' || c.status === 'unmatched') return;
            const collectionDate = c.actualCollectionDate || c.dueDate;
            if (!collectionDate) return;

            const isBankTransfer = banks.some(b => b.id === c.bankAccountId);
            if (isBankTransfer) {
                const netAmount = c.finalNetAmount ?? (c.grossAmount * (1 - (c.tentativeDeductionPercentage / 100)));
                const finalAmount = c.movementType === 'Débito' ? netAmount : -netAmount;
                grossTransfersByDate[collectionDate] = (grossTransfersByDate[collectionDate] || 0) + finalAmount;
            }
        });

        const adjustmentsByDate: Record<string, number> = {};
        companyCollectionAdjustments.forEach(adj => {
            adjustmentsByDate[adj.date] = (adjustmentsByDate[adj.date] || 0) + adj.amount;
        });

        const allFlowDates = new Set([...Object.keys(grossTransfersByDate), ...Object.keys(adjustmentsByDate)]);

        allFlowDates.forEach(date => {
            const grossAmount = grossTransfersByDate[date] || 0;
            const adjustmentAmount = adjustmentsByDate[date] || 0;
            const netAmount = grossAmount - adjustmentAmount;
            
            if(Math.abs(netAmount) > 0.01) {
                addFlow('COBRANZAS', date, netAmount);
            }
        });

        companyDebts.forEach(d => {
            if (d.status === 'cancelled') return;
            const financials = calculateFinancialsForDate(d, new Date(d.dueDate), appSettings);
            let netDisbursedInARS = financials.netDisbursed;
            let totalToRepayInARS = financials.totalToRepay;
            if (d.currency === Currency.USD) {
                netDisbursedInARS *= latestRate;
                totalToRepayInARS *= latestRate;
            }
            
            const debtType = debtTypes.find(dt => dt.name === d.type);
            if (!debtType) return;
            const rowKey = `debt-type-${debtType.id}`;
            addFlow(rowKey, d.originationDate, netDisbursedInARS);
            addFlow(rowKey, d.dueDate, -totalToRepayInARS);
        });

        companyInvestments.forEach(inv => {
            inv.transactions.forEach(tx => {
                if (tx.type === 'Compra' && tx.dueDate) {
                    let maturityValueNative: number;
                    if (tx.isFixedRate && tx.tea) {
                        const principalNative = tx.quantity * tx.price;
                        const termDays = daysBetween(tx.date, tx.dueDate);
                        const interestNative = principalNative * (tx.tea / 100 / appSettings.annualRateBasis) * termDays;
                        maturityValueNative = principalNative + interestNative;
                    } else {
                        maturityValueNative = tx.quantity;
                    }
                    const maturityValueInARS = inv.currency === Currency.USD ? maturityValueNative * latestRate : maturityValueNative;
                    addFlow('INVERSIONES', tx.dueDate, maturityValueInARS);
                }
            });
        });

        return { columns: cols, automatedFlows: flows, initialBalance: balance };
    }, [viewMode, startDate, companyDebts, companyInvestments, companyGrainCollections, banks, appSettings, cashAccounts, debtTypes, latestRate, companyCollectionAdjustments]);
    
    useEffect(() => {
        setEditableInitialBalance(initialBalance);
    }, [initialBalance]);
    
    const finalInitialBalance = typeof editableInitialBalance === 'number' ? editableInitialBalance : initialBalance;

    const handleAddRow = () => { if (newRowName.trim()) { setCustomRows([...customRows, { id: `custom-${crypto.randomUUID()}`, name: newRowName.trim() }]); setNewRowName(''); } };
    const handleRemoveRow = (id: string) => { setCustomRows(customRows.filter(r => r.id !== id)); const newManualFlows = { ...manualFlows }; delete newManualFlows[id]; setManualFlows(newManualFlows); };
    const handleCellBlur = useCallback(() => { if (editingCell) { const { rowKey } = editingCell; const value = parseFormattedNumber(String(editValue)); if(rowKey === 'SALDO_INICIO') { setEditableInitialBalance(value); } else { const { date } = editingCell; setManualFlows(prev => { const newFlows = { ...prev }; if (!newFlows[rowKey]) newFlows[rowKey] = {}; newFlows[rowKey][date] = Number(value) || 0; return newFlows; }); } setEditingCell(null); setEditValue(''); } }, [editingCell, editValue]);
    const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleCellBlur(); } else if (e.key === 'Escape') { setEditingCell(null); setEditValue(''); } };
    
    const handleCellDoubleClick = (rowKey: string, rowLabel: string, col: { date: string, label: string }) => {
        const isAutomaticRow = rowKey.startsWith('debt-type-') || rowKey === 'COBRANZAS' || rowKey === 'INVERSIONES';
    
        if (isAutomaticRow) {
            const detailItems: { description: string; amount: number; currency: string; date: string }[] = [];
            const colDate = new Date(col.date + 'T00:00:00Z');
            let periodStart: Date, periodEnd: Date;
    
            if (viewMode === 'daily') {
                periodStart = colDate;
                periodEnd = colDate;
            } else if (viewMode === 'weekly') {
                periodStart = colDate;
                periodEnd = new Date(colDate);
                periodEnd.setUTCDate(periodEnd.getUTCDate() + 6);
            } else { // monthly
                periodStart = new Date(Date.UTC(colDate.getUTCFullYear(), colDate.getUTCMonth(), 1));
                periodEnd = new Date(Date.UTC(colDate.getUTCFullYear(), colDate.getUTCMonth() + 1, 0));
            }
    
            const dateIsInRange = (dateStr: string) => {
                if (!dateStr) return false;
                const itemDate = new Date(dateStr + 'T00:00:00Z');
                return itemDate >= periodStart && itemDate <= periodEnd;
            };
            
            if (rowKey.startsWith('debt-type-')) {
                const debtTypeId = rowKey.replace('debt-type-', '');
                const debtType = debtTypes.find(dt => dt.id === debtTypeId);
                if(debtType) {
                    companyDebts.forEach(d => {
                        if (d.type === debtType.name) {
                            const financials = calculateFinancialsForDate(d, new Date(d.dueDate), appSettings);
                            if (dateIsInRange(d.originationDate)) {
                                const amount = d.currency === Currency.USD ? financials.netDisbursed * latestRate : financials.netDisbursed;
                                detailItems.push({ description: `Desembolso ${d.type}`, amount, currency: 'ARS', date: d.originationDate });
                            }
                            if (dateIsInRange(d.dueDate)) {
                                const amount = d.currency === Currency.USD ? financials.totalToRepay * latestRate : financials.totalToRepay;
                                detailItems.push({ description: `Cancelación ${d.type}`, amount: -amount, currency: 'ARS', date: d.dueDate });
                            }
                        }
                    });
                }
            } else if (rowKey === 'INVERSIONES') {
                companyInvestments.forEach(inv => {
                    inv.transactions.forEach(tx => {
                        if (tx.type === 'Compra' && tx.dueDate && dateIsInRange(tx.dueDate)) {
                             let maturityValueNative: number;
                             if (tx.isFixedRate && tx.tea) {
                                 const principalNative = tx.quantity * tx.price;
                                 const termDays = daysBetween(tx.date, tx.dueDate);
                                 const interestNative = principalNative * (tx.tea / 100 / appSettings.annualRateBasis) * termDays;
                                 maturityValueNative = principalNative + interestNative;
                             } else {
                                 maturityValueNative = tx.quantity;
                             }
                             const amount = inv.currency === Currency.USD ? maturityValueNative * latestRate : maturityValueNative;
                             detailItems.push({ description: `Vencimiento ${inv.instrumentName}`, amount, currency: 'ARS', date: tx.dueDate! });
                        }
                    });
                });
            } else if (rowKey === 'COBRANZAS') {
                companyGrainCollections.forEach(c => {
                    const collectionDate = c.actualCollectionDate || c.dueDate;
                    if (c.status !== 'collected' && c.status !== 'unmatched' && collectionDate && dateIsInRange(collectionDate)) {
                        const isBankTransfer = banks.some(b => b.id === c.bankAccountId);
                        if(isBankTransfer) {
                            const netAmount = c.finalNetAmount ?? (c.grossAmount * (1 - (c.tentativeDeductionPercentage / 100)));
                            const finalAmount = c.movementType === 'Débito' ? netAmount : -netAmount;
                            detailItems.push({ description: `Cobranza ${c.buyerName} #${c.operationCode}`, amount: finalAmount, currency: 'ARS', date: collectionDate });
                        }
                    }
                });
    
                companyCollectionAdjustments.forEach(adj => {
                    if(dateIsInRange(adj.date)) {
                        detailItems.push({ description: `Ajuste (${adj.type}) ${adj.buyerName}`, amount: -adj.amount, currency: 'ARS', date: adj.date });
                    }
                });
            }
    
            setDetailModalData({
                isOpen: true,
                title: `Detalle de "${rowLabel}" para ${col.label}`,
                items: detailItems,
            });
    
        } else { // Is a manual/custom row, allow editing
            setEditValue(manualFlows[rowKey]?.[col.date] || '');
            setEditingCell({ rowKey, date: col.date });
        }
    };

    const isNonWorkingDay = (dateStr: string) => { const d = new Date(dateStr + 'T00:00:00Z'); const dayOfWeek = d.getUTCDay(); return dayOfWeek === 0 || dayOfWeek === 6 || holidays.includes(dateStr); };

    const { initialBalances, finalBalances } = useMemo(() => {
        const initialBalances: Record<string, number> = {};
        const finalBalances: Record<string, number> = {};
        let runningBalance = finalInitialBalance;
        columns.forEach(col => {
            initialBalances[col.date] = runningBalance;
            let netFlow = 0;
            allRows.forEach(row => { if(row.type === 'balance') return; const auto = automatedFlows[row.key]?.[col.date] || 0; const manual = manualFlows[row.key]?.[col.date] || 0; netFlow += auto + manual; });
            runningBalance += netFlow;
            finalBalances[col.date] = runningBalance;
        });
        return { initialBalances, finalBalances };
    }, [finalInitialBalance, columns, allRows, automatedFlows, manualFlows]);

    const exportData = useMemo(() => {
        const data = allRows.map(row => {
            const rowData: { [key: string]: string | number } = { 'Concepto': row.label };
            columns.forEach(col => {
                if (row.key === 'SALDO_INICIO') {
                    rowData[col.label] = initialBalances[col.date] || 0;
                } else {
                    const totalValue = (automatedFlows[row.key]?.[col.date] || 0) + (manualFlows[row.key]?.[col.date] || 0);
                    rowData[col.label] = totalValue;
                }
            });
            return rowData;
        });

        const finalBalanceRow: { [key: string]: string | number } = { 'Concepto': 'SALDO FINAL' };
        columns.forEach(col => {
            finalBalanceRow[col.label] = finalBalances[col.date] || 0;
        });
        data.push(finalBalanceRow);

        return data;
    }, [allRows, columns, initialBalances, finalBalances, automatedFlows, manualFlows]);

    const exportColumns: ExportColumn<any>[] = useMemo(() => [
        { header: 'Concepto', accessor: (row: any) => row['Concepto'] },
        ...columns.map(col => ({
            header: col.label,
            accessor: (row: any) => row[col.label] || 0
        }))
    ], [columns]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl m-4 h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Flujo de Caja Extendido</h2>
                    <div className="flex items-center gap-4">
                        <ExportButtons
                            data={exportData}
                            columns={exportColumns}
                            fileName="flujo_de_caja_extendido"
                            pdfTitle="Flujo de Caja Extendido"
                        />
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
                    </div>
                </div>

                <div className="p-6 flex-grow overflow-y-auto">
                    <div className="flex items-center gap-4 mb-4">
                         <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg text-sm">
                            <button onClick={() => setViewMode('daily')} className={`px-3 py-1 rounded-md ${viewMode==='daily'?'bg-white dark:bg-primary text-primary dark:text-white font-semibold':'text-gray-700 dark:text-gray-200'}`}>Diario</button>
                            <button onClick={() => setViewMode('weekly')} className={`px-3 py-1 rounded-md ${viewMode==='weekly'?'bg-white dark:bg-primary text-primary dark:text-white font-semibold':'text-gray-700 dark:text-gray-200'}`}>Semanal</button>
                            <button onClick={() => setViewMode('monthly')} className={`px-3 py-1 rounded-md ${viewMode==='monthly'?'bg-white dark:bg-primary text-primary dark:text-white font-semibold':'text-gray-700 dark:text-gray-200'}`}>Mensual</button>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Fecha de Inicio:</label>
                            <input type="date" value={startDate.toISOString().split('T')[0]} onChange={e => setStartDate(new Date(e.target.value + 'T00:00:00Z'))} className="ml-2 p-2 border rounded-md dark:bg-gray-700"/>
                        </div>
                    </div>

                    <div className="overflow-auto">
                        <table className="min-w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-100 dark:bg-gray-900">
                                    <th className="sticky left-0 bg-gray-100 dark:bg-gray-900 z-20 p-2 border-b dark:border-gray-700 min-w-[200px] text-left">Concepto</th>
                                    {columns.map(col => <th key={col.date} className={`p-2 border-b dark:border-gray-700 min-w-[120px] text-center ${isNonWorkingDay(col.date) && viewMode === 'daily' ? 'bg-gray-200 dark:bg-gray-700/60' : ''}`}>{col.label}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {allRows.map(row => {
                                    const rowBg = row.style?.includes('bg-') ? '' : 'bg-white dark:bg-gray-800';
                                    if (row.key === 'SALDO_INICIO') {
                                        const isEditingFirstCell = editingCell?.rowKey === 'SALDO_INICIO';
                                        return (
                                            <tr key={row.key} className={`${row.style} border-b dark:border-gray-700/50`}>
                                                <td className={`sticky left-0 z-10 p-2 font-medium flex items-center justify-between ${row.style}`}>{row.label}</td>
                                                {columns.map((col, index) => {
                                                    const isEditingThisCell = isEditingFirstCell && index === 0;
                                                    const balanceValue = initialBalances[col.date];
                                                    return (<td key={col.date} className={`p-0 text-right border-l dark:border-gray-700/50 ${isNonWorkingDay(col.date) && viewMode === 'daily' ? 'bg-gray-100 dark:bg-gray-700/40' : ''}`}>
                                                        {isEditingThisCell ? (<FormattedNumberInput value={editValue} onChange={setEditValue} onBlur={handleCellBlur} onKeyDown={handleCellKeyDown} autoFocus className="w-full text-right"/>) : (
                                                            <div className={`h-full w-full p-1 ${index === 0 ? 'cursor-pointer' : 'cursor-default'}`} onDoubleClick={() => { if (index === 0) { setEditValue(editableInitialBalance); setEditingCell({ rowKey: 'SALDO_INICIO', date: 'balance' }); }}}>
                                                                {balanceValue.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                            </div>
                                                        )}
                                                    </td>)
                                                })}
                                            </tr>
                                        );
                                    }
                                    return (
                                    <tr key={row.key} className={`${row.style || ''} ${rowBg} border-b dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/50`}>
                                        <td className={`sticky left-0 z-10 p-2 font-medium flex items-center justify-between ${row.style || ''} ${rowBg}`}>
                                            {row.label}
                                            {row.section === 'custom' && <button onClick={() => handleRemoveRow(row.key)} className="text-red-500 opacity-50 hover:opacity-100"><TrashIcon /></button>}
                                        </td>
                                        {columns.map(col => {
                                            const isEditing = editingCell?.rowKey === row.key && editingCell?.date === col.date;
                                            return (
                                                <td key={col.date} className={`p-0 text-right border-l dark:border-gray-700/50 ${isNonWorkingDay(col.date) && viewMode === 'daily' ? 'bg-gray-100 dark:bg-gray-700/40' : ''}`}>
                                                    {isEditing ? (<FormattedNumberInput value={editValue} onChange={setEditValue} onBlur={handleCellBlur} onKeyDown={handleCellKeyDown} autoFocus className="w-full text-right"/>) : (
                                                        <div className="h-full w-full p-1 cursor-pointer" onDoubleClick={() => handleCellDoubleClick(row.key, row.label, col)}>
                                                            {(() => { const totalValue = (automatedFlows[row.key]?.[col.date] || 0) + (manualFlows[row.key]?.[col.date] || 0); return totalValue !== 0 ? totalValue.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : <span className="text-gray-400">-</span> })()}
                                                        </div>
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )})}
                                <tr className="border-t-2 border-dashed dark:border-gray-600"></tr>
                                <tr className="bg-gray-200 dark:bg-gray-900 font-bold text-base">
                                    <td className="sticky left-0 bg-gray-200 dark:bg-gray-900 z-10 p-2">SALDO FINAL</td>
                                    {columns.map(col => <td key={col.date} className={`p-2 text-right border-l dark:border-gray-700 ${finalBalances[col.date] < 0 ? 'text-red-500' : ''} ${isNonWorkingDay(col.date) && viewMode === 'daily' ? 'bg-gray-300 dark:bg-gray-700/80' : ''}`}>{finalBalances[col.date].toLocaleString('es-AR')}</td>)}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                     <div className="mt-4 p-4 border-t dark:border-gray-700 flex items-center gap-4">
                        <input type="text" value={newRowName} onChange={(e) => setNewRowName(e.target.value)} placeholder="Nombre de la nueva fila..." className="border rounded-md p-2 dark:bg-gray-700"/>
                        <button onClick={handleAddRow} className="flex items-center gap-2 bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg"><PlusCircleIcon/> Agregar Fila</button>
                    </div>
                </div>

                <div className="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cerrar</button>
                </div>
                {detailModalData?.isOpen && (
                    <CashFlowCellDetailModal
                        isOpen={detailModalData.isOpen}
                        onClose={() => setDetailModalData(null)}
                        title={detailModalData.title}
                        items={detailModalData.items}
                    />
                )}
            </div>
        </div>
    );
};

export default ExpandedCashFlowModal;