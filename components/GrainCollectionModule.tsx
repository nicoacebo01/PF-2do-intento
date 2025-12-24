import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppContext } from '../App';
import type { GrainCollection, Bank, CollectionAdjustment } from '../types';
import * as api from '../services/api';
import { useFinancialCalculations } from '../utils/calculations';
import { PlusCircleIcon, PencilIcon, TrashIcon, CheckBadgeIcon } from './Icons';
import FormattedNumberInput from './FormattedNumberInput';
import CollectedCollectionsModal from './CollectedCollectionsModal';
import { XIcon } from './Icons';
import CollectionAdjustmentModal from './CollectionAdjustmentModal';
import { getTodayArgentinaDate } from '../utils/financials';
import ExpandedFlowModal from './ExpandedFlowModal';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import HelpTooltip from './HelpTooltip';


// Assume XLSX is available globally
declare const XLSX: any;

const EditCollectionModal: React.FC<{
    collection: GrainCollection;
    onClose: () => void;
    onSave: (updatedCollection: GrainCollection) => void;
}> = ({ collection, onClose, onSave }) => {
    const [deduction, setDeduction] = useState<number | ''>(collection.tentativeDeductionPercentage);
    const [netAmount, setNetAmount] = useState<number | ''>(collection.finalNetAmount ?? '');

    const handleSave = () => {
        onSave({
            ...collection,
            tentativeDeductionPercentage: Number(deduction),
            finalNetAmount: netAmount === '' ? undefined : Number(netAmount)
        });
        onClose();
    };

    const calculatedNetAmount = useMemo(() => {
        if (netAmount !== '') {
            return Number(netAmount);
        }
        return collection.grossAmount * (1 - (Number(deduction || 0) / 100));
    }, [deduction, netAmount, collection.grossAmount]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md m-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Ajustar Neto a Cobrar</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
                </div>
                <div className="space-y-4">
                    <p>Operación: <span className="font-semibold">{collection.operationCode}</span></p>
                    <p>Comprador: <span className="font-semibold">{collection.buyerName}</span></p>
                    <p>Fecha de Emisión: <span className="font-semibold">{collection.issueDate ? new Date(collection.issueDate + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'}) : 'N/A'}</span></p>
                    <p>Monto Bruto: <span className="font-semibold">{collection.grossAmount.toLocaleString('es-AR', {style:'currency', currency:'ARS'})}</span></p>
                    <div>
                        <label className="block text-sm font-medium">Deducción Tentativa (%)</label>
                        <FormattedNumberInput 
                            value={deduction}
                            onChange={setDeduction}
                            className="mt-1"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Neto Final (si difiere del cálculo)</label>
                        <FormattedNumberInput 
                            value={netAmount}
                            onChange={setNetAmount}
                            placeholder="Opcional"
                            className="mt-1"
                        />
                    </div>
                    <div className="border-t pt-4">
                        <p className="font-semibold">Neto a Cobrar Proyectado: <span className="text-primary">{calculatedNetAmount.toLocaleString('es-AR', {style:'currency', currency:'ARS'})}</span></p>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 mt-4">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button onClick={handleSave} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">Guardar</button>
                </div>
            </div>
        </div>
    );
};

const getRowValue = (row: { [key: string]: any }, keys: string[]): any => {
    for (const key of keys) {
        if (row[key.toLowerCase().trim()] !== undefined) return row[key.toLowerCase().trim()];
    }
    return undefined;
};


const GrainCollectionModule: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, viewMode } = state;
    const { companyGrainCollections, banks, companyCollectionAdjustments, selectedCompanyId, holidays } = useFinancialCalculations();

    const [isCollectedModalOpen, setIsCollectedModalOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<GrainCollection | null>(null);
    const [adjustmentModalData, setAdjustmentModalData] = useState<{ date: string; buyerName: string; totalAmount: number; bankBreakdown: { [bankId: string]: { name: string; amount: number } }; collections: GrainCollection[] } | null>(null);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
    const [isExpandedFlowModalOpen, setIsExpandedFlowModalOpen] = useState(false);
    const [highlightedCell, setHighlightedCell] = useState<{ date: string; buyer: string } | null>(null);
    const arcaFileRef = React.useRef<HTMLInputElement>(null);
    const gestionFileRef = React.useRef<HTMLInputElement>(null);
    const [filters, setFilters] = useState({
        dateType: 'dueDate',
        startDate: '',
        endDate: '',
        buyer: 'all',
    });

    const canEdit = useMemo(() => (currentUser?.permissions.grainCollection === 'admin' || currentUser?.permissions.grainCollection === 'operator'), [currentUser]);
    const today = useMemo(() => getTodayArgentinaDate(), []);
    
    const kpiData = useMemo(() => {
        const next7Days = new Date(today);
        next7Days.setUTCDate(today.getUTCDate() + 7);
        let toCollect7Days = 0, overdue = 0, collectedThisMonth = 0, totalToCollect = 0;
        companyGrainCollections.forEach(c => {
            const collectionDate = c.actualCollectionDate || c.dueDate;
            if (!collectionDate) return;
            const collectionDateObj = new Date(collectionDate + 'T00:00:00Z');
            const netAmount = c.finalNetAmount ?? (c.grossAmount * (1 - (c.tentativeDeductionPercentage / 100)));
            const finalAmount = c.movementType === 'Débito' ? netAmount : -netAmount;
            if (c.status === 'collected') {
                if (collectionDateObj.getUTCMonth() === today.getUTCMonth() && collectionDateObj.getUTCFullYear() === today.getUTCFullYear()) collectedThisMonth += finalAmount;
            } else {
                 if (collectionDateObj >= today) totalToCollect += finalAmount;
                if (collectionDateObj < today) overdue += finalAmount;
                if (collectionDateObj >= today && collectionDateObj <= next7Days) toCollect7Days += finalAmount;
            }
        });
        const unmatchedCount = companyGrainCollections.filter(c => c.status === 'unmatched').length;
        return { toCollect7Days, overdue, collectedThisMonth, unmatchedCount, totalToCollect };
    }, [companyGrainCollections, today]);

    const handleSaveAdjustmentsFromModal = async (date: string, buyerName: string, newAdjustments: { [key in CollectionAdjustment['type']]?: number }, bankId: string, collectionIds: string[]) => {
        if (!selectedCompanyId) return;
        let currentAdjustments = [...state.collectionAdjustments];
        currentAdjustments = currentAdjustments.filter(adj => !(adj.date === date && adj.buyerName === buyerName));
        for (const type in newAdjustments) {
            const amount = newAdjustments[type as CollectionAdjustment['type']];
            if (amount) {
                currentAdjustments.push({ id: crypto.randomUUID(), companyId: selectedCompanyId, date, buyerName, amount, type: type as CollectionAdjustment['type'] });
            }
        }
        try {
            const updatedAdjs = await api.setCollectionAdjustments(currentAdjustments);
            dispatch({ type: 'SET_COLLECTION_ADJUSTMENTS_SUCCESS', payload: updatedAdjs });

            if (bankId && collectionIds.length > 0) {
                const updatedColls = await api.bulkUpdateGrainCollectionsBank(collectionIds, bankId);
                dispatch({ type: 'BULK_UPDATE_GRAIN_COLLECTIONS_BANK_SUCCESS', payload: updatedColls });
            }
        } catch (e) {
            alert('Error al guardar ajustes.');
        }
        setAdjustmentModalData(null);
    };

    const activeCollections = useMemo(() => companyGrainCollections.filter(c => c.status !== 'collected'), [companyGrainCollections]);
    const collectedCollections = useMemo(() => companyGrainCollections.filter(c => c.status === 'collected'), [companyGrainCollections]);
    const uniqueBuyers = useMemo(() => [...new Set(activeCollections.map(c => c.buyerName))].sort(), [activeCollections]);
    
    useEffect(() => { if (filters.buyer !== 'all' && !uniqueBuyers.includes(filters.buyer)) setFilters(f => ({ ...f, buyer: 'all' })); }, [uniqueBuyers, filters.buyer]);
    
    const detailTableCollections = useMemo(() => activeCollections.filter(c => {
        if (filters.buyer !== 'all' && c.buyerName !== filters.buyer) return false;
        const dateField = filters.dateType as keyof GrainCollection;
        const dateStr = c[dateField] as string | undefined;
        if (!filters.startDate && !filters.endDate) return true;
        if (!dateStr) return false; 
        const itemDate = new Date(dateStr + 'T00:00:00Z');
        if (filters.startDate && itemDate < new Date(filters.startDate + 'T00:00:00Z')) return false;
        if (filters.endDate && itemDate > new Date(filters.endDate + 'T00:00:00Z')) return false;
        return true;
    }), [activeCollections, filters]);

    const { dates: next7Days, buyers: buyersInFlow, flowData } = useMemo(() => {
        const flow: { [date: string]: { [buyer: string]: number } } = {};
        const datesArray: Date[] = [];
        for (let i = 0; i < 7; i++) { const d = new Date(today.getTime()); d.setUTCDate(today.getUTCDate() + i); datesArray.push(d); }
        const dates = datesArray.map(d => d.toISOString().split('T')[0]);
        const buyers = new Set<string>();
        detailTableCollections.forEach(c => {
            if (c.status === 'matched') {
                const collectionDate = c.actualCollectionDate || c.dueDate;
                if (!collectionDate || !dates.includes(collectionDate)) return;
                const netAmount = c.finalNetAmount ?? (c.grossAmount * (1 - (c.tentativeDeductionPercentage / 100)));
                const finalAmount = c.movementType === 'Débito' ? netAmount : -netAmount;
                buyers.add(c.buyerName);
                if (!flow[collectionDate]) flow[collectionDate] = {};
                flow[collectionDate][c.buyerName] = (flow[collectionDate][c.buyerName] || 0) + finalAmount;
            }
        });
        return { dates, buyers: Array.from(buyers).sort(), flowData: flow };
    }, [detailTableCollections, today]);
    
    const flowTotals = useMemo(() => {
        const dateTotals: { [date: string]: number } = {}; const buyerTotals: { [buyer: string]: number } = {}; let grandTotal = 0;
        buyersInFlow.forEach(buyer => { buyerTotals[buyer] = 0; next7Days.forEach(date => { const value = flowData[date]?.[buyer] || 0; dateTotals[date] = (dateTotals[date] || 0) + value; buyerTotals[buyer] += value; grandTotal += value; }); });
        return { dateTotals, buyerTotals, grandTotal };
    }, [flowData, next7Days, buyersInFlow]);

    const flowExportData = useMemo(() => {
        const data = buyersInFlow.map(buyer => {
            const row: any = { 'Comprador': buyer }; let buyerTotal = 0;
            next7Days.forEach(date => {
                const totalAmount = flowData[date]?.[buyer] || 0;
                const adjustmentsForCell = companyCollectionAdjustments.filter(adj => adj.date === date && adj.buyerName === buyer).reduce((sum, adj) => sum + adj.amount, 0);
                const displayAmount = totalAmount - adjustmentsForCell;
                row[date] = displayAmount; buyerTotal += displayAmount; 
            });
            row['Total'] = buyerTotal; return row;
        });
        const totalRow: any = { 'Comprador': 'Total por Día' }; let grandTotalForExport = 0;
        next7Days.forEach(date => {
            const dailyTotal = flowTotals.dateTotals[date] || 0;
            const totalAdjustments = companyCollectionAdjustments.filter(adj => adj.date === date && (adj.buyerName === '__DAILY_TOTAL__' || buyersInFlow.includes(adj.buyerName))).reduce((sum, adj) => sum + adj.amount, 0);
            const displayTotal = dailyTotal - totalAdjustments;
            totalRow[date] = displayTotal; grandTotalForExport += displayTotal;
        });
        totalRow['Total'] = grandTotalForExport; data.push(totalRow);
        return data;
    }, [buyersInFlow, next7Days, flowData, flowTotals, companyCollectionAdjustments]);

    const flowExportColumns: ExportColumn<any>[] = useMemo(() => [
        { header: 'Comprador', accessor: (row: any) => row['Comprador'] },
        ...next7Days.map(date => ({ header: new Date(date + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC', day: '2-digit', month: '2-digit'}), accessor: (row: any) => row[date] || 0 })),
        { header: 'Total', accessor: (row: any) => row['Total'] || 0 }
    ], [next7Days]);
    
    const dailySubtotals = useMemo(() => {
        const dailyAdjustments: { [date: string]: { [type in CollectionAdjustment['type']]: number } } = {};
        const grossDailyBankFlows: { [date: string]: { [bankId: string]: number } } = {}; const banksWithFlowsSet = new Set<string>();
        next7Days.forEach(date => { dailyAdjustments[date] = { 'Cheque': 0, 'Compensa': 0, 'Pase a Alyc': 0, 'Ajuste': 0 }; grossDailyBankFlows[date] = {}; banks.forEach(bank => { grossDailyBankFlows[date][bank.id] = 0; }); });
        detailTableCollections.forEach(c => {
            if (c.status === 'matched') {
                const collectionDate = c.actualCollectionDate || c.dueDate; const bankId = c.bankAccountId; const isBank = banks.some(b => b.id === bankId);
                if (collectionDate && next7Days.includes(collectionDate) && bankId && isBank) {
                    const netAmount = c.finalNetAmount ?? (c.grossAmount * (1 - (c.tentativeDeductionPercentage / 100)));
                    const finalAmount = c.movementType === 'Débito' ? netAmount : -netAmount;
                    grossDailyBankFlows[collectionDate][bankId] = (grossDailyBankFlows[collectionDate][bankId] || 0) + finalAmount;
                    if (Math.abs(finalAmount) > 0.01) banksWithFlowsSet.add(bankId);
                }
            }
        });
        companyCollectionAdjustments.forEach(adj => { if (dailyAdjustments[adj.date]) { const isDailyTotalAdjustment = adj.buyerName === '__DAILY_TOTAL__'; if ((buyersInFlow.includes(adj.buyerName)) || (isDailyTotalAdjustment && filters.buyer === 'all')) { dailyAdjustments[adj.date][adj.type] = (dailyAdjustments[adj.date][adj.type] || 0) + adj.amount; } } });
        const adjustedDailyBankFlows: { [date: string]: { [bankId: string]: number } } = {}; const adjustedDailyTotalBankFlows: { [date: string]: number } = {};
        next7Days.forEach(date => {
            const totalGrossBankFlow = Object.values(grossDailyBankFlows[date] || {}).reduce((s, a) => s + a, 0);
            const totalAdjustments = Object.values(dailyAdjustments[date] || {}).reduce((s, a) => s + a, 0);
            adjustedDailyTotalBankFlows[date] = totalGrossBankFlow - totalAdjustments;
            adjustedDailyBankFlows[date] = {};
            if (totalGrossBankFlow !== 0) { const ratio = adjustedDailyTotalBankFlows[date] / totalGrossBankFlow; banks.forEach(bank => { adjustedDailyBankFlows[date][bank.id] = (grossDailyBankFlows[date][bank.id] || 0) * ratio; if (Math.abs(adjustedDailyBankFlows[date][bank.id]) > 0.01) banksWithFlowsSet.add(bank.id); }); } else { banks.forEach(bank => { adjustedDailyBankFlows[date][bank.id] = 0; }); }
        });
        const banksWithFlows = banks.filter(b => banksWithFlowsSet.has(b.id));
        return { dailyAdjustments, dailyBankFlows: adjustedDailyBankFlows, banksWithFlows, dailyTotalBankFlows: adjustedDailyTotalBankFlows };
    }, [next7Days, buyersInFlow, filters.buyer, companyCollectionAdjustments, detailTableCollections, banks]);


    const getBankName = (bankAccountId?: string) => { if (!bankAccountId) return ''; const bank = banks.find(b => b.id === bankAccountId); if (bank) return bank.name; return bankAccountId.charAt(0).toUpperCase() + bankAccountId.slice(1); };

    const handleCellClick = (date: string, buyer: string) => {
        if (highlightedCell && highlightedCell.date === date && highlightedCell.buyer === buyer) { setHighlightedCell(null); setAdjustmentModalData(null); } else {
            const totalAmount = buyer === '__DAILY_TOTAL__' ? flowTotals.dateTotals[date] || 0 : flowData[date]?.[buyer] || 0;
            if (totalAmount !== 0) {
                const bankBreakdown: { [bankId: string]: { name: string; amount: number } } = {};
                const collectionsForCell = detailTableCollections.filter(c => { const collectionDate = c.actualCollectionDate || c.dueDate; return (c.status === 'matched' && collectionDate === date && (buyer === '__DAILY_TOTAL__' || c.buyerName === buyer)); });
                collectionsForCell.forEach(c => {
                    const bankId = c.bankAccountId; const isBank = banks.some(b => b.id === bankId);
                    if (bankId && isBank) {
                        const netAmount = c.finalNetAmount ?? (c.grossAmount * (1 - (c.tentativeDeductionPercentage / 100))); const finalAmount = c.movementType === 'Débito' ? netAmount : -netAmount;
                        if (!bankBreakdown[bankId]) { bankBreakdown[bankId] = { name: getBankName(bankId), amount: 0 }; }
                        bankBreakdown[bankId].amount += finalAmount;
                    }
                });
                setHighlightedCell({ date, buyer });
                setAdjustmentModalData({ date, buyerName: buyer, totalAmount, bankBreakdown, collections: collectionsForCell });
            } else { setHighlightedCell(null); setAdjustmentModalData(null); }
        }
    };

    const parseDate = (date: any): string => {
        if (!date) return '';
        if (typeof date === 'number') { const jsDate = new Date(Math.round((date - 25569) * 86400 * 1000)); if (!isNaN(jsDate.getTime())) return jsDate.toISOString().split('T')[0]; }
        if (date instanceof Date) { const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); return utcDate.toISOString().split('T')[0]; }
        if (typeof date === 'string') { const d = new Date(date); if (!isNaN(d.getTime())) { const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); return utcDate.toISOString().split('T')[0]; } }
        return '';
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>, importType: 'arca' | 'gestion') => {
        const file = e.target.files?.[0];
        if (!file || !selectedCompanyId) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {raw: false});
                const collections: GrainCollection[] = jsonData.map((row): GrainCollection | null => {
                    const lowerCaseRow: { [key: string]: any } = {};
                    for (const key in row) lowerCaseRow[key.toLowerCase().trim()] = row[key];
                    if (importType === 'arca') {
                        const operationCode = getRowValue(lowerCaseRow, ['codigo de operación', 'codigo de operacion'])?.toString().trim();
                        if (!operationCode) return null;
                        return { id: crypto.randomUUID(), companyId: selectedCompanyId, operationCode, buyerName: getRowValue(lowerCaseRow, ['denominación', 'denominacion']) || 'N/D', cuit: getRowValue(lowerCaseRow, ['cuit emisor']) || 'N/D', issueDate: parseDate(getRowValue(lowerCaseRow, ['fecha'])), dueDate: '', grossAmount: 0, movementType: 'Débito', tentativeDeductionPercentage: 1, status: 'unmatched' };
                    } else {
                        const operationCode = getRowValue(lowerCaseRow, ['comprobante', 'nro operacion', 'nro operación'])?.toString().trim();
                        if (!operationCode) return null;
                        return { id: crypto.randomUUID(), companyId: selectedCompanyId, operationCode, buyerName: getRowValue(lowerCaseRow, ['nombre del productor']) || 'N/D', cuit: 'N/D', issueDate: parseDate(getRowValue(lowerCaseRow, ['fecha cta.', 'fecha cta'])), dueDate: parseDate(getRowValue(lowerCaseRow, ['fecha vencimiento', 'f. vencimiento'])), grossAmount: parseFloat(String(getRowValue(lowerCaseRow, ['importe comprobante', 'monto bruto']) || '0').replace(',','.')) || 0, movementType: String(getRowValue(lowerCaseRow, ['tipo de movimiento']) || '').trim() === 'Crédito' ? 'Crédito' : 'Débito', tentativeDeductionPercentage: 10, status: 'matched' };
                    }
                }).filter((c): c is GrainCollection => c !== null);
                const updatedCollections = await api.importGrainCollections(collections, importType, selectedCompanyId, banks);
                dispatch({ type: 'IMPORT_GRAIN_COLLECTIONS_SUCCESS', payload: updatedCollections });
                alert('Importación completada.');
            } catch (error) { console.error("Error importing file:", error); alert("Error al importar el archivo. Verifique el formato."); }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const handleDownloadTemplate = (type: 'arca' | 'gestion') => {
        let headers: string[][], fileName: string;
        if (type === 'arca') { headers = [["Fecha", "Codigo de operación", "Cuit emisor", "Denominación"]]; fileName = "plantilla_arca.xlsx"; } else { headers = [["Vendedor", "Nombre del Productor", "Comprobante", "Fecha Cta.", "Fecha Vencimiento", "Concepto", "Importe Comprobante", "Tipo de Movimiento"]]; fileName = "plantilla_gestion.xlsx"; }
        const ws = XLSX.utils.aoa_to_sheet(headers); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datos"); XLSX.writeFile(wb, fileName);
    };

    const handleUpdateCollection = async (collection: GrainCollection) => {
        try {
            const updatedCollections = await api.updateGrainCollection(collection);
            dispatch({ type: 'UPDATE_GRAIN_COLLECTION_SUCCESS', payload: updatedCollections });
        } catch (error) {
            alert('Error al actualizar la cobranza.');
        }
    };
    
    const exportData = useMemo(() => detailTableCollections.map(c => { const projectedNet = c.finalNetAmount ?? (c.grossAmount * (1 - c.tentativeDeductionPercentage / 100)); return { ...c, projectedNet, bankAccountName: getBankName(c.bankAccountId) }; }), [detailTableCollections, banks]);
    const exportColumns: ExportColumn<typeof exportData[0]>[] = [
        { header: 'Comprador', accessor: d => d.buyerName }, { header: 'N° Op.', accessor: d => d.operationCode }, { header: 'CUIT', accessor: d => d.cuit },
        { header: 'Fecha Emisión', accessor: d => d.issueDate ? new Date(d.issueDate).toLocaleDateString('es-AR', {timeZone:'UTC'}) : '-' },
        { header: 'Fecha Vto. Proy.', accessor: d => d.dueDate ? new Date(d.dueDate).toLocaleDateString('es-AR', {timeZone:'UTC'}) : '-' },
        { header: 'Fecha Cobro Real', accessor: d => d.actualCollectionDate ? new Date(d.actualCollectionDate).toLocaleDateString('es-AR', {timeZone:'UTC'}) : '-' },
        { header: 'Monto Bruto', accessor: d => d.grossAmount.toLocaleString('es-AR') }, { header: 'Neto Proyectado', accessor: d => d.projectedNet.toLocaleString('es-AR') },
        { header: 'Cuenta Acreditación', accessor: d => d.bankAccountName }, { header: 'Estado', accessor: d => d.status },
    ];
    
    const formatCurrency = (amount: number) => amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
    const KpiCard: React.FC<{title: string, value: string, colorClass: string, helpText?: string}> = ({ title, value, colorClass, helpText }) => (<div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md text-center"><h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">{title}{helpText && <HelpTooltip text={helpText} />}</h4><p className={`text-2xl font-bold ${colorClass}`}>{value}</p></div>);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Módulo de Cobranzas</h1></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4"><KpiCard title="A Cobrar (7 días)" value={formatCurrency(kpiData.toCollect7Days)} colorClass="text-primary dark:text-accent-dm" /><KpiCard title="Total Pendiente" value={formatCurrency(kpiData.totalToCollect)} colorClass="text-blue-500" /><KpiCard title="Total Vencido" value={formatCurrency(kpiData.overdue)} colorClass="text-red-500" /><KpiCard title="Cobrado (Mes Actual)" value={formatCurrency(kpiData.collectedThisMonth)} colorClass="text-green-600" /><KpiCard title="Op. sin 'Matchear'" value={kpiData.unmatchedCount.toString()} colorClass="text-yellow-500" helpText="Son operaciones importadas desde el archivo de ARCA que aún no han sido encontradas en el archivo de GESTIÓN. Estas operaciones no tienen fecha de vencimiento ni monto asignado, por lo que no pueden ser incluidas en el flujo de caja hasta que se 'matcheen' con su correspondiente dato de gestión." /></div>
            {canEdit && viewMode === 'individual' && (<div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md"><h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">Acciones y Herramientas</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600"><h3 className="font-semibold text-lg mb-2">Operaciones ARCA</h3><p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Importe el archivo de operaciones de ARCA para crear la base de cobranzas.</p><div className="flex gap-2"><button onClick={() => arcaFileRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm">Importar ARCA</button><button onClick={() => handleDownloadTemplate('arca')} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 font-semibold py-2 px-4 rounded-md text-sm">Descargar Plantilla</button></div></div><div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600"><h3 className="font-semibold text-lg mb-2">Datos de Gestión</h3><p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Importe el archivo de gestión para "matchear" y actualizar las operaciones existentes.</p><div className="flex gap-2"><button onClick={() => gestionFileRef.current?.click()} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md text-sm">Importar Gestión</button><button onClick={() => handleDownloadTemplate('gestion')} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 font-semibold py-2 px-4 rounded-md text-sm">Descargar Plantilla</button></div></div></div><input type="file" ref={arcaFileRef} onChange={(e) => handleFileImport(e, 'arca')} className="hidden" accept=".xlsx, .xls" /><input type="file" ref={gestionFileRef} onChange={(e) => handleFileImport(e, 'gestion')} className="hidden" accept=".xlsx, .xls" /></div>)}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md"><div className="flex justify-between items-center mb-4"><div className="flex items-center gap-4"><h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Flujo de Cobranzas a 7 Días</h2><button onClick={() => setIsExpandedFlowModalOpen(true)} className="text-sm bg-white hover:bg-gray-100 text-primary font-semibold py-1 px-3 rounded-md border border-primary">Ver Flujo Extendido</button></div><div className="flex items-center gap-4"><ExportButtons data={flowExportData} columns={flowExportColumns} fileName="flujo_cobranzas_7_dias" pdfTitle="Flujo de Cobranzas a 7 Días"/>{highlightedCell && (<button onClick={() => setHighlightedCell(null)} className="text-sm text-blue-600 hover:underline">Limpiar selección</button>)}</div></div>
                <div className="overflow-x-auto"><table className="min-w-full text-sm border-collapse"><thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="p-2 border dark:border-gray-600 text-left sticky left-0 bg-gray-100 dark:bg-gray-700 z-10">Comprador</th>{next7Days.map(date => { const d = new Date(date + 'T00:00:00Z'); const dayOfWeek = d.getUTCDay(); const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; const isHoliday = holidays.includes(date); const day = d.toLocaleDateString('es-AR', { weekday: 'short', timeZone: 'UTC' }); const dayNum = d.toLocaleDateString('es-AR', { day: '2-digit', timeZone: 'UTC' }); return (<th key={date} className={`p-2 border dark:border-gray-600 text-center ${date === today.toISOString().split('T')[0] ? 'bg-primary/20' : ''} ${isWeekend || isHoliday ? 'bg-gray-200 dark:bg-gray-700/60' : ''}`}><div>{day}</div><div className="font-normal">{dayNum}</div></th>) })}<th className="p-2 border dark:border-gray-600 text-right sticky right-0 bg-gray-100 dark:bg-gray-700 z-10">Total</th></tr></thead><tbody>{buyersInFlow.map(buyer => (<tr key={buyer} className="hover:bg-gray-50 dark:hover:bg-gray-700/20"><td className="p-2 border dark:border-gray-600 sticky left-0 bg-white dark:bg-gray-800 z-10 font-semibold">{buyer}</td>{next7Days.map(date => { const totalAmount = flowData[date]?.[buyer] || 0; const d = new Date(date + 'T00:00:00Z'); const dayOfWeek = d.getUTCDay(); const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; const isHoliday = holidays.includes(date); const adjustmentsForCell = companyCollectionAdjustments.filter(adj => adj.date === date && adj.buyerName === buyer).reduce((sum, adj) => sum + adj.amount, 0); const displayAmount = totalAmount - adjustmentsForCell; const isHighlighted = highlightedCell?.date === date && highlightedCell?.buyer === buyer; return (<td key={date} className={`p-2 border dark:border-gray-600 text-right cursor-pointer transition-colors ${isHighlighted ? 'bg-primary/30' : ''} ${!isHighlighted && (isWeekend || isHoliday) ? 'bg-gray-100 dark:bg-gray-700/50' : ''} ${!isHighlighted && totalAmount !== 0 ? 'hover:bg-primary/10' : ''}`} onClick={() => handleCellClick(date, buyer)}>{totalAmount !== 0 ? <span className={isWeekend || isHoliday ? 'font-semibold' : ''}>{formatCurrency(displayAmount)}</span> : '-'}</td>) })}<td className="p-2 border dark:border-gray-600 text-right font-bold sticky right-0 bg-white dark:bg-gray-800 z-10">{formatCurrency(flowTotals.buyerTotals[buyer] || 0)}</td></tr>))}</tbody>
                         <tfoot className="font-bold bg-gray-100 dark:bg-gray-700 text-sm">
                             {(['Cheque', 'Compensa', 'Pase a Alyc', 'Ajuste'] as const).map(type => (<tr key={type} className="bg-gray-50 dark:bg-gray-800/50 text-xs font-normal"><td className="p-1 border dark:border-gray-600 sticky left-0 bg-gray-50 dark:bg-gray-800/50 z-10">{type}</td>{next7Days.map(date => { const isNonWorkingDay = new Date(date + 'T00:00:00Z').getUTCDay() % 6 === 0 || holidays.includes(date); return <td key={date} className={`p-1 border dark:border-gray-600 text-right ${isNonWorkingDay ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}>{formatCurrency(dailySubtotals.dailyAdjustments[date]?.[type] || 0)}</td> })}<td className="p-1 border dark:border-gray-600 text-right sticky right-0 bg-gray-50 dark:bg-gray-800/50 z-10">-</td></tr>))}
                            <tr className="bg-gray-100 dark:bg-gray-700 text-xs font-semibold"><td className="p-1 border dark:border-gray-600 sticky left-0 bg-gray-100 dark:bg-gray-700 z-10">Subtotal Transferencias</td>{next7Days.map(date => { const isNonWorkingDay = new Date(date + 'T00:00:00Z').getUTCDay() % 6 === 0 || holidays.includes(date); return <td key={date} className={`p-1 border dark:border-gray-600 text-right ${isNonWorkingDay ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}>{formatCurrency(dailySubtotals.dailyTotalBankFlows[date] || 0)}</td> })}<td className="p-1 border dark:border-gray-600 text-right sticky right-0 bg-gray-100 dark:bg-gray-700 z-10">-</td></tr>
                            {dailySubtotals.banksWithFlows.map(bank => (<tr key={bank.id} className="text-xs font-normal bg-gray-50 dark:bg-gray-800/30"><td className="p-1 border dark:border-gray-600 sticky left-0 bg-gray-50 dark:bg-gray-800/30 z-10 pl-4">↳ {bank.name}</td>{next7Days.map(date => { const isNonWorkingDay = new Date(date + 'T00:00:00Z').getUTCDay() % 6 === 0 || holidays.includes(date); return ( <td key={date} className={`p-1 border dark:border-gray-600 text-right ${isNonWorkingDay ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}>{formatCurrency(dailySubtotals.dailyBankFlows[date]?.[bank.id] || 0)}</td> ) })}<td className="p-1 border dark:border-gray-600 text-right sticky right-0 bg-gray-50 dark:bg-gray-800/30 z-10">-</td></tr>))}
                            <tr className="bg-gray-200 dark:bg-gray-600 text-base"><td className="p-2 border dark:border-gray-600 sticky left-0 bg-gray-200 dark:bg-gray-600 z-10">Total por Día</td>{next7Days.map(date => { const isHighlighted = highlightedCell?.date === date && highlightedCell?.buyer === '__DAILY_TOTAL__'; const isWeekend = new Date(date + 'T00:00:00Z').getUTCDay() % 6 === 0; const isHoliday = holidays.includes(date); return (<td key={date} className={`p-2 border dark:border-gray-600 text-right cursor-pointer transition-colors ${isHighlighted ? 'bg-primary/30' : (isWeekend || isHoliday) ? 'bg-gray-200 dark:bg-gray-700/80' : 'hover:bg-gray-300 dark:hover:bg-gray-500'}`} onClick={() => handleCellClick(date, '__DAILY_TOTAL__')}>{formatCurrency(flowTotals.dateTotals[date] || 0)}</td>)})}
                                <td className="p-2 border dark:border-gray-600 text-right sticky right-0 bg-gray-200 dark:bg-gray-600 z-10 text-lg">{formatCurrency(flowTotals.grandTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            <div>
                <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">Filtros de Búsqueda</h2><button onClick={() => setIsFilterPanelOpen(p => !p)} className="text-sm text-primary font-semibold">{isFilterPanelOpen ? 'Ocultar Filtros' : 'Mostrar Filtros'}</button></div>
                {isFilterPanelOpen && (<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-end"><div><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Fecha</label><select value={filters.dateType} onChange={e => setFilters(f => ({...f, dateType: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"><option value="dueDate">Fecha de Vencimiento</option><option value="issueDate">Fecha de Emisión</option><option value="actualCollectionDate">Fecha de Cobro Real</option></select></div><div><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Desde</label><input type="date" value={filters.startDate} onChange={e => setFilters(f => ({...f, startDate: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/></div><div><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Hasta</label><input type="date" value={filters.endDate} onChange={e => setFilters(f => ({...f, endDate: e.target.value}))} min={filters.startDate} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/></div><div><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Comprador</label><select value={filters.buyer} onChange={e => setFilters(f => ({...f, buyer: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"><option value="all">Todos</option>{uniqueBuyers.map(b => <option key={b} value={b}>{b}</option>)}</select></div></div>)}
            </div>
            <div>
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Detalle de Operaciones a Cobrar</h2><div className="flex items-center gap-4"><ExportButtons data={exportData} columns={exportColumns} fileName="cobranzas_activas" pdfTitle="Reporte de Cobranzas Activas" /><button onClick={() => setIsCollectedModalOpen(true)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold py-2 px-4 rounded-lg flex-shrink-0">Ver Archivo</button></div></div>
                 <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-2 text-left">Comprador</th><th className="p-2 text-left">N° Op.</th><th className="p-2 text-center">Fecha de Cobro</th><th className="p-2 text-center">Cuenta Acreditación</th><th className="p-2 text-right flex items-center justify-end gap-2">Neto Proyectado<HelpTooltip text="Es el monto estimado a cobrar. Se calcula aplicando el porcentaje de 'Deducción Tentativa' sobre el 'Monto Bruto'. Si se define un 'Neto Final', este valor tendrá prioridad sobre el cálculo automático." /></th><th className="p-2 text-center">Estado</th><th className="p-2 text-center">Acciones</th></tr></thead><tbody>{detailTableCollections.map(c => { const projectedNet = c.finalNetAmount ?? (c.grossAmount * (1 - c.tentativeDeductionPercentage / 100)); const collectionDate = c.actualCollectionDate || c.dueDate; const isOverdue = collectionDate ? new Date(collectionDate + 'T00:00:00Z') < today && c.status === 'matched' : false; const statusColors = { unmatched: 'bg-red-100 text-red-800', matched: 'bg-blue-100 text-blue-800', collected: 'bg-green-100 text-green-800' }; const isHighlighted = highlightedCell !== null && (collectionDate === highlightedCell.date) && (highlightedCell.buyer === '__DAILY_TOTAL__' || c.buyerName === highlightedCell.buyer); return (<tr key={c.id} className={`border-b dark:border-gray-700 transition-colors ${isHighlighted ? 'bg-blue-100 dark:bg-blue-900/40' : isOverdue ? 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}><td className="p-2 font-semibold">{c.buyerName}</td><td className="p-2">{c.operationCode}</td><td className="p-2 text-center text-xs"><div><span className="text-gray-500 dark:text-gray-400">Proy: </span>{c.dueDate ? new Date(c.dueDate + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'}) : '-'}</div><div className="flex items-center justify-center gap-1 mt-1"><span className="text-gray-500 dark:text-gray-400">Real: </span><input type="date" value={c.actualCollectionDate || ''} onChange={(e) => handleUpdateCollection({...c, actualCollectionDate: e.target.value})} className="p-1 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-1 focus:ring-primary focus:border-primary w-[130px]" aria-label="Fecha de cobro real" disabled={!canEdit || viewMode === 'consolidated'}/></div></td><td className="p-2 text-center"><select value={c.bankAccountId || ''} onChange={(e) => handleUpdateCollection({...c, bankAccountId: e.target.value || undefined})} className="p-1 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-xs w-full max-w-[150px]" disabled={!canEdit || viewMode === 'consolidated'}><option value="">-- Seleccionar --</option><optgroup label="Bancos">{banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup><optgroup label="Otros"><option value="cheque">Cheque</option><option value="compensacion">Compensación</option></optgroup></select></td><td className="p-2 text-right font-semibold">{formatCurrency(projectedNet)}</td><td className="p-2 text-center"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[c.status]}`}>{c.status}</span></td><td className="p-2 text-center">{canEdit && viewMode === 'individual' && (<div className="flex items-center justify-center gap-2"><button onClick={() => setEditingCollection(c)} className="text-blue-600" title="Ajustar Neto"><PencilIcon /></button><button onClick={() => handleUpdateCollection({...c, status: 'collected'})} className="text-green-600" title="Marcar como Cobrada"><CheckBadgeIcon /></button></div>)}</td></tr>);})}</tbody></table></div></div>
            </div>
            {editingCollection && <EditCollectionModal collection={editingCollection} onClose={() => setEditingCollection(null)} onSave={(updated) => { handleUpdateCollection(updated); setEditingCollection(null); }} />}
            {isCollectedModalOpen && <CollectedCollectionsModal isOpen={isCollectedModalOpen} collections={collectedCollections} banks={banks} onClose={() => setIsCollectedModalOpen(false)} holidays={holidays} />}
            {adjustmentModalData && <CollectionAdjustmentModal isOpen={!!adjustmentModalData} onClose={() => { setAdjustmentModalData(null); setHighlightedCell(null); }} onSave={(newAdjustments, bankId, collectionIds) => handleSaveAdjustmentsFromModal(adjustmentModalData.date, adjustmentModalData.buyerName, newAdjustments, bankId, collectionIds)} date={adjustmentModalData.date} buyerName={adjustmentModalData.buyerName} totalAmount={adjustmentModalData.totalAmount} bankBreakdown={adjustmentModalData.bankBreakdown} initialAdjustments={companyCollectionAdjustments.filter(a => a.date === adjustmentModalData.date && (a.buyerName === adjustmentModalData.buyerName || (adjustmentModalData.buyerName === '__DAILY_TOTAL__' && a.buyerName.startsWith('__'))))} collections={adjustmentModalData.collections} banks={banks} />}
            {isExpandedFlowModalOpen && <ExpandedFlowModal isOpen={isExpandedFlowModalOpen} onClose={() => setIsExpandedFlowModalOpen(false)} collections={detailTableCollections} adjustments={companyCollectionAdjustments} today={today} banks={banks} filters={filters} holidays={holidays} />}
        </div>
    );
};

export default GrainCollectionModule;