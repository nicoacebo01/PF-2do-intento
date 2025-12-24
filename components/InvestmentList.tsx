import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { GroupedHolding, Transaction, InvestmentGroup } from '../types';
import { Currency } from '../types';
import { TrashIcon, PencilIcon, CheckBadgeIcon, FilterIcon, FilterSolidIcon } from './Icons';
import { useAppContext } from '../App';
import HelpTooltip from './HelpTooltip';
import FormattedNumberInput from './FormattedNumberInput';
import { formatPercentageForDisplay } from '../utils/formatting';

/**
 * InvestmentList.tsx: Componente principal para mostrar la lista de inversiones.
 * 
 * Responsabilidades:
 * -   Renderiza grupos de inversiones (ej: Bonos, Acciones).
 * -   Para cada grupo, muestra una cabecera con totales.
 * -   Renderiza un `HoldingRow` por cada instrumento (tenencia) dentro de un grupo.
 * -   Provee funcionalidad de filtrado de columnas para la tabla.
 */

// --- Funciones de Formateo ---

const formatNumber = (value: number) => value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatUSDWithDecimals = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safeFormatDate = (dateString: string | undefined | null) => {
  if (!dateString) return '-';
  const date = new Date(dateString + 'T00:00:00Z');
  return date.toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit' });
};

// --- Componente de Fila de Tenencia (HoldingRow) ---

/**
 * HoldingRow: Representa una única fila de instrumento en la lista de inversiones.
 * 
 * Funcionalidades:
 * -   **Expansión:** Permite expandir para ver el detalle de transacciones por broker.
 * -   **Edición de Cotización en Línea:** Permite al usuario con permisos hacer doble clic en la cotización actual para editarla y guardarla para el día de hoy.
 * -   **Acciones:** Muestra botones para editar o eliminar transacciones individuales (visibles en la vista expandida).
 */
const HoldingRow: React.FC<{
    h: GroupedHolding,
    isArchiveView?: boolean,
    canEdit: boolean,
    onStartEdit: (investmentId: string, transaction: Transaction) => void,
    onDeleteTransaction: (investmentId: string, transactionId: string) => void,
}> = ({ h, isArchiveView, canEdit, onStartEdit, onDeleteTransaction }) => {
    const { state, dispatch } = useAppContext();
    const { viewMode, companies } = state;

    // --- Estado Local ---
    const [isInstrumentExpanded, setIsInstrumentExpanded] = useState<boolean>(false);
    const [expandedBroker, setExpandedBroker] = useState<string | null>(null);
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [priceValue, setPriceValue] = useState<number | ''>('');

    const companyName = useMemo(() => {
        if (viewMode === 'consolidated') {
            return companies.find(c => c.id === h.companyId)?.name || 'N/D';
        }
        return '';
    }, [companies, h.companyId, viewMode]);

    // --- Manejadores de Eventos ---

    const toggleBroker = (brokerKey: string) => {
        setExpandedBroker(prev => (prev === brokerKey ? null : brokerKey));
    };
    
    // NOTE: Inicia el modo de edición de precio al hacer clic en el ícono.
    const handlePriceEditStart = () => {
        if (!canEdit || h.isFixedRate) return; // No se puede editar precio de instrumentos a tasa fija.
        setPriceValue(h.marketPrice);
        setIsEditingPrice(true);
    };

    // NOTE: Guarda el nuevo precio. Despacha una acción al reducer para actualizar el estado global.
    const handleSavePrice = () => {
        if (!canEdit) return;
        const newPrice = typeof priceValue === 'number' ? priceValue : 0;
        
        // Solo guarda si el precio ha cambiado significativamente para evitar escrituras innecesarias.
        if (Math.abs(newPrice - h.marketPrice) > 1e-9) {
            dispatch({
                type: 'SAVE_MARKET_PRICE',
                payload: {
                    instrumentName: h.instrumentName,
                    price: newPrice,
                }
            });
        }
        setIsEditingPrice(false);
    };

    const handlePriceKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSavePrice();
        if (e.key === 'Escape') setIsEditingPrice(false);
    };
    
    // --- Lógica de Renderizado ---

    const displayedTotalPL_USD = h.totalPL_USD + h.arbitragePL_USD;
    const displayedTEA_USD = h.tea_total_USD;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200/80 dark:border-gray-700">
            {/* Fila de Cabecera Unificada y Colapsable */}
            <div 
                className="grid grid-cols-12 gap-2 items-center p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => setIsInstrumentExpanded(p => !p)}
            >
                {viewMode === 'consolidated' && (
                    <div className="col-span-2 font-semibold text-gray-800 dark:text-gray-200">
                        {companyName}
                    </div>
                )}
                <div className={viewMode === 'consolidated' ? 'col-span-2' : 'col-span-2'}>
                    <h4 className="font-bold text-primary dark:text-accent-dm flex items-center gap-2">
                        {h.isFixedRate && <span title="Colocación a Tasa Fija"><CheckBadgeIcon /></span>}
                        {h.instrumentName.toUpperCase()}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{h.currency}</p>
                </div>
                <div className="text-center font-semibold text-gray-800 dark:text-gray-200">{h.maturityDate ? safeFormatDate(h.maturityDate) : 'LIQUIDA'}</div>
                
                {/* Columna de Cotización Actual (Editable) */}
                <div className="text-right font-semibold text-gray-700 dark:text-gray-300">
                    {isEditingPrice ? (
                        <FormattedNumberInput
                          value={priceValue}
                          onChange={setPriceValue}
                          onBlur={handleSavePrice}
                          onKeyDown={handlePriceKeyDown}
                          autoFocus
                          className="text-right w-full py-1"
                        />
                      ) : (
                        <div 
                          className="group flex items-center justify-end gap-2 p-1 rounded"
                          title={canEdit && !h.isFixedRate ? "Click en el lápiz para editar la cotización de hoy" : h.isFixedRate ? "No se edita cotización para Tasa Fija" : "Sin permisos de edición"}
                        >
                          <span>{h.isFixedRate ? '-' : formatNumber(h.marketPrice)}</span>
                          {canEdit && !h.isFixedRate && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePriceEditStart();
                              }}
                              className="text-blue-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              aria-label="Editar cotización"
                            >
                              <PencilIcon />
                            </button>
                          )}
                        </div>
                      )}
                </div>

                <div className={`${viewMode === 'consolidated' ? 'col-span-1' : 'col-span-2'} text-right font-semibold text-gray-800 dark:text-gray-200`}>{formatUSDWithDecimals(h.marketValueUSD)}</div>
                <div className={`col-span-1 text-right font-bold ${h.totalPL_USD >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-500'}`}>{formatUSDWithDecimals(h.totalPL_USD)}</div>
                <div className={`text-right font-bold ${h.tea_USD >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-500'}`}>{formatPercentageForDisplay(h.tea_USD)}</div>
                <div className={`${viewMode === 'consolidated' ? 'col-span-1' : 'col-span-2'} text-right font-bold ${displayedTotalPL_USD >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-500'}`}>{formatUSDWithDecimals(displayedTotalPL_USD)}</div>
                <div className={`text-right font-bold ${displayedTEA_USD >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-500'}`}>{formatPercentageForDisplay(displayedTEA_USD)}</div>
                <div className="text-center font-mono text-primary dark:text-accent-dm">{isInstrumentExpanded ? '[-]' : '[+]'}</div>
            </div>
            
            {/* Contenido Expandido: Detalle de Transacciones */}
            {isInstrumentExpanded && (
                <div className="bg-gray-50/70 dark:bg-gray-900/30 p-4 border-t border-gray-200 dark:border-gray-700">
                     {/* Lista de Brokers */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                        {h.brokerDetails.map(bd => {
                            const counterpartyName = bd.brokerName || bd.bankName || 'N/D';
                            const brokerKey = `${h.instrumentName}-${bd.brokerId || bd.bankId}`;
                            const isBrokerExpanded = expandedBroker === brokerKey;
                            return (
                            <div key={brokerKey} className="border-b last:border-b-0 dark:border-gray-700">
                                <div className="flex justify-between items-center p-3 pl-6 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50" onClick={(e) => { e.stopPropagation(); toggleBroker(brokerKey); }}>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-primary dark:text-accent-dm w-6 text-center">{isBrokerExpanded ? '[-]' : '[+]'}</span>
                                        <span className="font-semibold text-gray-800 dark:text-gray-200">{counterpartyName}</span>
                                    </div>
                                    <div className="text-sm text-right">
                                        <span className="font-semibold">{formatNumber(bd.totalQuantity)}</span> Nom.
                                    </div>
                                </div>
                                {isBrokerExpanded && (
                                    <div className="p-4 pl-12 bg-white dark:bg-gray-800">
                                        <div className="overflow-auto max-h-64">
                                            <table className="min-w-full text-sm">
                                                <thead className="text-xs text-gray-600 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700 sticky top-0">
                                                    <tr>
                                                        <th className="py-2 px-3 text-left">Fecha</th>
                                                        <th className="py-2 px-3 text-left">Tipo</th>
                                                        <th className="py-2 px-3 text-right">Cantidad</th>
                                                        <th className="py-2 px-3 text-right">Precio Op.</th>
                                                        <th className="py-2 px-3 text-right">Total ({h.currency})</th>
                                                        <th className="py-2 px-3 text-right">Total (USD)</th>
                                                        <th className="py-2 px-3 text-center">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                    {bd.transactions.map(t => {
                                                        const total = t.quantity * t.price;
                                                        const totalUSD = h.currency === Currency.USD ? total : (t.exchangeRate > 0 ? total / t.exchangeRate : 0);
                                                        return (
                                                            <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-300">{new Date(t.date).toLocaleDateString('es-AR', {timeZone: 'UTC'})}</td>
                                                                <td className={`py-2 px-3 font-semibold ${t.type === 'Compra' ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{t.type}</td>
                                                                <td className="py-2 px-3 text-right font-medium text-gray-700 dark:text-gray-300">{formatNumber(t.quantity)}</td>
                                                                <td className="py-2 px-3 text-right font-medium text-gray-700 dark:text-gray-300">{formatNumber(t.price)}</td>
                                                                <td className="py-2 px-3 text-right font-medium text-gray-700 dark:text-gray-300">{total.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                                <td className="py-2 px-3 text-right font-medium text-gray-700 dark:text-gray-300">{totalUSD.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                                <td className="py-2 px-3 text-center">
                                                                    {viewMode === 'individual' && canEdit && (
                                                                        <div className="flex items-center justify-center gap-3">
                                                                            <button onClick={() => onStartEdit(h.instrumentId, t)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                                                            <button onClick={() => onDeleteTransaction(h.instrumentId, t.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
};

// FIX: Define InvestmentListProps interface to resolve type error.
interface InvestmentListProps {
  groups: InvestmentGroup[];
  isArchiveView?: boolean;
  onStartEdit: (investmentId: string, transaction: Transaction) => void;
  onDeleteTransaction: (investmentId: string, transactionId: string) => void;
}

const InvestmentList: React.FC<InvestmentListProps> = (props) => {
    const { groups, isArchiveView = false } = props;
    const { state } = useAppContext();
    const { currentUser, viewMode } = state;
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [openFilter, setOpenFilter] = useState<string | null>(null);
    const filterPopoverRef = useRef<HTMLDivElement>(null);

     const canEdit = useMemo(() => {
        if (!currentUser) return false;
        if (viewMode === 'consolidated') return false;
        const permission = currentUser.permissions.investment;
        return permission === 'admin' || permission === 'operator';
    }, [currentUser, viewMode]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
                setOpenFilter(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const allHoldings = useMemo(() => groups.flatMap(g => g.holdings), [groups]);

    const columnDefinitions = useMemo(() => ({
        instrument: { header: 'Instrumento', accessor: (h: GroupedHolding) => h.instrumentName.toUpperCase() },
        maturity: { header: 'Vto.', accessor: (h: GroupedHolding) => h.maturityDate ? safeFormatDate(h.maturityDate) : 'LIQUIDA' },
        marketValue: { header: 'Valor Mercado (USD)', accessor: (h: GroupedHolding) => formatUSDWithDecimals(h.marketValueUSD) },
        plInst: { header: 'G/P Inst.', accessor: (h: GroupedHolding) => formatUSDWithDecimals(h.totalPL_USD) },
        teaInst: { header: 'TEA Inst.', accessor: (h: GroupedHolding) => formatPercentageForDisplay(h.tea_USD) },
        plTotal: { header: 'G/P Total', accessor: (h: GroupedHolding) => formatUSDWithDecimals(h.totalPL_USD + h.arbitragePL_USD) },
        teaTotal: { header: 'TEA Total', accessor: (h: GroupedHolding) => formatPercentageForDisplay(h.tea_total_USD) },
    }), []);
    
    const FilterPopover: React.FC<{ columnKey: string; onApply: (key: string, values: string[]) => void; }> = ({ columnKey, onApply }) => {
        const colDef = (columnDefinitions as any)[columnKey];
        const allValues = useMemo(() => [...new Set(allHoldings.map(h => String(colDef.accessor(h))))].sort(), [allHoldings, colDef]);
        const [selected, setSelected] = useState(new Set(columnFilters[columnKey] || []));
        
        const handleToggle = (value: string) => setSelected(prev => { const newSet = new Set(prev); if (newSet.has(value)) newSet.delete(value); else newSet.add(value); return newSet; });
        const handleApply = () => { onApply(columnKey, Array.from(selected)); setOpenFilter(null); };

        return (
            <div className="w-64 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-xl p-3 space-y-2 text-gray-800 dark:text-gray-200" onClick={e => e.stopPropagation()}>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 text-sm">
                    {allValues.map(value => (
                        <div key={value} className="flex items-center gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                            <input type="checkbox" checked={selected.has(value)} onChange={() => handleToggle(value)} id={`filter-opt-${columnKey}-${value}`} className="h-4 w-4 rounded border-gray-300 text-primary"/>
                            <label htmlFor={`filter-opt-${columnKey}-${value}`} className="truncate flex-1 cursor-pointer">{value}</label>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setOpenFilter(null)} className="text-sm px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded">Cancelar</button>
                    <button onClick={handleApply} className="text-sm px-3 py-1 bg-primary text-white rounded">Aplicar</button>
                </div>
            </div>
        );
    };

    const TableHeader: React.FC<{columnKey: string; title: string; colSpan?: number; alignment?: string;}> = ({ columnKey, title, colSpan, alignment = 'left' }) => {
        const isFilterActive = columnFilters[columnKey] && columnFilters[columnKey].length > 0;
        const colSpanClass = colSpan ? `col-span-${colSpan}` : '';
        const alignmentClass = `text-${alignment}`;

        return (
            <div className={`${colSpanClass} ${alignmentClass}`}>
                 <div className={`relative flex items-center justify-${alignment === 'left' ? 'between' : alignment === 'right' ? 'end' : 'center'} gap-2`}>
                    <span>{title}</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); setOpenFilter(prev => prev === columnKey ? null : columnKey)}}
                        className={`p-1 rounded transition-colors ${isFilterActive ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
                        aria-label={`Filtrar por ${title}`}
                    >
                        {isFilterActive ? <FilterSolidIcon /> : <FilterIcon />}
                    </button>
                    {openFilter === columnKey && (
                        <div ref={filterPopoverRef} className="absolute top-full z-20 mt-2" style={alignment === 'right' ? { right: 0 } : { left: 0 }}>
                            <FilterPopover columnKey={columnKey} onApply={(key, values) => setColumnFilters(prev => ({...prev, [key]: values}))} />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (groups.length === 0) {
        const message = isArchiveView ? "No hay inversiones vencidas." : "No hay transacciones de inversión registradas.";
        return <div className="text-center p-8 text-gray-500 dark:text-gray-400">{message}</div>;
    }

    return (
        <div className="space-y-8">
            {groups.map(group => {
                const filteredHoldings = group.holdings.filter(h => {
                    return Object.entries(columnFilters).every(([key, values]) => {
                        if ((values as string[]).length === 0) return true;
                        const colDef = (columnDefinitions as any)[key];
                        if (!colDef) return true;
                        const value = String(colDef.accessor(h));
                        return (values as string[]).includes(value);
                    });
                });

                if (filteredHoldings.length === 0) return null;

                const groupTotalPL = filteredHoldings.reduce((sum, h) => sum + h.totalPL_USD + h.arbitragePL_USD, 0);
                const groupMarketValue = filteredHoldings.reduce((sum, h) => sum + h.marketValueUSD, 0);

                return (
                     <div key={group.groupName}>
                        <div className="flex justify-between items-baseline mb-3 pb-2 border-b-2 border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">{group.groupName}</h2>
                             <div className="text-right">
                               <span className="font-semibold text-gray-600 dark:text-gray-400">Valor de Mercado: {formatUSD(groupMarketValue)}</span>
                               <span className={`font-semibold ml-4 ${groupTotalPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-500'}`}>G/P Total: {formatUSDWithDecimals(groupTotalPL)}</span>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 px-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                                {viewMode === 'consolidated' && <div className="col-span-2 font-semibold">Empresa</div>}
                                <TableHeader columnKey="instrument" title="Instrumento" colSpan={2} />
                                <TableHeader columnKey="maturity" title="Vto." alignment="center"/>
                                <div className="text-right">Cot. Actual</div>
                                <TableHeader columnKey="marketValue" title="Valor Mercado (USD)" colSpan={viewMode === 'consolidated' ? 1 : 2} alignment="right" />
                                <div className="col-span-1 text-right flex items-center justify-end gap-1">G/P Inst. (USD) <HelpTooltip text="Representa la Ganancia o Pérdida generada únicamente por la variación de precio del instrumento (plusvalía). No incluye el resultado de las coberturas de tipo de cambio asociadas." /></div>
                                <div className="text-right flex items-center justify-end gap-1">TEA Inst. (%) <HelpTooltip text="Es el rendimiento anualizado (Tasa Efectiva Anual) generado únicamente por la inversión, basado en el capital promedio invertido en el tiempo. No incluye el impacto de las coberturas." /></div>
                                <div className={`${viewMode === 'consolidated' ? 'col-span-1' : 'col-span-2'} text-right flex items-center justify-end gap-1`}>G/P Total (USD) <HelpTooltip text="Es la Ganancia o Pérdida final de la estrategia, sumando el resultado del instrumento más el resultado de sus coberturas de tipo de cambio (arbitrajes)." /></div>
                                <div className="text-right flex items-center justify-end gap-1">TEA Total (%) <HelpTooltip text="Es el rendimiento anualizado (Tasa Efectiva Anual) de la estrategia completa, incluyendo tanto el resultado del instrumento como el de sus coberturas." /></div>
                                <div className="text-center"></div>
                            </div>
                            {filteredHoldings.map((h, index) => (
                                <HoldingRow 
                                    key={`${h.instrumentName}-${index}`} 
                                    h={h}
                                    canEdit={canEdit}
                                    onStartEdit={props.onStartEdit}
                                    onDeleteTransaction={props.onDeleteTransaction}
                                    isArchiveView={props.isArchiveView}
                                />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

export default InvestmentList;