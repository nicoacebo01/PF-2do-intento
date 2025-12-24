import React, { useState, useMemo, useCallback } from 'react';
import type { ArbitrageOperation, BusinessUnit, DailyExchangeRate, FutureExchangeRateSnapshot } from '../types';
import { PencilIcon, EyeIcon, PlusCircleIcon, ChevronUpIcon, ChevronDownIcon } from './Icons';
import { useAppContext } from '../App';
import { useFinancialCalculations } from '../utils/calculations';
import { getTodayArgentinaDate, getInterpolatedRate } from '../utils/financials';
import FormattedNumberInput from './FormattedNumberInput';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { XIcon } from './Icons';
import SelectFwdOperationModal from './SelectFwdOperationModal';


// --- MODAL PARA EDITAR EL TRADE INTERNO ---
const FwdPesificadoTradeForm: React.FC<{
    operation: ArbitrageOperation;
    onSave: (updatedOp: ArbitrageOperation) => void;
    onClose: () => void;
}> = ({ operation, onSave, onClose }) => {
    const [internalRate, setInternalRate] = useState<number | ''>(operation.internalArbitrageRate || '');
    const [client, setClient] = useState(operation.client || '');
    const [branch, setBranch] = useState(operation.branch || '');
    const [salesperson, setSalesperson] = useState(operation.salesperson || '');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...operation,
            internalArbitrageRate: Number(internalRate),
            client,
            branch,
            salesperson,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg m-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Gestionar Trade Interno</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">TC de Arbitraje Interno</label>
                        <FormattedNumberInput value={internalRate} onChange={setInternalRate} className="mt-1" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
                        <input type="text" value={client} onChange={e => setClient(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sucursal</label>
                        <input type="text" value={branch} onChange={e => setBranch(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comercial</label>
                        <input type="text" value={salesperson} onChange={e => setSalesperson(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200" />
                    </div>
                    <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200">Cancelar</button>
                        <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

type SortDirection = 'ascending' | 'descending';
interface SortConfig {
  key: string | null;
  direction: SortDirection;
}

// --- TABLA REUTILIZABLE PARA OPERACIONES ---
const OperationsList: React.FC<{
    operations: any[];
    isArchive?: boolean;
    onEdit: (op: ArbitrageOperation) => void;
    viewMode: 'individual' | 'consolidated';
}> = ({ operations, isArchive = false, onEdit, viewMode }) => {
    
    const formatARS = (val?: number) => val?.toLocaleString('es-AR', {style: 'currency', currency: 'ARS'}) ?? '-';
    const formatUSD = (val?: number) => val ? `USD ${val.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-';

    const [sortConfig, setSortConfig] = useState<SortConfig>({ 
        key: 'arbitrageDate', 
        direction: isArchive ? 'descending' : 'ascending' 
    });

    const requestSort = (key: string) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const ThWithSorting: React.FC<{ columnKey: string; title: string; colSpan?: number; rowSpan?: number; className?: string; }> = ({ columnKey, title, colSpan, rowSpan, className }) => {
        const sortIcon = sortConfig.key === columnKey
            ? (sortConfig.direction === 'ascending' ? <ChevronUpIcon /> : <ChevronDownIcon />)
            : null;
        return (
            <th colSpan={colSpan} rowSpan={rowSpan} className={`p-1 group ${className || ''}`}>
                <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => requestSort(columnKey)}>
                    <span>{title}</span>
                    <div className="w-4 h-4 flex items-center justify-center">
                        {sortIcon ? sortIcon : <ChevronUpIcon className="text-gray-400 opacity-0 group-hover:opacity-50 transition-opacity" />}
                    </div>
                </div>
            </th>
        );
    };

    const sortedOperations = useMemo(() => {
        let sortableItems = [...operations];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key!];
                const bValue = b[sortConfig.key!];
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [operations, sortConfig]);

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <tr>
                        {viewMode === 'consolidated' && <ThWithSorting columnKey="companyName" title="Empresa" rowSpan={2} className="text-left" />}
                        <ThWithSorting columnKey="instrument" title="Operación" rowSpan={2} className="text-left" />
                        <ThWithSorting columnKey="usdAmount" title="Monto USD" rowSpan={2} className="text-right" />
                        <th className="p-2 text-center" colSpan={2}>Tasas de Cambio</th>
                        <th className="p-2 text-center border-l border-r dark:border-gray-600" colSpan={2}>Resultado Real</th>
                        <th className="p-2 text-center border-r dark:border-gray-600" colSpan={2}>Resultado Interno</th>
                        <th className="p-2 text-center" colSpan={2}>Spread</th>
                        <ThWithSorting columnKey="client" title="Cliente" rowSpan={2} className="text-left" />
                        <ThWithSorting columnKey="branch" title="Sucursal" rowSpan={2} className="text-left" />
                        <ThWithSorting columnKey="salesperson" title="Comercial" rowSpan={2} className="text-left" />
                        <th className="p-2 text-center" rowSpan={2}>Acciones</th>
                    </tr>
                    <tr>
                        <ThWithSorting columnKey="arbitrageRate" title="Real" className="font-normal text-right" />
                        <ThWithSorting columnKey="internalArbitrageRate" title="Interna" className="font-normal text-right" />
                        <th className="p-1 text-right font-normal border-l dark:border-gray-600">ARS</th>
                        <th className="p-1 text-right font-normal border-r dark:border-gray-600">USD</th>
                        <th className="p-1 text-right font-normal">ARS</th>
                        <th className="p-1 text-right font-normal border-r dark:border-gray-600">USD</th>
                        <th className="p-1 text-right font-normal">ARS</th>
                        <th className="p-1 text-right font-normal">USD</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {sortedOperations.map(op => (
                        <tr key={op.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            {viewMode === 'consolidated' && <td className="p-2 text-gray-800 dark:text-gray-200">{op.companyName}</td>}
                            <td className="p-2">
                                <div className="font-semibold text-gray-800 dark:text-gray-100">{op.instrument} {op.position}</div>
                                <div className="text-gray-500">{new Date(op.arbitrageDate).toLocaleDateString('es-AR', {timeZone: 'UTC'})}</div>
                            </td>
                            <td className="p-2 text-right font-semibold">{op.usdAmount.toLocaleString('es-AR')}</td>
                            <td className="p-2 text-right">{op.arbitrageRate.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                            <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400">{op.internalArbitrageRate?.toLocaleString('es-AR', {minimumFractionDigits: 2}) ?? '-'}</td>
                            
                            <td className={`p-2 text-right font-semibold border-l dark:border-gray-600 ${(op.pnl.pnl_ars_real || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{formatARS(op.pnl.pnl_ars_real)}</td>
                            <td className={`p-2 text-right font-semibold border-r dark:border-gray-600 ${(op.pnl.pnl_usd_real || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{formatUSD(op.pnl.pnl_usd_real)}</td>
                            
                            <td className={`p-2 text-right font-semibold ${(op.pnl.pnl_ars_internal || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{formatARS(op.pnl.pnl_ars_internal)}</td>
                            <td className={`p-2 text-right font-semibold border-r dark:border-gray-600 ${(op.pnl.pnl_usd_internal || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{formatUSD(op.pnl.pnl_usd_internal)}</td>
                            
                            <td className={`p-2 text-right font-bold text-primary dark:text-accent-dm ${(op.pnl.pnl_ars_spread || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{formatARS(op.pnl.pnl_ars_spread)}</td>
                            <td className={`p-2 text-right font-bold text-primary dark:text-accent-dm ${(op.pnl.pnl_usd_spread || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{formatUSD(op.pnl.pnl_usd_spread)}</td>
                            
                            <td className="p-2 text-left text-gray-700 dark:text-gray-300">{op.client || '-'}</td>
                            <td className="p-2 text-left text-gray-700 dark:text-gray-300">{op.branch || '-'}</td>
                            <td className="p-2 text-left text-gray-700 dark:text-gray-300">{op.salesperson || '-'}</td>
                            <td className="p-2 text-center">
                                {viewMode === 'individual' && (
                                    <button onClick={() => onEdit(op)} className="text-blue-600 hover:text-blue-800" title="Gestionar Trade Interno">
                                        <PencilIcon />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// --- MODAL PARA OPERACIONES VENCIDAS ---
const ExpiredFwdPesificadosModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    operations: any[];
    onEdit: (op: ArbitrageOperation) => void;
    viewMode: 'individual' | 'consolidated';
}> = ({ isOpen, onClose, operations, onEdit, viewMode }) => {

    const exportColumns: ExportColumn<any>[] = useMemo(() => {
        const columns: ExportColumn<any>[] = [
            { header: 'Instrumento', accessor: d => `${d.instrument} ${d.position}` },
            { header: 'Vencimiento', accessor: d => new Date(d.arbitrageDate).toLocaleDateString('es-AR', {timeZone: 'UTC'}) },
            { header: 'Monto USD', accessor: d => d.usdAmount },
            { header: 'TC Real', accessor: d => d.arbitrageRate },
            { header: 'TC Interna', accessor: d => d.internalArbitrageRate ?? '-' },
            { header: 'Res. Real ARS', accessor: d => d.pnl.pnl_ars_real ?? 0 },
            { header: 'Res. Real USD', accessor: d => d.pnl.pnl_usd_real ?? 0 },
            { header: 'Res. Interno ARS', accessor: d => d.pnl.pnl_ars_internal ?? 0 },
            { header: 'Res. Interno USD', accessor: d => d.pnl.pnl_usd_internal ?? 0 },
            { header: 'Spread ARS', accessor: d => d.pnl.pnl_ars_spread ?? 0 },
            { header: 'Spread USD', accessor: d => d.pnl.pnl_usd_spread ?? 0 },
            { header: 'Cliente', accessor: d => d.client || '-' },
            { header: 'Sucursal', accessor: d => d.branch || '-' },
            { header: 'Comercial', accessor: d => d.salesperson || '-' },
        ];

        if (viewMode === 'consolidated') {
            columns.unshift({ header: 'Empresa', accessor: d => d.companyName || '' });
        }
        return columns;

    }, [viewMode]);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl m-4 h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Archivo de Operaciones Vencidas</h2>
                    <div className="flex items-center gap-4">
                        <ExportButtons
                            data={operations}
                            columns={exportColumns}
                            fileName="fwd_pesificados_archivo"
                            pdfTitle="FWD Pesificados - Archivo de Operaciones"
                        />
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
                    </div>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">
                    <OperationsList operations={operations} onEdit={onEdit} isArchive viewMode={viewMode} />
                </div>
                <div className="flex justify-end p-4 border-t dark:border-gray-700">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 font-bold py-2 px-4 rounded-lg">Cerrar</button>
                </div>
            </div>
        </div>
    );
};

// --- MODAL PARA DETALLE DE SNAPSHOT ---
const FwdPesificadosSnapshotModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  operations: any[];
}> = ({ isOpen, onClose, title, operations }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl m-4 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">
                   <OperationsList operations={operations} onEdit={() => {}} viewMode="individual" />
                </div>
                 <div className="flex justify-end p-4 border-t dark:border-gray-700">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 font-bold py-2 px-4 rounded-lg">Cerrar</button>
                </div>
            </div>
        </div>
    );
};

// --- LÓGICA DE CÁLCULO Y COMPONENTE DE ANÁLISIS ---
const calculateFwdPesificadosSnapshot = (
    dateStr: string,
    ops: ArbitrageOperation[],
    futureRateHistory: FutureExchangeRateSnapshot[],
    exchangeRates: DailyExchangeRate[],
) => {
    const totals = { 
        real: { ars: 0, usd: 0 },
        internal: { ars: 0, usd: 0 },
        spread: { ars: 0, usd: 0 },
    };
    if (!dateStr || ops.length === 0) return { totals, operations: [] };

    const snapshotDate = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(snapshotDate.getTime())) return { totals, operations: [] };

    const snapshot = [...futureRateHistory].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate)).find(s => s.snapshotDate <= dateStr);
    const spotRateForSnapshot = [...exchangeRates].sort((a, b) => b.date.localeCompare(a.date)).find(r => r.date <= dateStr)?.rate;
    if (!spotRateForSnapshot) return { totals, operations: [] };
    
    const processedOps: any[] = [];

    ops.forEach(op => {
        const isRealized = (op.cancellationDate || op.arbitrageDate) <= dateStr;
        const isLatent = op.startDate <= dateStr && !isRealized;

        if (isRealized || isLatent) {
            let closingRate: number | null = null;
            let rateForUsdPnl: number = spotRateForSnapshot;

            if (isRealized) {
                const closingDate = op.cancellationDate || op.arbitrageDate;
                const spotOnClose = [...exchangeRates].sort((a, b) => b.date.localeCompare(a.date)).find(r => r.date <= closingDate)?.rate;
                if (!spotOnClose) return;
                rateForUsdPnl = spotOnClose;

                closingRate = op.cancellationRate ?? (() => {
                    const snapshotOnClose = [...futureRateHistory].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate)).find(s => s.snapshotDate <= closingDate);
                    return snapshotOnClose ? getInterpolatedRate(new Date(op.arbitrageDate), snapshotOnClose, spotOnClose) : null;
                })();
            } else { // Latent
                 closingRate = snapshot ? getInterpolatedRate(new Date(op.arbitrageDate), snapshot, spotRateForSnapshot) : null;
            }

            if (closingRate === null) return;
            
            const pnl_ars_real = (op.position === 'Vendida' ? op.arbitrageRate - closingRate : closingRate - op.arbitrageRate) * op.usdAmount;
            const pnl_usd_real = pnl_ars_real / rateForUsdPnl;
            totals.real.ars += pnl_ars_real;
            totals.real.usd += pnl_usd_real;

            let pnl_ars_internal = 0, pnl_usd_internal = 0, pnl_ars_spread = 0, pnl_usd_spread = 0;
            if (op.internalArbitrageRate && op.internalArbitrageRate > 0) {
                 pnl_ars_internal = (op.position === 'Vendida' ? closingRate - op.internalArbitrageRate : op.internalArbitrageRate - closingRate) * op.usdAmount;
                 pnl_usd_internal = pnl_ars_internal / rateForUsdPnl;
                 totals.internal.ars += pnl_ars_internal;
                 totals.internal.usd += pnl_usd_internal;

                 pnl_ars_spread = pnl_ars_internal + pnl_ars_real;
                 pnl_usd_spread = pnl_usd_internal + pnl_usd_real;
                 totals.spread.ars += pnl_ars_spread;
                 totals.spread.usd += pnl_usd_spread;
            }
            
            processedOps.push({ ...op, pnl: { pnl_ars_real, pnl_usd_real, pnl_ars_internal, pnl_usd_internal, pnl_ars_spread, pnl_usd_spread } });
        }
    });

    return { totals, operations: processedOps };
};

const FwdPesificadosAnalysis: React.FC<{
    operations: ArbitrageOperation[];
}> = ({ operations }) => {
    const { futureRateHistory, exchangeRates } = useFinancialCalculations();
    const today = useMemo(() => getTodayArgentinaDate().toISOString().split('T')[0], []);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(today); d.setDate(1); return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(today);
    const [modalData, setModalData] = useState<{title: string, operations: any[]} | null>(null);

    const { startSnapshot, endSnapshot, period } = useMemo(() => {
        const dateParts = startDate.split('-').map(Number);
        const startDateObj = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        startDateObj.setUTCDate(startDateObj.getUTCDate() - 1);
        const prevDayStr = startDateObj.toISOString().split('T')[0];

        const endSnap = calculateFwdPesificadosSnapshot(endDate, operations, futureRateHistory, exchangeRates);
        const startSnap = calculateFwdPesificadosSnapshot(prevDayStr, operations, futureRateHistory, exchangeRates);

        const periodPnl = {
            real: { ars: endSnap.totals.real.ars - startSnap.totals.real.ars, usd: endSnap.totals.real.usd - startSnap.totals.real.usd },
            internal: { ars: endSnap.totals.internal.ars - startSnap.totals.internal.ars, usd: endSnap.totals.internal.usd - startSnap.totals.internal.usd },
            spread: { ars: endSnap.totals.spread.ars - startSnap.totals.spread.ars, usd: endSnap.totals.spread.usd - startSnap.totals.spread.usd },
        };

        return { startSnapshot: startSnap, endSnapshot: endSnap, period: periodPnl };
    }, [startDate, endDate, operations, futureRateHistory, exchangeRates]);

    const formatARS = (val: number) => val.toLocaleString('es-AR', {style: 'currency', currency: 'ARS'});
    const formatUSD = (val: number) => `USD ${val.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    const ResultBlock: React.FC<{title:string, data: any, onClick?: () => void}> = ({ title, data, onClick }) => (
        <button onClick={onClick} disabled={!onClick} className={`p-3 rounded-lg text-left w-full space-y-2 ${onClick ? 'hover:bg-gray-200 dark:hover:bg-gray-700/50 cursor-pointer' : 'cursor-default'} bg-gray-100 dark:bg-gray-800/50`}>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 flex justify-between items-center">{title} {onClick && <EyeIcon/>}</p>
            <div className="grid grid-cols-3 text-xs">
                <span className="font-semibold"></span><span className="font-semibold text-right">Real</span><span className="font-semibold text-right">Interno</span>
                <span className="font-bold text-primary dark:text-accent-dm">Spread</span><span className="font-bold text-primary dark:text-accent-dm text-right">{formatARS(data.spread.ars)}</span><span className="font-bold text-primary dark:text-accent-dm text-right">{formatUSD(data.spread.usd)}</span>
                <span></span><span className="text-right">{formatARS(data.real.ars)}</span><span className="text-right">{formatARS(data.internal.ars)}</span>
                <span></span><span className="text-right">{formatUSD(data.real.usd)}</span><span className="text-right">{formatUSD(data.internal.usd)}</span>
            </div>
        </button>
    );
    
    const commonInputClass = "mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600";
    
    return (
        <>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">Análisis de Resultados Acumulados</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div><label className="text-sm font-medium">Desde (inclusive):</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} max={endDate} className={commonInputClass}/></div>
                    <div><label className="text-sm font-medium">Hasta (inclusive):</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} max={today} className={commonInputClass}/></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t dark:border-gray-600">
                    <ResultBlock title="Resultado Acumulado Inicial" data={startSnapshot.totals} onClick={() => setModalData({title: 'Detalle de Snapshot Inicial', operations: startSnapshot.operations})} />
                    <ResultBlock title="Resultado Acumulado Final" data={endSnapshot.totals} onClick={() => setModalData({title: 'Detalle de Snapshot Final', operations: endSnapshot.operations})} />
                    <ResultBlock title="Resultado del Período" data={period} />
                </div>
            </div>
            {modalData && <FwdPesificadosSnapshotModal isOpen={!!modalData} onClose={() => setModalData(null)} {...modalData} />}
        </>
    );
}

// --- COMPONENTE PRINCIPAL DEL MÓDULO ---
const FwdPesificadosModule: React.FC = () => {
    const { dispatch, state } = useAppContext();
    const { companies, viewMode } = state;
    const { businessUnits, companyArbitrageOps, futureRateHistory, exchangeRates } = useFinancialCalculations();
    
    const [editingOperation, setEditingOperation] = useState<ArbitrageOperation | null>(null);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);

    const onSave = (opData: ArbitrageOperation) => {
        dispatch({ type: 'SAVE_ARBITRAGE', payload: { opData, id: opData.id } });
    };

    const spreadBusinessUnitIds = useMemo(() => 
        new Set(businessUnits.filter(bu => bu.admiteSpread).map(bu => bu.id)),
        [businessUnits]
    );

    const { fwdOperations, candidateOperations } = useMemo(() => {
        const fwdOps: ArbitrageOperation[] = [];
        const candidateOps: ArbitrageOperation[] = [];

        companyArbitrageOps.forEach(op => {
            if (op.businessUnitId && spreadBusinessUnitIds.has(op.businessUnitId)) {
                if (op.internalArbitrageRate !== undefined) {
                    fwdOps.push(op);
                } else {
                    candidateOps.push(op);
                }
            }
        });

        return { fwdOperations: fwdOps, candidateOperations: candidateOps };
    }, [companyArbitrageOps, spreadBusinessUnitIds]);
    
    const today = useMemo(() => getTodayArgentinaDate(), []);

    const { activeOperations, archivedOperations } = useMemo(() => {
        const snapshotDateStr = today.toISOString().split('T')[0];
        const snapshot = [...futureRateHistory].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate)).find(s => s.snapshotDate <= snapshotDateStr);
        const spotRateForSnapshot = [...exchangeRates].sort((a, b) => b.date.localeCompare(a.date)).find(r => r.date <= snapshotDateStr)?.rate;
        
        const active: any[] = [];
        const archived: any[] = [];

        fwdOperations.forEach(op => {
            const isArchived = (op.cancellationDate || op.arbitrageDate) < snapshotDateStr;
            let closingRate: number | null = null;
            let rateForUsdPnl = spotRateForSnapshot;

            if (isArchived) {
                const closingDate = op.cancellationDate || op.arbitrageDate;
                const spotOnClose = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= closingDate)?.rate;
                if (!spotOnClose) return;
                rateForUsdPnl = spotOnClose;
                closingRate = op.cancellationRate ?? spotOnClose; // Simplified for realized PnL
            } else {
                 if (!spotRateForSnapshot) return;
                 closingRate = snapshot ? getInterpolatedRate(new Date(op.arbitrageDate), snapshot, spotRateForSnapshot) : null;
            }
            
            if (closingRate === null) return;
            
            const pnl_ars_real = (op.position === 'Vendida' ? op.arbitrageRate - closingRate : closingRate - op.arbitrageRate) * op.usdAmount;
            const pnl_usd_real = pnl_ars_real / rateForUsdPnl;
            
            let pnl_ars_internal = 0, pnl_usd_internal = 0, pnl_ars_spread = 0, pnl_usd_spread = 0;
            if (op.internalArbitrageRate && op.internalArbitrageRate > 0) {
                 pnl_ars_internal = (op.position === 'Vendida' ? closingRate - op.internalArbitrageRate : op.internalArbitrageRate - closingRate) * op.usdAmount;
                 pnl_usd_internal = pnl_ars_internal / rateForUsdPnl;
                 pnl_ars_spread = pnl_ars_internal + pnl_ars_real;
                 pnl_usd_spread = pnl_usd_internal + pnl_usd_real;
            }
            const companyName = companies.find(c => c.id === op.companyId)?.name || 'N/D';
            const processedOp = { ...op, pnl: { pnl_ars_real, pnl_usd_real, pnl_ars_internal, pnl_usd_internal, pnl_ars_spread, pnl_usd_spread }, companyName };
            
            if (isArchived) archived.push(processedOp); else active.push(processedOp);
        });

        return { 
            activeOperations: active,
            archivedOperations: archived
        };
    }, [fwdOperations, today, futureRateHistory, exchangeRates, companies]);

    const exportColumns: ExportColumn<any>[] = useMemo(() => {
        const columns: ExportColumn<any>[] = [
            { header: 'Instrumento', accessor: d => `${d.instrument} ${d.position}` },
            { header: 'Vencimiento', accessor: d => new Date(d.arbitrageDate).toLocaleDateString('es-AR', {timeZone: 'UTC'}) },
            { header: 'Monto USD', accessor: d => d.usdAmount },
            { header: 'TC Real', accessor: d => d.arbitrageRate },
            { header: 'TC Interna', accessor: d => d.internalArbitrageRate ?? '-' },
            { header: 'Res. Real ARS', accessor: d => d.pnl.pnl_ars_real ?? 0 },
            { header: 'Res. Real USD', accessor: d => d.pnl.pnl_usd_real ?? 0 },
            { header: 'Res. Interno ARS', accessor: d => d.pnl.pnl_ars_internal ?? 0 },
            { header: 'Res. Interno USD', accessor: d => d.pnl.pnl_usd_internal ?? 0 },
            { header: 'Spread ARS', accessor: d => d.pnl.pnl_ars_spread ?? 0 },
            { header: 'Spread USD', accessor: d => d.pnl.pnl_usd_spread ?? 0 },
            { header: 'Cliente', accessor: d => d.client || '-' },
            { header: 'Sucursal', accessor: d => d.branch || '-' },
            { header: 'Comercial', accessor: d => d.salesperson || '-' },
        ];

        if (viewMode === 'consolidated') {
            columns.unshift({ header: 'Empresa', accessor: d => d.companyName || '' });
        }
        return columns;
    }, [viewMode]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">FWD Pesificados - Posición y Resultados</h1>
                {viewMode === 'individual' && (
                    <button onClick={() => setIsSelectModalOpen(true)} className="flex items-center gap-2 bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg shadow-md">
                        <PlusCircleIcon /> Agregar Operación FWD
                    </button>
                )}
            </div>
            
            <FwdPesificadosAnalysis operations={fwdOperations} />

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Operaciones Activas</h2>
                    <div className="flex items-center gap-4">
                        <ExportButtons
                            data={activeOperations}
                            columns={exportColumns}
                            fileName={`fwd_pesificados_activos_${today.toISOString().split('T')[0]}`}
                            pdfTitle="FWD Pesificados - Operaciones Activas"
                        />
                        <button onClick={() => setIsArchiveOpen(true)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold py-2 px-4 rounded-lg">Ver Archivo</button>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    {activeOperations.length > 0 ? (
                        <OperationsList operations={activeOperations} onEdit={setEditingOperation} viewMode={viewMode} />
                    ) : (
                        <p className="p-8 text-center text-gray-500 dark:text-gray-400">No hay operaciones FWD activas. Puede agregarlas desde el botón "Agregar Operación FWD".</p>
                    )}
                </div>
            </div>

            {editingOperation && (
                <FwdPesificadoTradeForm
                    operation={editingOperation}
                    onClose={() => setEditingOperation(null)}
                    onSave={(updatedOp) => {
                        onSave(updatedOp);
                        setEditingOperation(null);
                    }}
                />
            )}

            <ExpiredFwdPesificadosModal
                isOpen={isArchiveOpen}
                onClose={() => setIsArchiveOpen(false)}
                operations={archivedOperations}
                onEdit={setEditingOperation}
                viewMode={viewMode}
            />

            {isSelectModalOpen && (
                <SelectFwdOperationModal
                    isOpen={isSelectModalOpen}
                    onClose={() => setIsSelectModalOpen(false)}
                    candidateOperations={candidateOperations}
                    businessUnits={businessUnits}
                />
            )}
        </div>
    );
};

export default FwdPesificadosModule;