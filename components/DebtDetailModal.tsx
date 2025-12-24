import React, { useMemo } from 'react';
import type { Debt, Bank, Broker, DebtType, AppCurrency, Cost } from '../types';
import { Currency } from '../types';
import { XIcon } from './Icons';
import { useAppContext } from '../App';
import { calculateFinancialsForDate, getTodayArgentinaDate, calculateUsdAnalysisForDate } from '../utils/financials';
import HelpTooltip from './HelpTooltip';
import { formatPercentageForDisplay } from '../utils/formatting';

interface DebtDetailModalProps {
  debt: Debt;
  banks: Bank[];
  brokers: Broker[];
  debtTypes: DebtType[];
  currencies: AppCurrency[];
  onClose: () => void;
}

const BreakdownItem: React.FC<{label: string, value: number, currency: string, isTotal?: boolean, isNegative?: boolean, isPositive?: boolean}> = ({ label, value, currency, isTotal = false, isNegative = false, isPositive = false }) => (
    <div className={`flex justify-between py-1 ${isTotal ? 'border-t border-gray-300 dark:border-gray-600 mt-1 pt-1 font-bold' : ''}`}>
        <span className="truncate pr-2">{isNegative ? '(-)' : isPositive ? '(+)' : ''} {label}:</span>
        <span className="flex-shrink-0">{value.toLocaleString('es-AR', { style: 'currency', currency })}</span>
    </div>
);

const getCostTiming = (cost: Cost | number | undefined): 'A' | 'V' => {
    if (typeof cost === 'number') return 'V'; // Legacy default for commission/stamps was Vencido
    if (cost && cost.timing) return cost.timing;
    return 'A'; // New default is Adelantado
};


const DebtDetailModal: React.FC<DebtDetailModalProps> = ({ debt, banks, brokers, debtTypes, currencies, onClose }) => {
  const { state } = useAppContext();
  const { appSettings, exchangeRates, futureRateHistory, arbitrageOperations } = state;

  const getCounterpartyName = (d: Debt) => {
    if (d.bankId) return banks.find(b => b.id === d.bankId)?.name || 'N/D';
    if (d.brokerId) return brokers.find(b => b.id === d.brokerId)?.name || 'N/D';
    return 'N/A';
  };

  const subtypeName = useMemo(() => {
    if (debt.currency !== Currency.USD || !debt.currencySubtypeId) return null;
    const usdCurrency = currencies.find(c => c.id === Currency.USD);
    const subtype = usdCurrency?.subtypes.find(st => st.id === debt.currencySubtypeId);
    return subtype?.name || null;
  }, [debt, currencies]);

  const financials = useMemo(() => {
    const calculationDate = debt.status === 'cancelled' && debt.actualCancellationDate 
        ? new Date(debt.actualCancellationDate + 'T00:00:00Z') 
        : getTodayArgentinaDate();
    return calculateFinancialsForDate(debt, calculationDate, appSettings);
  }, [debt, appSettings]);
  
  const usdAnalysis = useMemo(() => {
    if (debt.currency !== Currency.ARS) return null;
    
    const today = getTodayArgentinaDate();
    const latestFutureSnapshot = [...futureRateHistory]
        .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))
        .find(s => s.snapshotDate <= today.toISOString().split('T')[0]);

    return calculateUsdAnalysisForDate(debt, financials, latestFutureSnapshot, appSettings, exchangeRates, arbitrageOperations);
  }, [debt, financials, appSettings, exchangeRates, futureRateHistory, arbitrageOperations]);

  const renderCostItem = (label: string, costData: Cost | number | undefined, costAmount: number, timingToShow: 'A' | 'V') => {
    if (!costData || costAmount === 0) return null;
    const timing = getCostTiming(costData);
    if (timing !== timingToShow) return null;
    return <BreakdownItem label={label} value={costAmount} currency={debt.currency} isNegative={timing === 'A'} isPositive={timing === 'V'} />;
  };

  const DetailItem: React.FC<{ label: React.ReactNode; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}:</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 text-right">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Detalle de Deuda</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><XIcon /></button>
        </div>
        <div className="space-y-1">
          <DetailItem label="Tipo" value={debt.type} />
          <DetailItem label="Contraparte" value={getCounterpartyName(debt)} />
          <DetailItem
            label={debt.calculationMode === 'futureValue' ? 'Valor Futuro' : 'Monto Capital'}
            value={`${debt.currency} ${debt.amount.toLocaleString('es-AR')} ${subtypeName ? `(${subtypeName})` : ''}`}
          />
          {debt.calculationMode === 'futureValue' && debt.netAmountReceived && <DetailItem label="Bruto Recibido (informado)" value={`${debt.currency} ${debt.netAmountReceived.toLocaleString('es-AR')}`} />}
          <DetailItem label="Fecha Otorgamiento" value={new Date(debt.originationDate + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' })} />
          <DetailItem label="Fecha Vencimiento" value={new Date(debt.dueDate + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' })} />
          {debt.status === 'cancelled' && debt.actualCancellationDate && (
             <DetailItem label="Fecha Real de Cancelación" value={<span className="font-bold text-green-600 dark:text-green-400">{new Date(debt.actualCancellationDate + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' })}</span>} />
          )}
          <DetailItem label="TNA" value={formatPercentageForDisplay(debt.rate)} />
           <DetailItem 
            label="CFT (Moneda Original)" 
            value={
                <span className="font-bold text-blue-600 dark:text-blue-400">
                    {formatPercentageForDisplay(financials.cft)}
                </span>
            } 
          />
          {(debt.punitiveInterestRate ?? 0) > 0 && (
             <DetailItem label="TNA Moratoria" value={<span className="font-bold text-red-600 dark:text-red-500">{formatPercentageForDisplay(debt.punitiveInterestRate)}</span>} />
          )}
           {financials.totalPunitiveInterest > 0 && (
            <DetailItem 
              label="Intereses Moratorios Pagados" 
              value={
                <span className="font-bold text-red-600 dark:text-red-500">
                  {`${debt.currency} ${financials.totalPunitiveInterest.toLocaleString('es-AR', {minimumFractionDigits: 2})}`}
                </span>
              }
            />
          )}
        </div>
        
        {/* For USD Debts */}
        {debt.currency === Currency.USD && (
            <DetailItem 
                label="CFT (USD)" 
                value={
                    <span className="font-bold text-green-600 dark:text-green-400">
                        {formatPercentageForDisplay(financials.cft)}
                    </span>
                } 
            />
        )}

        {/* For ARS Debts */}
        {appSettings.showUsdAnalysisSection && debt.currency === Currency.ARS && usdAnalysis && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">Análisis en Dólares</h3>
                
                <DetailItem label="TC al Otorgamiento" value={debt.exchangeRateAtOrigination.toLocaleString('es-AR')} />
                <DetailItem 
                    label={
                        <span className="flex items-center gap-1">
                            TC Estimado de Cancelación
                            <HelpTooltip text="Tipo de cambio proyectado para la fecha de vencimiento. Se usa para calcular la CFT en USD. Puede ser un TC sintético (de una cobertura), implícito (de la curva de futuros) o real (del día de cancelación)." />
                        </span>
                    }
                    value={
                        <span className="flex flex-col items-end">
                            <span className="font-bold">{usdAnalysis.projectedLoanDueDateRate.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">({usdAnalysis.analysisType})</span>
                        </span>
                    }
                />

                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-sm">
                        <BreakdownItem label="Desembolso (USD)" value={usdAnalysis.usdReceived} currency="USD" isPositive />
                        <BreakdownItem label="Cancelación (USD)" value={usdAnalysis.usdToRepay} currency="USD" isNegative />
                        <BreakdownItem label="Interés (USD)" value={usdAnalysis.usdInterest} currency="USD" isTotal />
                    </div>
                    <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <div>
                            <div className="text-sm text-center text-gray-600 dark:text-gray-300">CFT (USD)</div>
                            <div className="text-2xl text-center font-bold text-green-600 dark:text-green-400">{formatPercentageForDisplay(usdAnalysis.usd_cft)}</div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {appSettings.showFinancialBreakdownSection && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">Desglose Financiero</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    {/* Desembolso Column */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <h4 className="font-bold mb-2 text-center text-gray-800 dark:text-gray-200">Desembolso (Lo que se recibe)</h4>
                        
                        {debt.calculationMode === 'futureValue' ? (
                             <BreakdownItem label="Valor Futuro (a desc.)" value={debt.amount} currency={debt.currency} isPositive />
                        ) : (
                             <BreakdownItem label="Monto Capital" value={debt.amount} currency={debt.currency} isPositive />
                        )}

                        {debt.calculationMode === 'futureValue' && (financials.totalInterest - financials.totalPunitiveInterest) > 0 &&
                            <BreakdownItem label="Intereses (Descuento)" value={financials.totalInterest - financials.totalPunitiveInterest} currency={debt.currency} isNegative />
                        }
                        
                        {debt.calculationMode === 'futureValue' &&
                           <BreakdownItem label="Bruto Recibido" value={debt.netAmountReceived || 0} currency={debt.currency} isTotal={false} />
                        }

                        {renderCostItem('Comisión', debt.commission, financials.commissionAmount, 'A')}
                        {renderCostItem('Sellos', debt.stamps, financials.stampsAmount, 'A')}
                        {renderCostItem('Der. Mercado', debt.marketRights, financials.marketRightsAmount, 'A')}
                        
                        <BreakdownItem label="Neto a Recibir" value={financials.netDisbursed} currency={debt.currency} isTotal />
                    </div>
                    {/* Cancelación Column */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <h4 className="font-bold mb-2 text-center text-gray-800 dark:text-gray-200">Cancelación (Lo que se paga)</h4>
                        <BreakdownItem label={debt.calculationMode === 'futureValue' ? 'Valor Futuro' : 'Monto Capital'} value={debt.amount} currency={debt.currency} isPositive />

                        {debt.calculationMode === 'presentValue' && (financials.totalInterest - financials.totalPunitiveInterest) > 0 &&
                            <BreakdownItem label="Intereses Compensatorios" value={financials.totalInterest - financials.totalPunitiveInterest} currency={debt.currency} isPositive />
                        }

                        {renderCostItem('Comisión', debt.commission, financials.commissionAmount, 'V')}
                        {renderCostItem('Sellos', debt.stamps, financials.stampsAmount, 'V')}
                        {renderCostItem('Der. Mercado', debt.marketRights, financials.marketRightsAmount, 'V')}

                        {financials.totalPunitiveInterest > 0 &&
                            <BreakdownItem label="Intereses Moratorios" value={financials.totalPunitiveInterest} currency={debt.currency} isPositive />
                        }
                        
                        {debt.cancellationPenalty && debt.cancellationPenalty > 0 &&
                            <BreakdownItem label="Penalidad por Cancelación" value={debt.cancellationPenalty} currency={debt.currency} isPositive />
                        }

                        <BreakdownItem label="Total a Pagar" value={financials.totalToRepay} currency={debt.currency} isTotal />
                    </div>
                </div>
            </div>
        )}

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-bold py-2 px-4 rounded-lg">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default DebtDetailModal;