import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppContext } from '../App';
import type { GrainCollection, Bank, CollectionAdjustment } from '../types';
import { XIcon, ArrowUturnLeftIcon, ChevronUpIcon, ChevronDownIcon } from './Icons';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { calculateBusinessDays } from '../utils/financials';

const getProjectedNetAmount = (c: GrainCollection) => {
    if (c.status === 'unmatched') return 0;
    let netAmount: number;
    if (c.finalNetAmount !== undefined) {
        netAmount = c.finalNetAmount;
    } else {
        const deductionAmount = c.grossAmount * (c.tentativeDeductionPercentage / 100);
        netAmount = c.grossAmount - deductionAmount;
    }
    return c.movementType === 'Crédito' ? -netAmount : netAmount;
};

const formatCurrency = (amount: number) => amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

type SortDirection = 'ascending' | 'descending';
interface SortConfig {
  key: string | null;
  direction: SortDirection;
}

type ExportedCollection = GrainCollection & {
  projectedNet: number;
  bankAccountName: string;
  issueDelay: number | null;
  dueDelay: number | null;
};

const CollectedList: React.FC<{
    collections: GrainCollection[];
    banks: Bank[];
    holidays: string[];
    onRestore: (collection: GrainCollection) => void;
}> = ({ collections, banks, holidays, onRestore }) => {
    
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'actualCollectionDate', direction: 'descending' });

    const requestSort = (key: string) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedCollections = useMemo(() => {
        let sortableItems = [...collections];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;
                if (sortConfig.key === 'netAmount') {
                    aValue = getProjectedNetAmount(a);
                    bValue = getProjectedNetAmount(b);
                } else if (sortConfig.key === 'issueDelay') {
                    aValue = a.issueDate && a.actualCollectionDate ? calculateBusinessDays(a.issueDate, a.actualCollectionDate, holidays) : -1;
                    bValue = b.issueDate && b.actualCollectionDate ? calculateBusinessDays(b.issueDate, b.actualCollectionDate, holidays) : -1;
                } else if (sortConfig.key === 'dueDelay') {
                    aValue = a.dueDate && a.actualCollectionDate ? calculateBusinessDays(a.dueDate, a.actualCollectionDate, holidays) : -1;
                    bValue = b.dueDate && b.actualCollectionDate ? calculateBusinessDays(b.dueDate, b.actualCollectionDate, holidays) : -1;
                } else {
                    aValue = (a as any)[sortConfig.key!];
                    bValue = (b as any)[sortConfig.key!];
                }
                
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [collections, sortConfig, holidays]);
    
    const ThWithSorting: React.FC<{ columnKey: string; title: string; className?: string }> = ({ columnKey, title, className }) => {
        const sortIcon = sortConfig.key === columnKey
            ? (sortConfig.direction === 'ascending' ? <ChevronUpIcon /> : <ChevronDownIcon />)
            : null;
        return (
            <th className={`px-4 py-2 group ${className || ''}`} onClick={() => requestSort(columnKey)}>
                 <div className="flex items-center gap-2 cursor-pointer">
                    <span>{title}</span>
                    <div className="w-4 h-4 flex items-center justify-center">
                        {sortIcon ? sortIcon : <ChevronUpIcon className="text-gray-400 opacity-0 group-hover:opacity-50 transition-opacity" />}
                    </div>
                </div>
            </th>
        );
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <ThWithSorting columnKey="buyerName" title="Comprador" className="text-left" />
                        <ThWithSorting columnKey="operationCode" title="N° Op." className="text-left" />
                        <ThWithSorting columnKey="actualCollectionDate" title="Fecha Cobro" className="text-center" />
                        <ThWithSorting columnKey="netAmount" title="Neto Cobrado" className="text-right" />
                        <ThWithSorting columnKey="issueDelay" title="Demora Emisión (días hábiles)" className="text-center" />
                        <ThWithSorting columnKey="dueDelay" title="Demora Vto. (días hábiles)" className="text-center" />
                        <th className="px-4 py-2 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedCollections.map(c => {
                        const issueDelay = c.issueDate && c.actualCollectionDate ? calculateBusinessDays(c.issueDate, c.actualCollectionDate, holidays) : null;
                        const dueDelay = c.dueDate && c.actualCollectionDate ? calculateBusinessDays(c.dueDate, c.actualCollectionDate, holidays) : null;
                        return (
                            <tr key={c.id}>
                                <td className="px-4 py-2">{c.buyerName}</td>
                                <td className="px-4 py-2">{c.operationCode}</td>
                                <td className="px-4 py-2 text-center">{c.actualCollectionDate ? new Date(c.actualCollectionDate + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'}) : c.dueDate ? new Date(c.dueDate + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'}) : '-'}</td>
                                <td className="px-4 py-2 text-right font-semibold">{getProjectedNetAmount(c).toLocaleString('es-AR', {style:'currency', currency:'ARS'})}</td>
                                <td className="px-4 py-2 text-center">{issueDelay !== null ? issueDelay : '-'}</td>
                                <td className={`px-4 py-2 text-center font-semibold ${dueDelay !== null && dueDelay > 0 ? 'text-red-600' : 'text-green-600'}`}>{dueDelay !== null ? dueDelay : '-'}</td>
                                <td className="px-4 py-2 text-center">
                                    <button onClick={() => onRestore(c)} className="text-blue-600 hover:text-blue-800" title="Restaurar a Activas">
                                        <ArrowUturnLeftIcon />
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};


const CollectedCollectionsModal: React.FC<{
  isOpen: boolean;
  collections: GrainCollection[];
  banks: Bank[];
  onClose: () => void;
  holidays: string[];
}> = ({ isOpen, collections, banks, onClose, holidays }) => {
  const { dispatch } = useAppContext();
  const [view, setView] = useState<'list' | 'monthly' | 'summary'>('list');
  
  const [filters, setFilters] = useState({
    dateType: 'actualCollectionDate',
    startDate: '',
    endDate: '',
    buyer: 'all'
  });
  
  const [summaryResults, setSummaryResults] = useState<GrainCollection[] | null>(null);

  useEffect(() => {
    setSummaryResults(null);
  }, [filters]);

  const uniqueBuyers = useMemo(() => {
    return [...new Set(collections.map(c => c.buyerName))].sort();
  }, [collections]);

  const monthlyExportColumns: ExportColumn<any>[] = [
    { header: 'Mes', accessor: d => new Date(d.month + '-02T00:00:00Z').toLocaleDateString('es-AR', {month: 'long', year: 'numeric', timeZone:'UTC'}) },
    { header: 'Monto Cobrado', accessor: d => d.total },
    { header: 'Cant. Operaciones', accessor: d => d.count }
  ];

  const getBankName = useCallback((bankAccountId?: string) => {
    if (!bankAccountId) return '';
    const bank = banks.find(b => b.id === bankAccountId);
    if (bank) return bank.name;
    return bankAccountId.charAt(0).toUpperCase() + bankAccountId.slice(1);
  }, [banks]);
  
  const filteredListCollections = useMemo(() => {
    return collections.filter(c => {
        if (filters.buyer !== 'all' && c.buyerName !== filters.buyer) {
            return false;
        }

        const dateField = filters.dateType as keyof GrainCollection;
        const dateStr = c[dateField] as string | undefined;

        if (!filters.startDate && !filters.endDate) return true;
        if (!dateStr) return false;
        const itemDate = new Date(dateStr + 'T00:00:00Z');
        if (filters.startDate && itemDate < new Date(filters.startDate + 'T00:00:00Z')) return false;
        if (filters.endDate && itemDate > new Date(filters.endDate + 'T00:00:00Z')) return false;
        
        return true;
    });
  }, [collections, filters]);

  const monthlySummary = useMemo(() => {
    // FIX: Refactored to use a Map for robust type inference, resolving an 'unknown' type error.
    const byMonthMap = collections.reduce((acc, curr) => {
        const collectionDate = curr.actualCollectionDate;
        if (!collectionDate) return acc;
        const monthKey = collectionDate.substring(0, 7); // YYYY-MM
        if (!acc.has(monthKey)) {
            acc.set(monthKey, { total: 0, count: 0 });
        }
        const entry = acc.get(monthKey)!;
        entry.total += getProjectedNetAmount(curr);
        entry.count += 1;
        return acc;
    }, new Map<string, { total: number; count: number }>());

    return Array.from(byMonthMap.entries())
        .map(([month, data]) => ({ month, total: data.total, count: data.count }))
        .sort((a, b) => b.month.localeCompare(a.month)); // Newest first
  }, [collections]);
  
  const handleGenerateSummary = () => {
    setSummaryResults(filteredListCollections);
  };

  const summaryTotal = useMemo(() => {
    if (!summaryResults) return 0;
    return summaryResults.reduce((acc, curr) => acc + getProjectedNetAmount(curr), 0);
  }, [summaryResults]);

  const exportData = useMemo((): ExportedCollection[] => {
    return filteredListCollections.map((c): ExportedCollection => {
        const projectedNet = getProjectedNetAmount(c);
        const issueDelay = c.issueDate && c.actualCollectionDate ? calculateBusinessDays(c.issueDate, c.actualCollectionDate, holidays) : null;
        const dueDelay = c.dueDate && c.actualCollectionDate ? calculateBusinessDays(c.dueDate, c.actualCollectionDate, holidays) : null;
        return {
            id: c.id,
            companyId: c.companyId,
            operationCode: c.operationCode,
            buyerName: c.buyerName,
            cuit: c.cuit,
            issueDate: c.issueDate,
            dueDate: c.dueDate,
            actualCollectionDate: c.actualCollectionDate,
            grossAmount: c.grossAmount,
            movementType: c.movementType,
            tentativeDeductionPercentage: c.tentativeDeductionPercentage,
            finalNetAmount: c.finalNetAmount,
            status: c.status,
            bankAccountId: c.bankAccountId,
            projectedNet,
            bankAccountName: getBankName(c.bankAccountId),
            issueDelay,
            dueDelay,
        };
    });
  }, [filteredListCollections, getBankName, holidays]);
  
  const summaryExportData = useMemo((): ExportedCollection[] | null => {
    if (!summaryResults) return null;
    return summaryResults.map((c): ExportedCollection => {
        const projectedNet = getProjectedNetAmount(c);
        const issueDelay = c.issueDate && c.actualCollectionDate ? calculateBusinessDays(c.issueDate, c.actualCollectionDate, holidays) : null;
        const dueDelay = c.dueDate && c.actualCollectionDate ? calculateBusinessDays(c.dueDate, c.actualCollectionDate, holidays) : null;
        return {
            id: c.id,
            companyId: c.companyId,
            operationCode: c.operationCode,
            buyerName: c.buyerName,
            cuit: c.cuit,
            issueDate: c.issueDate,
            dueDate: c.dueDate,
            actualCollectionDate: c.actualCollectionDate,
            grossAmount: c.grossAmount,
            movementType: c.movementType,
            tentativeDeductionPercentage: c.tentativeDeductionPercentage,
            finalNetAmount: c.finalNetAmount,
            status: c.status,
            bankAccountId: c.bankAccountId,
            projectedNet,
            bankAccountName: getBankName(c.bankAccountId),
            issueDelay,
            dueDelay,
        };
    });
  }, [summaryResults, getBankName, holidays]);

  const exportColumns: ExportColumn<ExportedCollection>[] = useMemo(() => [
    { header: 'Comprador', accessor: d => d.buyerName },
    { header: 'N° Op.', accessor: d => d.operationCode },
    { header: 'CUIT', accessor: d => d.cuit },
    { header: 'Fecha Emisión', accessor: d => d.issueDate },
    { header: 'Fecha Vto. Proy.', accessor: d => d.dueDate },
    { header: 'Fecha Cobro Real', accessor: d => d.actualCollectionDate ?? '' },
    { header: 'Monto Bruto', accessor: d => d.grossAmount },
    { header: 'Neto Cobrado', accessor: d => d.projectedNet },
    { header: 'Cuenta Acreditación', accessor: d => d.bankAccountName },
    { header: 'Estado', accessor: d => d.status },
    { header: 'Demora Emisión (días hábiles)', accessor: d => d.issueDelay !== null ? d.issueDelay : '' },
    { header: 'Demora Vto. (días hábiles)', accessor: d => d.dueDelay !== null ? d.dueDelay : '' },
  ], []);

  if (!isOpen) return null;

  const handleRestore = (collection: GrainCollection) => {
    dispatch({ type: 'UPDATE_GRAIN_COLLECTION', payload: { ...collection, status: 'matched' } });
  };
  
  const TabButton: React.FC<{ tab: typeof view, label: string }> = ({ tab, label }) => (
    <button
        onClick={() => setView(tab)}
        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
            view === tab ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
    >
        {label}
    </button>
  );

  const FilterPanel = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 border dark:border-gray-600 rounded-lg items-end">
        <div>
            <label className="text-sm">Tipo de Fecha</label>
            <select value={filters.dateType} onChange={e => setFilters(f => ({...f, dateType: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:text-gray-200">
                <option value="actualCollectionDate">Fecha de Cobro</option>
                <option value="issueDate">Fecha de Emisión</option>
                <option value="dueDate">Fecha de Vencimiento</option>
            </select>
        </div>
        <div>
            <label className="text-sm">Fecha Desde</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({...f, startDate: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:text-gray-200"/>
        </div>
        <div>
            <label className="text-sm">Fecha Hasta</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({...f, endDate: e.target.value}))} min={filters.startDate} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:text-gray-200"/>
        </div>
        <div>
            <label className="text-sm">Comprador</label>
            <select value={filters.buyer} onChange={e => setFilters(f => ({...f, buyer: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:text-gray-200">
                <option value="all">Todos</option>
                {uniqueBuyers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl m-4 animate-fade-in-down max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Archivo de Cobranzas</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100">
            <XIcon />
          </button>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
            <div className="flex items-center gap-2 mb-4 p-2 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
                <TabButton tab="list" label="Lista Detallada" />
                <TabButton tab="monthly" label="Resumen por Mes" />
                <TabButton tab="summary" label="Resumen Filtrado" />
            </div>

            {view === 'list' && (
                <>
                    {FilterPanel}
                    <div className="flex justify-end mb-4">
                        <ExportButtons data={exportData} columns={exportColumns} fileName="cobranzas_cobradas" pdfTitle="Reporte de Cobranzas Cobradas" />
                    </div>
                    {filteredListCollections.length > 0 ? (
                        <CollectedList collections={filteredListCollections} banks={banks} onRestore={handleRestore} holidays={holidays} />
                    ) : (
                        <p className="text-center text-gray-500 py-8">No hay cobranzas en el archivo que coincidan com os filtros.</p>
                    )}
                </>
            )}

            {view === 'monthly' && (
                <div>
                     <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">Resumen de Cobranzas por Mes</h3>
                     <div className="flex justify-end mb-4">
                        <ExportButtons 
                            data={monthlySummary}
                            columns={monthlyExportColumns}
                            fileName="resumen_mensual_cobranzas"
                            pdfTitle="Resumen Mensual de Cobranzas"
                        />
                     </div>
                     <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-2 text-left">Mes</th>
                                <th className="px-4 py-2 text-right">Monto Cobrado</th>
                                <th className="px-4 py-2 text-right">Cant. Operaciones</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {monthlySummary.map(({month, total, count}) => (
                                <tr key={month}>
                                    <td className="px-4 py-2 font-semibold">{new Date(month + '-02T00:00:00Z').toLocaleDateString('es-AR', {month: 'long', year: 'numeric', timeZone:'UTC'})}</td>
                                    <td className="px-4 py-2 text-right font-bold text-primary dark:text-accent-dm">{formatCurrency(total)}</td>
                                    <td className="px-4 py-2 text-right">{count}</td>
                                </tr>
                            ))}
                         </tbody>
                     </table>
                </div>
            )}

            {view === 'summary' && (
                 <div>
                     <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">Resumen de Cobranzas por Filtro</h3>
                     {FilterPanel}
                     <div className="flex justify-end">
                         <button onClick={handleGenerateSummary} className="bg-primary hover:bg-secondary text-white font-semibold py-2 px-4 rounded-md text-sm">Generar Resumen</button>
                     </div>

                     {summaryResults && (
                         <div className="mt-6 space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-blue-800 dark:text-blue-200">Total cobrado para la selección</p>
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-300 mt-1">{formatCurrency(summaryTotal)}</p>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">({summaryResults.length} operaciones)</p>
                                </div>
                                {summaryResults.length > 0 && summaryExportData && (
                                     <ExportButtons 
                                        data={summaryExportData} 
                                        columns={exportColumns} 
                                        fileName="resumen_cobranzas" 
                                        pdfTitle="Resumen de Cobranzas"
                                     />
                                )}
                            </div>
                            
                            {summaryResults.length > 50 ? (
                                <div className="p-4 bg-yellow-100 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-200 text-center rounded-lg">
                                    Se encontraron {summaryResults.length} operaciones. Por favor, descargue el archivo para ver el detalle completo.
                                </div>
                            ) : summaryResults.length > 0 ? (
                                <CollectedList collections={summaryResults} banks={banks} onRestore={handleRestore} holidays={holidays} />
                            ) : (
                                <p className="text-center text-gray-500 py-8">No se encontraron cobranzas para los filtros seleccionados.</p>
                            )}
                         </div>
                     )}
                 </div>
            )}

        </div>
        <div className="flex justify-end p-6 border-t dark:border-gray-700">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg">
            Cerrar
          </button>
        </div>
      </div>
       <style>{`
        @keyframes fade-in-down { 0% { opacity: 0; transform: translateY(-20px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default CollectedCollectionsModal;