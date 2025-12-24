import React, { useState, useMemo, useCallback } from 'react';
import type { Investment, Transaction, GroupedHolding, InvestmentGroup, MultiSelectOption } from '../types';
import { Currency } from '../types';
import InvestmentList from './InvestmentList';
import InvestmentForm from './InvestmentForm';
import { PlusCircleIcon, SparklesIcon, XCircleIcon, FilterIcon, ArrowUturnLeftIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';
import ExpiredInvestmentsModal from './ExpiredInvestmentsModal';
import InvestmentSummaryTable from './InvestmentSummaryTable';
import { daysBetween, getInterpolatedRate, getTodayArgentinaDate } from '../utils/financials';
import AIQueryAssistantModal from './AIQueryAssistantModal';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { useAppContext } from '../App';
import * as api from '../services/api';
import { useFinancialCalculations } from '../utils/calculations';
import MultiSelectDropdown from './MultiSelectDropdown';
import { formatNumberForExport, formatPercentageForExport } from '../utils/formatting';

type InstrumentData = Omit<Investment, 'id' | 'companyId' | 'transactions'>;

const initialAdvancedFilters = {
    investmentType: [] as string[],
    counterparty: [] as string[],
    currency: [] as string[],
    searchTerm: '',
};

const InvestmentModule: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, selectedCompanyId } = state;
    const { 
        companyInvestments, viewMode, investments,
        investmentTypes, brokers, banks, exchangeRates, marketPriceHistory,
        appSettings, arbitrageOperations, latestRate, latestFutureSnapshot,
        investmentGroups, expiredHoldings, currentMarketPrices, companies
    } = useFinancialCalculations();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingData, setEditingData] = useState<{ investmentId: string; transaction: Transaction } | null>(null);
    const [isExpiredModalOpen, setIsExpiredModalOpen] = useState(false);
    const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState(initialAdvancedFilters);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);

    const canEdit = useMemo(() => {
        if (!currentUser) return false;
        const permission = currentUser.permissions.investment;
        return permission === 'admin' || permission === 'operator';
    }, [currentUser]);

    const { investmentSummaryData, totalInvestmentValueUSD } = useMemo(() => {
        if (!investmentGroups) return { investmentSummaryData: [], totalInvestmentValueUSD: 0 };
        const allHoldings = investmentGroups.flatMap(g => g.holdings);
        const sortedHoldings = allHoldings.sort((a, b) => {
            const aIsLiquid = !a.maturityDate;
            const bIsLiquid = !b.maturityDate;
            if (aIsLiquid && !bIsLiquid) return -1;
            if (!aIsLiquid && bIsLiquid) return 1;
            if (!aIsLiquid && !bIsLiquid) {
                if (a.maturityDate! < b.maturityDate!) return -1;
                if (a.maturityDate! > b.maturityDate!) return 1;
            }
            return a.instrumentName.localeCompare(b.instrumentName);
        });
        const total = sortedHoldings.reduce((sum, holding) => sum + holding.marketValueUSD, 0);
        return { investmentSummaryData: sortedHoldings, totalInvestmentValueUSD: total };
    }, [investmentGroups]);

    const filteredInvestmentGroups = useMemo(() => {
        const hasAdvancedFilters =
            advancedFilters.investmentType.length > 0 ||
            advancedFilters.counterparty.length > 0 ||
            advancedFilters.currency.length > 0 ||
            advancedFilters.searchTerm.trim() !== '';

        if (!hasAdvancedFilters) return investmentGroups;

        const { investmentType, counterparty, currency, searchTerm } = advancedFilters;
        const lowerSearchTerm = searchTerm.toLowerCase();

        return investmentGroups.map(group => {
            const filteredHoldings = group.holdings.filter(holding => {
                const typeMatch = investmentType.length === 0 || investmentType.includes(holding.investmentTypeId);
                const currencyMatch = currency.length === 0 || currency.includes(holding.currency);
                
                const counterpartyMatch = counterparty.length === 0 || holding.brokerDetails.some(bd => {
                    const brokerCounterpartyId = bd.brokerId ? `broker-${bd.brokerId}` : null;
                    const bankCounterpartyId = bd.bankId ? `bank-${bd.bankId}` : null;
                    return (brokerCounterpartyId && counterparty.includes(brokerCounterpartyId)) || 
                           (bankCounterpartyId && counterparty.includes(bankCounterpartyId));
                });

                const searchMatch = !lowerSearchTerm || holding.instrumentName.toLowerCase().includes(lowerSearchTerm);

                return typeMatch && currencyMatch && counterpartyMatch && searchMatch;
            });
            
            return { ...group, holdings: filteredHoldings };
        }).filter(group => group.holdings.length > 0);
        
    }, [investmentGroups, advancedFilters]);

    const handleStartEdit = useCallback((investmentId: string, transaction: Transaction) => {
        setEditingData({ investmentId, transaction });
        setIsFormOpen(true);
    }, []);

    const handleDelete = useCallback(async (investmentId: string, transactionId: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar esta transacción?')) {
            try {
                const updatedInvestments = await api.deleteTransaction(investmentId, transactionId);
                dispatch({ type: 'DELETE_TRANSACTION_SUCCESS', payload: updatedInvestments });
            } catch (error) {
                alert('No se pudo eliminar la transacción.');
            }
        }
    }, [dispatch]);
    
    const handleSave = useCallback(async (transactionData: Omit<Transaction, 'id'>, instrumentData: InstrumentData, transactionId?: string) => {
        try {
            const { updatedInvestments, updatedArbitrageOps } = await api.saveTransaction(transactionData, instrumentData, transactionId, selectedCompanyId);
            dispatch({ type: 'SAVE_TRANSACTION_SUCCESS', payload: { updatedInvestments, updatedArbitrageOps } });
            setIsFormOpen(false);
            setEditingData(null);
        } catch (error) {
            alert('No se pudo guardar la transacción.');
        }
    }, [dispatch, selectedCompanyId]);

    const handleOpenMarketPrices = () => dispatch({ type: 'SET_STATE', payload: { activeView: 'settings' } });

    const exportData = useMemo(() => {
        return investmentGroups.flatMap(g => g.holdings).map(h => {
            const marketValueARS = h.currency === Currency.ARS ? h.marketValue : h.marketValueUSD * latestRate;
            const data: any = {
                'Instrumento': h.instrumentName, 'Tipo': h.investmentTypeName, 'Moneda': h.currency,
                'Tenencia': formatNumberForExport(h.totalQuantity),
                'Valor de Mercado (Moneda Nativa)': formatNumberForExport(h.marketValue),
                'Valor de Mercado (USD)': formatNumberForExport(h.marketValueUSD),
                'Valor de Mercado (ARS)': formatNumberForExport(marketValueARS),
                'G/P Instrumento (USD)': formatNumberForExport(h.totalPL_USD),
                'TEA Instrumento (%)': formatPercentageForExport(h.tea_USD),
                'G/P Total (USD)': formatNumberForExport(h.totalPL_USD + h.arbitragePL_USD),
                'TEA Total (%)': formatPercentageForExport(h.tea_total_USD),
            };
            if (viewMode === 'consolidated') {
                data['Empresa'] = companies.find((c: any) => c.id === h.companyId)?.name || 'N/D';
            }
            return data;
        });
    }, [investmentGroups, latestRate, viewMode, companies]);

    const exportColumns: ExportColumn<any>[] = useMemo(() => {
        const columns: ExportColumn<any>[] = [
            { header: 'Instrumento', accessor: d => d['Instrumento'] }, { header: 'Tipo', accessor: d => d['Tipo'] }, { header: 'Moneda', accessor: d => d['Moneda'] },
            { header: 'Tenencia', accessor: d => d['Tenencia'] }, { header: 'Valor de Mercado (Moneda Nativa)', accessor: d => d['Valor de Mercado (Moneda Nativa)'] },
            { header: 'Valor de Mercado (USD)', accessor: d => d['Valor de Mercado (USD)'] }, { header: 'Valor de Mercado (ARS)', accessor: d => d['Valor de Mercado (ARS)'] },
            { header: 'G/P Instrumento (USD)', accessor: d => d['G/P Instrumento (USD)'] }, { header: 'TEA Instrumento (%)', accessor: d => d['TEA Instrumento (%)'] },
            { header: 'G/P Total (USD)', accessor: d => d['G/P Total (USD)'] }, { header: 'TEA Total (%)', accessor: d => d['TEA Total (%)'] },
        ];
        if (viewMode === 'consolidated') {
            columns.unshift({ header: 'Empresa', accessor: d => d['Empresa'] });
        }
        return columns;
    }, [viewMode]);
    
    const handleFilterChange = (filterName: keyof typeof advancedFilters, value: any) => {
        setAdvancedFilters(prev => ({ ...prev, [filterName]: value }));
    };
    const investmentTypeOptions: MultiSelectOption[] = useMemo(() => investmentTypes.map(it => ({ value: it.id, label: it.name })), [investmentTypes]);
    const counterpartyOptions: MultiSelectOption[] = useMemo(() => [
        ...banks.map(b => ({ value: `bank-${b.id}`, label: b.name })),
        ...brokers.map(b => ({ value: `broker-${b.id}`, label: b.name }))
    ].sort((a,b) => a.label.localeCompare(b.label)), [banks, brokers]);
    const currencyOptions: MultiSelectOption[] = [{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">{viewMode === 'consolidated' ? 'Dashboard de Inversiones (Consolidado)' : 'Dashboard de Inversiones'}</h1>
                <div className="flex items-center gap-4">
                     <button onClick={() => setIsAiAssistantOpen(true)} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md transition-colors" title="Consultar con IA">
                        <SparklesIcon/> <span className="hidden sm:inline">Consultar con IA</span>
                    </button>
                    {canEdit && (
                        <>
                            <button onClick={handleOpenMarketPrices} className="text-sm bg-white hover:bg-gray-100 text-gray-700 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 font-semibold py-2 px-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                                Gestionar Cotizaciones
                            </button>
                            {expiredHoldings.length > 0 &&
                                <button onClick={() => setIsExpiredModalOpen(true)} className="text-sm bg-white hover:bg-gray-100 text-gray-700 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 font-semibold py-2 px-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                                    Ver Archivo ({expiredHoldings.length})
                                </button>
                            }
                            {viewMode === 'individual' && 
                                <button onClick={() => { setEditingData(null); setIsFormOpen(true); }} className="flex items-center gap-2 bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg shadow-md">
                                    <PlusCircleIcon /> Agregar Transacción
                                </button>
                            }
                        </>
                    )}
                </div>
            </div>
            
            <InvestmentSummaryTable
                holdings={investmentSummaryData}
                totalMarketValueUSD={totalInvestmentValueUSD}
                viewMode={viewMode}
                companies={companies}
            />

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mb-4 border dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <FilterIcon />
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Filtros Avanzados</h3>
                    </div>
                    <button onClick={() => setIsFilterPanelOpen(p => !p)} className="text-primary dark:text-accent-dm">
                        {isFilterPanelOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                </div>
                {isFilterPanelOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end animate-fade-in">
                        <div><label className="text-sm font-medium">Buscar Instrumento</label><input type="text" value={advancedFilters.searchTerm} onChange={e => handleFilterChange('searchTerm', e.target.value)} placeholder="Ej: AL30" className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2 h-10"/></div>
                        <div><label className="text-sm font-medium">Tipo de Inversión</label><MultiSelectDropdown options={investmentTypeOptions} selectedValues={advancedFilters.investmentType} onChange={v => handleFilterChange('investmentType', v)} placeholder="Todos" /></div>
                        <div><label className="text-sm font-medium">Contraparte</label><MultiSelectDropdown options={counterpartyOptions} selectedValues={advancedFilters.counterparty} onChange={v => handleFilterChange('counterparty', v)} placeholder="Todas" /></div>
                        <div><label className="text-sm font-medium">Moneda</label><MultiSelectDropdown options={currencyOptions} selectedValues={advancedFilters.currency} onChange={v => handleFilterChange('currency', v)} placeholder="Todas" /></div>
                        <div className="lg:col-start-4 flex justify-end">
                             <button onClick={() => setAdvancedFilters(initialAdvancedFilters)} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold py-2 px-4 rounded-lg h-10">
                                <ArrowUturnLeftIcon /> Limpiar Filtros
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end items-center">
                <ExportButtons data={exportData} columns={exportColumns} fileName="cartera_inversiones" pdfTitle="Cartera de Inversiones"/>
            </div>

            <InvestmentList 
                groups={filteredInvestmentGroups}
                onStartEdit={handleStartEdit}
                onDeleteTransaction={handleDelete}
            />

            {isFormOpen && (
                <InvestmentForm 
                    onSave={handleSave}
                    onClose={() => { setIsFormOpen(false); setEditingData(null); }}
                    editingData={editingData}
                />
            )}
             {isExpiredModalOpen && (
                <ExpiredInvestmentsModal
                    holdings={expiredHoldings}
                    onClose={() => setIsExpiredModalOpen(false)}
                    onStartEdit={handleStartEdit}
                    onDeleteTransaction={handleDelete}
                />
            )}
             {isAiAssistantOpen && (
                <AIQueryAssistantModal
                    isOpen={isAiAssistantOpen}
                    onClose={() => setIsAiAssistantOpen(false)}
                    financialData={{ investments, investmentTypes, exchangeRates, arbitrageOperations, marketPriceHistory, brokers, banks }}
                />
            )}
             <style>{`
              @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
              .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default InvestmentModule;