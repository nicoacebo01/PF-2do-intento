import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Debt } from '../types';
import { Currency } from '../types';
import { useAppContext } from '../App';
import * as api from '../services/api';
import { useFinancialCalculations } from '../utils/calculations';
import { PencilIcon, TrashIcon, EyeIcon, CheckBadgeIcon, XIcon, FilterIcon, FilterSolidIcon, ChevronUpIcon, ChevronDownIcon } from './Icons';
import DebtDetailModal from './DebtDetailModal';
import { getTodayArgentinaDate, calculateFinancialsForDate } from '../utils/financials';
import FormattedNumberInput from './FormattedNumberInput';
import { formatPercentageForDisplay } from '../utils/formatting';

const safeFormatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-';
    // Dates are YYYY-MM-DD and should be treated as UTC to avoid timezone issues.
    const date = new Date(dateString + 'T00:00:00Z');
    return date.toLocaleDateString('es-AR', { timeZone: 'UTC' });
};

const CancellationModal: React.FC<{
    debt: Debt,
    onClose: () => void,
    onConfirm: (debtId: string, cancellationDate: string, paidInterest: number | '', penalty: number | '') => void,
}> = ({ debt, onClose, onConfirm }) => {
    const { state } = useAppContext();
    const todayStr = useMemo(() => getTodayArgentinaDate().toISOString().split('T')[0], []);
    const [cancellationDate, setCancellationDate] = useState(todayStr);
    const [paidInterest, setPaidInterest] = useState<number | ''>('');
    const [penalty, setPenalty] = useState<number | ''>('');
    const [isLoading, setIsLoading] = useState(false);

    const suggestedInterest = useMemo(() => {
        if (!cancellationDate) return 0;
        const financials = calculateFinancialsForDate(debt, new Date(cancellationDate + 'T00:00:00Z'), state.appSettings);
        return financials.totalInterest;
    }, [cancellationDate, debt, state.appSettings]);

    const handleConfirm = () => {
        if (!cancellationDate) {
            alert('Por favor, seleccione una fecha de cancelación.');
            return;
        }

        if (cancellationDate > todayStr) {
            alert('La fecha real de cancelación no puede ser posterior al día de hoy.');
            return;
        }
        
        if (cancellationDate !== debt.dueDate) {
            if (debt.punitiveInterestRate === undefined || debt.punitiveInterestRate === null) {
                alert('La fecha real de cancelación difiere de la fecha de vencimiento. Por favor, edite la deuda y especifique una Tasa de Interés Moratoria (puede ser 0%) antes de cancelarla.');
                return;
            }
        }
        setIsLoading(true);
        onConfirm(debt.id, cancellationDate, paidInterest, penalty);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md m-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Confirmar Cancelación</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
                </div>
                <div className="space-y-4">
                    <p>Está a punto de marcar la deuda <span className="font-semibold">{debt.type}</span> como cancelada.</p>
                    <div>
                        <label htmlFor="cancellation-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Real de Cancelación</label>
                        <input
                            type="date"
                            id="cancellation-date"
                            value={cancellationDate}
                            onChange={(e) => setCancellationDate(e.target.value)}
                            max={todayStr}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="paid-interest" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Intereses Pagados (Opcional)</label>
                         <FormattedNumberInput
                            id="paid-interest"
                            value={paidInterest}
                            onChange={setPaidInterest}
                            placeholder={`Calculado: ${suggestedInterest.toLocaleString('es-AR', {minimumFractionDigits: 2})}`}
                            className="mt-1"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Deje en blanco para usar el interés calculado automáticamente.</p>
                    </div>
                     <div>
                        <label htmlFor="penalty" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Costo/Penalidad por Cancelación (Opcional)</label>
                        <FormattedNumberInput
                            id="penalty"
                            value={penalty}
                            onChange={setPenalty}
                            placeholder="Ej: 50000"
                            className="mt-1"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 mt-4 border-t dark:border-gray-700">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button onClick={handleConfirm} disabled={isLoading} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400">
                        {isLoading ? 'Confirmando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
};


interface DebtListProps {
  debts: Debt[];
  isArchiveView?: boolean;
}

type SortDirection = 'ascending' | 'descending';
interface SortConfig {
  key: string | null;
  direction: SortDirection;
}

const DebtList: React.FC<DebtListProps> = ({ debts, isArchiveView = false }) => {
  const { state, dispatch } = useAppContext();
  const { viewMode, currentUser, companies } = state;
  const { banks, brokers, companyDebtCalculations } = useFinancialCalculations();

  const [debtToView, setDebtToView] = useState<Debt | null>(null);
  const [cancellingDebt, setCancellingDebt] = useState<Debt | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    key: 'date', 
    direction: isArchiveView ? 'descending' : 'ascending' 
  });
  
  const today = useMemo(() => getTodayArgentinaDate(), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canEdit = useMemo(() => {
    if (!currentUser) return false;
    const debtPermission = currentUser.permissions.debt;
    return debtPermission === 'admin' || debtPermission === 'operator';
  }, [currentUser]);

  const getCompanyName = useCallback((debt: Debt) => {
    return companies.find(c => c.id === debt.companyId)?.name || 'N/D';
  }, [companies]);

  const getCounterpartyName = useCallback((debt: Debt) => {
    if (debt.bankId) return banks.find(b => b.id === debt.bankId)?.name || 'N/D';
    if (debt.brokerId) return brokers.find(b => b.id === debt.brokerId)?.name || 'N/D';
    return 'N/A';
  }, [banks, brokers]);

  const onStartEdit = (debt: Debt) => {
    dispatch({ type: 'OPEN_DEBT_FORM', payload: debt });
  };

  const onDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta deuda?')) {
      try {
        await api.deleteDebt(id);
        dispatch({ type: 'DELETE_DEBT_SUCCESS', payload: id });
      } catch (error) {
          alert('No se pudo eliminar la deuda.');
      }
    }
  };
  
  const handleConfirmCancellation = async (debtId: string, cancellationDate: string, paidInterest: number | '', penalty: number | '') => {
    try {
        const updatedDebt = await api.markDebtAsCancelled({ debtId, cancellationDate, paidInterest, penalty });
        dispatch({ type: 'MARK_DEBT_AS_CANCELLED_SUCCESS', payload: updatedDebt });
        setCancellingDebt(null);
    } catch (error) {
        alert('No se pudo cancelar la deuda.');
    }
  };

  const getCftDisplay = useCallback((debt: Debt) => {
    const calcs = companyDebtCalculations.get(debt.id);
    if (!calcs) return null;
    return calcs.financials.cft;
  }, [companyDebtCalculations]);

  const getUsdCftDisplay = useCallback((debt: Debt) => {
    const calcs = companyDebtCalculations.get(debt.id);
    if (!calcs) return null;
    if (debt.currency === Currency.USD) {
      return calcs.financials.cft;
    }
    return calcs.usdAnalysis?.usd_cft; // will be null if no analysis
  }, [companyDebtCalculations]);

  const columnDefinitions = useMemo(() => {
    const definitions: { [key: string]: any } = {
        type: { header: 'Tipo', accessor: (d: Debt) => d.type },
        counterparty: { header: 'Contraparte', accessor: (d: Debt) => getCounterpartyName(d) },
        amount: { header: 'Monto', accessor: (d: Debt) => d.amount, render: (d: Debt) => `${d.currency} ${d.amount.toLocaleString('es-AR')}` },
        date: { header: isArchiveView ? 'Cancelación' : 'Vencimiento', accessor: (d: Debt) => isArchiveView ? d.actualCancellationDate || d.dueDate : d.dueDate, render: (d: Debt) => safeFormatDate(isArchiveView ? d.actualCancellationDate || d.dueDate : d.dueDate) },
        cftNative: { header: 'CFT (Moneda)', accessor: (d: Debt) => getCftDisplay(d) ?? -Infinity, render: (d: Debt) => formatPercentageForDisplay(getCftDisplay(d))},
        cftUsd: { header: 'CFT (USD)', accessor: (d: Debt) => getUsdCftDisplay(d) ?? -Infinity, render: (d: Debt) => formatPercentageForDisplay(getUsdCftDisplay(d))},
        actions: { header: 'Acciones', accessor: () => '' },
    };
    if (viewMode === 'consolidated') {
        definitions.company = { header: 'Empresa', accessor: (d: Debt) => getCompanyName(d) };
    }
    return definitions;
  }, [isArchiveView, getCounterpartyName, getCftDisplay, getUsdCftDisplay, viewMode, getCompanyName, companies]);

  const sortedDebts = useMemo(() => {
    let sortableItems = [...debts];
    if (sortConfig.key) {
        sortableItems.sort((a, b) => {
            const aValue = (columnDefinitions as any)[sortConfig.key!].accessor(a);
            const bValue = (columnDefinitions as any)[sortConfig.key!].accessor(b);

            if (aValue === null || aValue === undefined || aValue === -Infinity) return 1;
            if (bValue === null || bValue === undefined || bValue === -Infinity) return -1;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }
    return sortableItems;
  }, [debts, sortConfig, columnDefinitions]);
  
  const filteredDebts = useMemo(() => {
    if (Object.keys(columnFilters).every(key => !columnFilters[key] || (columnFilters[key] as string[]).length === 0)) {
        return sortedDebts;
    }
    return sortedDebts.filter(debt => {
        return Object.entries(columnFilters).every(([key, values]) => {
            if ((values as string[]).length === 0) return true;
            const colDef = (columnDefinitions as any)[key];
            if (!colDef || !colDef.accessor) return true;
            const valueToFilter = String((columnDefinitions as any)[key].accessor(debt));
            return (values as string[]).includes(valueToFilter);
        });
    });
  }, [sortedDebts, columnFilters, columnDefinitions]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const FilterPopover: React.FC<{ columnKey: string; onApply: (columnKey: string, values: string[]) => void; }> = ({ columnKey, onApply }) => {
    const colDef = (columnDefinitions as any)[columnKey];
    const allValues = useMemo(() => {
        const values = debts.map(op => String(colDef.accessor(op)));
        return [...new Set(values)].sort();
    }, [debts, colDef]);
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
  
  const ThWithSortingAndFiltering: React.FC<{columnKey: string; className?: string}> = ({columnKey, className = ""}) => {
      const { header } = (columnDefinitions as any)[columnKey];
      const isFilterActive = columnFilters[columnKey] && columnFilters[columnKey].length > 0;
      return (
          <th className={`py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 group ${className}`}>
              <div className="flex items-center gap-1 justify-between">
                   <div onClick={() => requestSort(columnKey)} className="flex items-center gap-2 cursor-pointer flex-grow">
                        <span>{header}</span>
                         <div className="w-4 h-4 flex items-center justify-center">
                          {sortConfig.key === columnKey ? (
                            sortConfig.direction === 'ascending' ? <ChevronUpIcon /> : <ChevronDownIcon />
                          ) : (
                            <ChevronUpIcon className="text-gray-400 opacity-0 group-hover:opacity-50 transition-opacity" />
                          )}
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
                       {openFilter === columnKey && (
                          <div ref={filterPopoverRef} className="absolute top-full z-20 mt-2 right-0">
                              <FilterPopover columnKey={columnKey} onApply={(key, values) => setColumnFilters(prev => ({...prev, [key]: values}))} />
                          </div>
                      )}
                  </div>
              </div>
          </th>
      );
  };

  if (debts.length === 0 && Object.keys(columnFilters).every(k => !(columnFilters[k]?.length))) {
    return <div className="text-center p-8 text-gray-500 dark:text-gray-400">{isArchiveView ? "No hay deudas en el archivo." : "No hay deudas activas."}</div>;
  }
  
  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 max-h-[70vh] overflow-y-auto">
        <table className="min-w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 z-10">
                <tr>
                    {viewMode === 'consolidated' && <ThWithSortingAndFiltering columnKey="company" />}
                    <ThWithSortingAndFiltering columnKey="type" />
                    <ThWithSortingAndFiltering columnKey="counterparty" />
                    <ThWithSortingAndFiltering columnKey="amount" className="text-right" />
                    <ThWithSortingAndFiltering columnKey="date" className="text-center" />
                    <ThWithSortingAndFiltering columnKey="cftNative" className="text-center" />
                    <ThWithSortingAndFiltering columnKey="cftUsd" className="text-center" />
                    <th className="py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 text-center">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDebts.map(debt => {
                    const isOverdue = !isArchiveView && new Date(debt.dueDate + 'T00:00:00Z') < today;
                    const cftNativeDisplay = getCftDisplay(debt);
                    const cftUsdDisplay = getUsdCftDisplay(debt);
                    return (
                        <tr key={debt.id} className={`${isOverdue ? 'bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-200 dark:hover:bg-yellow-900/60' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                            {viewMode === 'consolidated' && <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200">{getCompanyName(debt)}</td>}
                            <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200">{debt.type}</td>
                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{getCounterpartyName(debt)}</td>
                            <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200 text-right">{columnDefinitions.amount.render(debt)}</td>
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200 text-center">{columnDefinitions.date.render(debt)}</td>
                            <td className="py-2 px-3 font-semibold text-blue-600 dark:text-blue-400 text-center">{formatPercentageForDisplay(cftNativeDisplay)}</td>
                            <td className="py-2 px-3 font-semibold text-green-600 dark:text-green-400 text-center">{formatPercentageForDisplay(cftUsdDisplay)}</td>
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-center gap-3">
                                <button onClick={() => setDebtToView(debt)} className="text-gray-500 hover:text-gray-800" title="Ver Detalles"><EyeIcon /></button>
                                {viewMode === 'individual' && canEdit && (
                                  <>
                                    {!isArchiveView && (<button onClick={() => setCancellingDebt(debt)} className="text-green-600 hover:text-green-800" title="Marcar como Cancelada"><CheckBadgeIcon /></button>)}
                                    <button onClick={() => onStartEdit(debt)} className="text-blue-600 hover:text-blue-800" title="Editar"><PencilIcon /></button>
                                    <button onClick={() => onDelete(debt.id)} className="text-red-600 hover:text-red-800" title="Eliminar"><TrashIcon /></button>
                                  </>
                                )}
                              </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {filteredDebts.length === 0 && (
            <div className="text-center p-8 text-gray-500 dark:text-gray-400">No hay deudas que coincidan con los filtros aplicados.</div>
        )}
      </div>
      {debtToView && (<DebtDetailModal debt={debtToView} banks={banks} brokers={brokers} debtTypes={state.debtTypes} currencies={state.currencies} onClose={() => setDebtToView(null)}/>)}
      {cancellingDebt && (<CancellationModal debt={cancellingDebt} onClose={() => setCancellingDebt(null)} onConfirm={handleConfirmCancellation}/>)}
    </>
  );
};

export default DebtList;