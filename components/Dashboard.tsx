
import React, { useMemo, useState, useCallback } from 'react';
import type { Debt, Bank, MultiSelectOption, Currency } from '../types';
import { Currency as CurrencyEnum } from '../types';
import DebtList from './DebtList';
import DebtByCounterpartyDashboard from './DebtByCounterpartyDashboard';
import DebtByTypeDashboard from './DebtByTypeDashboard';
import DebtByCurrencyDashboard from './DebtByCurrencyDashboard';
import SummaryDashboard from './SummaryDashboard';
import { PlusCircleIcon, PresentationChartBarIcon, ClockIcon, ChartBarIcon, XCircleIcon, FilterIcon, ArrowUturnLeftIcon, ChevronDownIcon, ChevronUpIcon, SparklesIcon, DocumentMagnifyingGlassIcon, BoltIcon } from './Icons';
import ExpiredDebtsModal from './ExpiredDebtsModal';
import { useAppContext } from '../App';
import { useFinancialCalculations } from '../utils/calculations';
import { selectActiveAndExpiredDebts } from '../utils/calculations';
import MultiSelectDropdown from './MultiSelectDropdown';
import AIQueryAssistantModal from './AIQueryAssistantModal';
import CostComparatorChart from './CostComparatorChart';
import EventsTimeline from './EventsTimeline';
import RiskHeatmapModal from './RiskHeatmapModal';
import CreditUtilizationMatrixModal from './CreditUtilizationMatrixModal';
import DebtEvolutionModal from './DebtEvolutionModal';
import AccruedInterestAnalysisModal from './AccruedInterestAnalysisModal';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { formatPercentageForDisplay } from '../utils/formatting';
import DebtOptimizerModal from './DebtOptimizerModal';


type BreakdownTab = 'banks' | 'type' | 'currency';

const initialAdvancedFilters = {
    debtType: [] as string[],
    counterparty: [] as string[],
    currency: [] as string[],
    dueDateStart: '',
    dueDateEnd: '',
};

const Dashboard: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { currentUser, investments, investmentTypes, marketPriceHistory, companies, viewMode } = state;
  const { companyDebts, historicalDebtLog, debtTypes, exchangeRates, latestFutureSnapshot, companyArbitrageOps, appSettings, banks, brokers, futureRateHistory, companyDebtCalculations } = useFinancialCalculations();

  const [chartFilter, setChartFilter] = useState<{ type: BreakdownTab; value: string } | null>(null);
  const [isExpiredDebtsModalOpen, setIsExpiredDebtsModalOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(initialAdvancedFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isRiskHeatmapModalOpen, setIsRiskHeatmapModalOpen] = useState(false);
  const [isCreditUtilizationModalOpen, setIsCreditUtilizationModalOpen] = useState(false);
  const [isDebtEvolutionModalOpen, setIsDebtEvolutionModalOpen] = useState(false);
  const [isAccruedInterestModalOpen, setIsAccruedInterestModalOpen] = useState(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  
  const { activeDebts, expiredDebts } = useMemo(() => selectActiveAndExpiredDebts(companyDebts), [companyDebts]);

  const onAddDebt = () => dispatch({ type: 'OPEN_DEBT_FORM', payload: null });
  
  const canEdit = useMemo(() => {
    const debtPermission = currentUser?.permissions.debt;
    return debtPermission === 'admin' || debtPermission === 'operator';
  }, [currentUser]);

  const filteredActiveDebts = useMemo(() => {
    const hasAdvancedFilters =
        advancedFilters.debtType.length > 0 ||
        advancedFilters.counterparty.length > 0 ||
        advancedFilters.currency.length > 0 ||
        advancedFilters.dueDateStart !== '' ||
        advancedFilters.dueDateEnd !== '';

    if (!chartFilter && !hasAdvancedFilters) {
        return activeDebts;
    }
    
    return activeDebts.filter(debt => {
        // Chart filter logic
        const getCounterpartyName = (d: Debt) => {
            if (d.bankId) return banks.find(b => b.id === d.bankId)?.name || 'N/D';
            if (d.brokerId) return brokers.find(b => b.id === d.brokerId)?.name || 'N/D';
            return 'N/A';
        };
        let chartFilterMatch = true;
        if (chartFilter) {
            switch (chartFilter.type) {
                case 'type':
                    chartFilterMatch = debt.type === chartFilter.value;
                    break;
                case 'banks':
                    chartFilterMatch = getCounterpartyName(debt) === chartFilter.value;
                    break;
                case 'currency':
                    chartFilterMatch = debt.currency === chartFilter.value;
                    break;
                default:
                    chartFilterMatch = true;
            }
        }

        // Advanced filter logic
        let advancedFilterMatch = true;
        if (hasAdvancedFilters) {
            const { debtType, counterparty, currency, dueDateStart, dueDateEnd } = advancedFilters;
            const debtCounterpartyId = debt.bankId ? `bank-${debt.bankId}` : debt.brokerId ? `broker-${debt.brokerId}` : '';
            const debtTypeDetails = debtTypes.find(dt => dt.name === debt.type);
            
            const typeMatch = debtType.length === 0 || (debtTypeDetails && debtType.includes(debtTypeDetails.id));
            const counterpartyMatch = counterparty.length === 0 || (debtCounterpartyId && counterparty.includes(debtCounterpartyId));
            const currencyMatch = currency.length === 0 || currency.includes(debt.currency);
            const startDateMatch = !dueDateStart || debt.dueDate >= dueDateStart;
            const endDateMatch = !dueDateEnd || debt.dueDate <= dueDateEnd;

            advancedFilterMatch = typeMatch && counterpartyMatch && currencyMatch && startDateMatch && endDateMatch;
        }

        return chartFilterMatch && advancedFilterMatch;
    });
  }, [activeDebts, chartFilter, advancedFilters, banks, brokers, debtTypes]);
  
  const getCounterpartyName = useCallback((debt: Debt) => {
    if (debt.bankId) return banks.find(b => b.id === debt.bankId)?.name || 'N/D';
    if (debt.brokerId) return brokers.find(b => b.id === debt.brokerId)?.name || 'N/D';
    return 'N/A';
  }, [banks, brokers]);

  const getCftDisplay = useCallback((debt: Debt) => {
    const calcs = companyDebtCalculations.get(debt.id);
    if (!calcs) return null;
    return calcs.financials.cft;
  }, [companyDebtCalculations]);

  const getUsdCftDisplay = useCallback((debt: Debt) => {
    const calcs = companyDebtCalculations.get(debt.id);
    if (!calcs) return null;
    if (debt.currency === CurrencyEnum.USD) {
      return calcs.financials.cft;
    }
    return calcs.usdAnalysis?.usd_cft;
  }, [companyDebtCalculations]);
  
  const exportColumns: ExportColumn<Debt>[] = useMemo(() => {
    const columns: ExportColumn<Debt>[] = [
      { header: 'Tipo', accessor: d => d.type },
      { header: 'Contraparte', accessor: d => getCounterpartyName(d) },
      { header: 'Monto', accessor: d => d.amount.toLocaleString('es-AR') },
      { header: 'Moneda', accessor: d => d.currency },
      { header: 'Vencimiento', accessor: d => {
          if (!d.dueDate) return '';
          const [year, month, day] = d.dueDate.split('-');
          return `${day}-${month}-${year}`;
      }},
      { header: 'CFT (Moneda) %', accessor: d => formatPercentageForDisplay(getCftDisplay(d))},
      { header: 'CFT (USD) %', accessor: d => formatPercentageForDisplay(getUsdCftDisplay(d))},
    ];

    if (viewMode === 'consolidated') {
      columns.unshift({ header: 'Empresa', accessor: d => companies.find(c => c.id === d.companyId)?.name || 'N/D' });
    }
    
    return columns;
  }, [getCounterpartyName, getCftDisplay, getUsdCftDisplay, viewMode, companies]);


  const debtTypeOptions: MultiSelectOption[] = useMemo(() => debtTypes.map(dt => ({ value: dt.id, label: dt.name })), [debtTypes]);
  const counterpartyOptions: MultiSelectOption[] = useMemo(() => [
      ...banks.map(b => ({ value: `bank-${b.id}`, label: b.name })),
      ...brokers.map(b => ({ value: `broker-${b.id}`, label: b.name }))
  ].sort((a,b) => a.label.localeCompare(b.label)), [banks, brokers]);
  const currencyOptions: MultiSelectOption[] = [{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }];
  
  const handleFilterChange = (filterName: keyof typeof advancedFilters, value: any) => {
      setAdvancedFilters(prev => ({ ...prev, [filterName]: value }));
  };
  
  const Widget: React.FC<{title: string, children: React.ReactNode, className?: string, icon?: React.ReactNode}> = ({title, children, className="", icon}) => (
      <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 ${className}`}>
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {children}
      </div>
  );

  return (
    <div className="space-y-6">
      
        <div className="space-y-6 animate-fade-in">
          
          <SummaryDashboard debts={filteredActiveDebts} />
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             <div className="lg:col-span-8">
                <Widget title="Línea de Tiempo de Eventos Financieros (90 días)">
                    <EventsTimeline debts={filteredActiveDebts} />
                </Widget>
             </div>
             <div className="lg:col-span-4">
                 <Widget title="Comparador de Costo de Financiamiento (CFT USD)">
                    <CostComparatorChart debts={filteredActiveDebts} />
                 </Widget>
             </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Widget title="Desglose por Tipo">
                 <DebtByTypeDashboard chartFilter={chartFilter} setChartFilter={(f) => setChartFilter(f as any)} />
              </Widget>
               <Widget title="Desglose por Contraparte">
                 <DebtByCounterpartyDashboard chartFilter={chartFilter} setChartFilter={(f) => setChartFilter(f as any)} />
              </Widget>
              <Widget title="Desglose por Moneda">
                 <DebtByCurrencyDashboard chartFilter={chartFilter} setChartFilter={(f) => setChartFilter(f as any)} />
              </Widget>
          </div>

          <Widget title="Análisis Adicional" icon={<DocumentMagnifyingGlassIcon />}>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Explore análisis detallados sobre la cartera de deuda, utilización de líneas y evolución histórica.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={() => setIsRiskHeatmapModalOpen(true)} className="text-left p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Matriz de Riesgo</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Visualice la concentración de deuda por contraparte.</p>
                </button>
                <button onClick={() => setIsCreditUtilizationModalOpen(true)} className="text-left p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Utilización de Líneas</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Analice el uso de las líneas de crédito bancarias.</p>
                </button>
                 <button onClick={() => setIsDebtEvolutionModalOpen(true)} className="text-left p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Evolución Histórica</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Vea el gráfico y el registro histórico de la deuda.</p>
                </button>
                <button onClick={() => setIsAccruedInterestModalOpen(true)} className="text-left p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Intereses Devengados</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Calcule los intereses devengados por deuda a una fecha específica.</p>
                </button>
            </div>
          </Widget>
          
          <div>
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
                        <div><label className="text-sm font-medium">Tipo de Deuda</label><MultiSelectDropdown options={debtTypeOptions} selectedValues={advancedFilters.debtType} onChange={v => handleFilterChange('debtType', v)} placeholder="Todos" /></div>
                        <div><label className="text-sm font-medium">Contraparte</label><MultiSelectDropdown options={counterpartyOptions} selectedValues={advancedFilters.counterparty} onChange={v => handleFilterChange('counterparty', v)} placeholder="Todas" /></div>
                        <div><label className="text-sm font-medium">Moneda</label><MultiSelectDropdown options={currencyOptions} selectedValues={advancedFilters.currency} onChange={v => handleFilterChange('currency', v)} placeholder="Todas" /></div>
                        <div className="grid grid-cols-2 gap-2">
                           <div><label className="text-sm font-medium">Vto. Desde</label><input type="date" value={advancedFilters.dueDateStart} onChange={e => handleFilterChange('dueDateStart', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2 h-10"/></div>
                           <div><label className="text-sm font-medium">Vto. Hasta</label><input type="date" value={advancedFilters.dueDateEnd} onChange={e => handleFilterChange('dueDateEnd', e.target.value)} min={advancedFilters.dueDateStart} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2 h-10"/></div>
                        </div>
                        <div className="lg:col-start-4 flex justify-end">
                             <button onClick={() => { setAdvancedFilters(initialAdvancedFilters); setChartFilter(null); }} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold py-2 px-4 rounded-lg h-10">
                                <ArrowUturnLeftIcon /> Limpiar Filtros
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Registro de Deudas Activas</h2>
                    {chartFilter && (
                        <div className="flex items-center gap-2 bg-primary/10 text-primary dark:text-accent-dm dark:bg-accent-dm/10 px-3 py-1 rounded-full text-sm font-medium">
                            <span>Filtro: <strong>{chartFilter.value}</strong></span>
                            <button onClick={() => setChartFilter(null)} className="p-0.5 rounded-full hover:bg-primary/20" title="Limpiar filtro">
                                <XCircleIcon />
                            </button>
                        </div>
                    )}
                </div>
              <div className="flex items-center gap-3">
                <button 
                    onClick={() => setIsOptimizerOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all animate-pulse-slow"
                >
                    <BoltIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">OPTIMIZAR DEUDA</span>
                </button>
                <button onClick={() => setIsAiAssistantOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-md transition-colors" title="Consultar com IA">
                    <SparklesIcon/> <span className="hidden sm:inline">Consultar com IA</span>
                </button>
                <ExportButtons
                  data={filteredActiveDebts}
                  columns={exportColumns}
                  fileName="deudas_activas"
                  pdfTitle="Registro de Deudas Activas"
                />
                {canEdit && viewMode === 'individual' && (
                  <button onClick={onAddDebt} className="flex items-center gap-2 bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg shadow-md"><PlusCircleIcon /> Agregar Deuda</button>
                )}
                <button onClick={() => setIsExpiredDebtsModalOpen(true)} className="text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg shadow-sm border border-gray-200 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 dark:border-gray-600">Ver Archivo de Deudas Vencidas</button>
              </div>
            </div>
            <DebtList debts={filteredActiveDebts} />
          </div>
        </div>
      
      {isExpiredDebtsModalOpen && (<ExpiredDebtsModal debts={expiredDebts} onClose={() => setIsExpiredDebtsModalOpen(false)}/>)}
      {isAiAssistantOpen && (<AIQueryAssistantModal isOpen={isAiAssistantOpen} onClose={() => setIsAiAssistantOpen(false)} financialData={{ debts: companyDebts, investments, debtTypes, investmentTypes, banks, brokers, exchangeRates, marketPriceHistory }} />)}

      {isRiskHeatmapModalOpen && (
          <RiskHeatmapModal 
              isOpen={isRiskHeatmapModalOpen}
              onClose={() => setIsRiskHeatmapModalOpen(false)}
              debts={filteredActiveDebts}
          />
      )}
      {isCreditUtilizationModalOpen && (
          <CreditUtilizationMatrixModal
              isOpen={isCreditUtilizationModalOpen}
              onClose={() => setIsCreditUtilizationModalOpen(false)}
          />
      )}
      {isDebtEvolutionModalOpen && (
          <DebtEvolutionModal
              isOpen={isDebtEvolutionModalOpen}
              onClose={() => setIsDebtEvolutionModalOpen(false)}
              allDebts={companyDebts}
              debtTypes={debtTypes}
              banks={banks}
              brokers={brokers}
              exchangeRates={exchangeRates}
              futureRateHistory={futureRateHistory}
              appSettings={appSettings}
              arbitrageOperations={companyArbitrageOps}
          />
      )}
      {isAccruedInterestModalOpen && (
          <AccruedInterestAnalysisModal
              isOpen={isAccruedInterestModalOpen}
              onClose={() => setIsAccruedInterestModalOpen(false)}
              allDebts={companyDebts}
              banks={banks}
              brokers={brokers}
              exchangeRates={exchangeRates}
              appSettings={appSettings}
          />
      )}
      
      {isOptimizerOpen && (
          <DebtOptimizerModal
              isOpen={isOptimizerOpen}
              onClose={() => setIsOptimizerOpen(false)}
              activeDebts={activeDebts}
              banks={banks}
              debtTypes={debtTypes}
              appSettings={appSettings}
          />
      )}


       <style>{`
          @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
          .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
          @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
          .animate-pulse-slow { animation: pulse-slow 3s infinite ease-in-out; }
      `}</style>
    </div>
  );
};

export default Dashboard;
