
import React, { useMemo, useState } from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useFinancialCalculations } from '../utils/calculations';
import { getTodayArgentinaDate, calculateFinancialsForDate, daysBetween } from '../utils/financials';
import { Currency } from '../types';
import type { AppSettings } from '../types';
import HelpTooltip from './HelpTooltip';
import MaturitiesWaterfallChart from './MaturitiesWaterfallChart';
import HistoricalEvolutionChart from './HistoricalEvolutionChart';
import { useAppContext } from '../App';
import { ArrowsUpDownIcon } from './Icons';

const KpiCard: React.FC<{ title: string; value: string; helpText: string; colorClass?: string; secondaryValue?: string }> = ({ title, value, helpText, colorClass = 'text-gray-800 dark:text-gray-100', secondaryValue }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 transition-all duration-300">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
            {title} <HelpTooltip text={helpText} />
        </h3>
        <p className={`text-2xl lg:text-3xl font-bold mt-2 ${colorClass}`}>{value}</p>
        {secondaryValue && <p className="text-xs text-gray-500 mt-1">{secondaryValue}</p>}
    </div>
);

const Widget: React.FC<{title: string, children: React.ReactNode, className?: string}> = ({title, children, className=""}) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 ${className}`}>
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
        {children}
    </div>
);

const PIE_PALETTE = ['#047857', '#10b981', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#84cc16', '#0891b2', '#f43f5e', '#64748b'];

const BreakdownPieChart: React.FC<{ data: { name: string, value: number }[], appSettings: AppSettings }> = ({ data, appSettings }) => {
    const isDarkMode = appSettings.theme === 'dark';
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500">Sin datos</div>;
    }
    return (
        <ResponsiveContainer width="100%" height={250}>
            <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {data.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_PALETTE[index % PIE_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `USD ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#4b5563' }} />
            </PieChart>
        </ResponsiveContainer>
    );
};

const GlobalDashboard: React.FC = () => {
    const { state } = useAppContext();
    const { exchangeRates, marketPriceHistory } = state;
    const { companyDebts, companyInvestments, investmentGroups, banks, latestRate, appSettings, companyDebtCalculations } = useFinancialCalculations();
    const today = useMemo(() => getTodayArgentinaDate(), []);

    // --- FASE 4: Stress Test Logic ---
    const [fxShift, setFxShift] = useState(0); // Porcentaje de variación del TC
    const effectiveRate = useMemo(() => latestRate * (1 + fxShift / 100), [latestRate, fxShift]);

    const { netPosition, totalDebtUSD, totalInvestmentUSD, weightedCft, availableCredit } = useMemo(() => {
        let totalDebtStockUSD = 0;
        let totalWeightedCftNumerator = 0;
        let totalPrincipalUSD_for_cft = 0;
        
        companyDebts.forEach(debt => {
            const calcs = companyDebtCalculations.get(debt.id);
            if (!calcs) return;

            const { financials, usdAnalysis } = calcs;
            const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
            const accruedInterestNative = financials.accruedInterest;
            
            // Usar effectiveRate (simulado) para deudas en ARS
            totalDebtStockUSD += (debt.currency === Currency.USD)
                ? principalNative + accruedInterestNative
                : (principalNative + accruedInterestNative) / effectiveRate;

            const principalForRateWeightingUSD = debt.currency === Currency.USD ? principalNative : principalNative / debt.exchangeRateAtOrigination;
            let cftInUsd: number | null = (debt.currency === Currency.USD) ? financials.cft : usdAnalysis?.usd_cft ?? null;

            if (cftInUsd !== null && isFinite(cftInUsd) && principalForRateWeightingUSD > 0) {
                totalWeightedCftNumerator += cftInUsd * principalForRateWeightingUSD;
                totalPrincipalUSD_for_cft += principalForRateWeightingUSD;
            }
        });

        // Valor de inversiones (recalculado si son en ARS)
        const totalInvestmentValueUSD = investmentGroups.reduce((sum, group) => {
            return sum + group.holdings.reduce((hSum, h) => {
                const valNative = h.marketValue;
                const valUSD = h.currency === Currency.USD ? valNative : valNative / effectiveRate;
                return hSum + valUSD;
            }, 0);
        }, 0);
        
        const totalCreditLimitUSD = banks.reduce((sum, bank) => {
            return sum + bank.creditLines.reduce((bankSum, line) => {
                return bankSum + (line.currency === Currency.USD ? line.amount : line.amount / effectiveRate);
            }, 0);
        }, 0);

        const totalUsedCreditUSD = companyDebts.reduce((sum, debt) => {
             const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
             return sum + (debt.currency === Currency.USD ? principalNative : principalNative / effectiveRate);
        }, 0);

        return {
            netPosition: totalInvestmentValueUSD - totalDebtStockUSD,
            totalDebtUSD: totalDebtStockUSD,
            totalInvestmentUSD: totalInvestmentValueUSD,
            weightedCft: totalPrincipalUSD_for_cft > 0 ? totalWeightedCftNumerator / totalPrincipalUSD_for_cft : 0,
            availableCredit: totalCreditLimitUSD - totalUsedCreditUSD,
        };
    }, [companyDebts, investmentGroups, banks, effectiveRate, companyDebtCalculations]);
    
    const waterfallData = useMemo(() => {
        const data: any[] = [{ month: 'Posición Neta Actual', cumulativeNet: netPosition, debt: 0, investment: 0, net: 0 }];
        let runningBalance = netPosition;

        for (let i = 0; i < 6; i++) {
            const targetMonth = new Date(today);
            targetMonth.setUTCMonth(today.getUTCMonth() + i);
            const monthKey = `${targetMonth.getUTCFullYear()}-${String(targetMonth.getUTCMonth() + 1).padStart(2, '0')}`;
            
            let debtMaturities = 0;
            companyDebts.forEach(d => {
                if (d.dueDate.startsWith(monthKey)) {
                    const financials = companyDebtCalculations.get(d.id)?.financials;
                    if (financials) {
                        const amountUSD = d.currency === Currency.USD ? financials.totalToRepay : financials.totalToRepay / effectiveRate;
                        debtMaturities -= amountUSD;
                    }
                }
            });
            
            let investmentMaturities = 0;
            investmentGroups.flatMap(g => g.holdings).forEach(h => {
                if (h.maturityDate?.startsWith(monthKey)) {
                    // Simplificación: usamos el valor de mercado actual en USD simulado
                    const valUSD = h.currency === Currency.USD ? h.marketValue : h.marketValue / effectiveRate;
                    investmentMaturities += valUSD; 
                }
            });
            
            const netFlow = debtMaturities + investmentMaturities;
            runningBalance += netFlow;
            
            data.push({
                month: monthKey,
                debt: debtMaturities,
                investment: investmentMaturities,
                net: netFlow,
                cumulativeNet: runningBalance
            });
        }
        return data;
    }, [netPosition, companyDebts, investmentGroups, companyDebtCalculations, effectiveRate, today]);
    
    const debtBreakdownData = useMemo(() => {
        const byType: Record<string, number> = {};
        companyDebts.forEach(debt => {
            const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
            const debtStockUSD = debt.currency === Currency.USD ? principalNative : principalNative / effectiveRate;
            byType[debt.type] = (byType[debt.type] || 0) + debtStockUSD;
        });
        return Object.entries(byType).map(([name, value]) => ({ name, value }));
    }, [companyDebts, effectiveRate]);

    const investmentBreakdownData = useMemo(() => {
        return investmentGroups.map(group => {
             const groupValUSD = group.holdings.reduce((s, h) => {
                 return s + (h.currency === Currency.USD ? h.marketValue : h.marketValue / effectiveRate);
             }, 0);
             return { name: group.groupName, value: groupValUSD };
        });
    }, [investmentGroups, effectiveRate]);

    const historicalData = useMemo(() => {
        const data: { date: string; "Deuda Total": number; "Inversiones Totales": number; "Posición Neta": number }[] = [];
        const rangeInDays = 180;

        for (let i = rangeInDays; i >= 0; i--) {
            const date = new Date(today);
            date.setUTCDate(today.getUTCDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const rateForDay = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= dateStr)?.rate || latestRate;
            const priceSnapshot = [...marketPriceHistory].sort((a,b) => b.date.localeCompare(a.date)).find(s => s.date <= dateStr);
            const marketPrices = priceSnapshot ? priceSnapshot.prices : {};

            let historicalTotalDebtUSD = 0;
            companyDebts.forEach(debt => {
                const originationDate = new Date(debt.originationDate + 'T00:00:00Z');
                const endDate = new Date((debt.actualCancellationDate || debt.dueDate) + 'T00:00:00Z');
                
                if (originationDate <= date && date < endDate) {
                    const financials = calculateFinancialsForDate(debt, date, appSettings);
                    const accruedValue = (debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount) + financials.accruedInterest;
                    const valueUSD = debt.currency === Currency.USD 
                        ? accruedValue
                        : accruedValue / rateForDay;
                    historicalTotalDebtUSD += valueUSD;
                }
            });

            let historicalTotalInvestmentUSD = 0;
            companyInvestments.forEach(inv => {
                const transactionsUpToDate = inv.transactions.filter(t => new Date(t.date + 'T00:00:00Z') <= date);
                if (transactionsUpToDate.length === 0) return;
                
                const totalQuantity = transactionsUpToDate.reduce((acc, t) => acc + (t.type === 'Compra' ? t.quantity : -t.quantity), 0);
                if (totalQuantity <= 1e-9) return;

                const purchaseTxs = transactionsUpToDate.filter(t => t.type === 'Compra');
                const isFixedRate = purchaseTxs.length > 0 && purchaseTxs.every(t => t.isFixedRate);

                let marketValueNative = 0;
                if (isFixedRate) {
                     const quantityBought = purchaseTxs.reduce((sum, t) => sum + t.quantity, 0);
                     const costBasisNative = purchaseTxs.reduce((sum, t) => sum + t.price * t.quantity, 0);
                     const avgBuyPrice = quantityBought > 0 ? costBasisNative / quantityBought : 0;
                     const remainingCostBasis = totalQuantity * avgBuyPrice;

                     const accruedInterestOnPurchases = purchaseTxs.reduce((total, t) => {
                         const elapsedDays = daysBetween(t.date, date);
                         const principal = t.quantity * t.price;
                         const accrued = principal * (t.tea || 0) / 100 / appSettings.annualRateBasis * Math.max(0, elapsedDays);
                         return total + accrued;
                     }, 0);

                     const proportionRemaining = quantityBought > 0 ? totalQuantity / quantityBought : 0;
                     const accruedInterestOnRemaining = accruedInterestOnPurchases * proportionRemaining;

                     marketValueNative = remainingCostBasis + accruedInterestOnRemaining;
                } else {
                    const marketPrice = marketPrices[inv.instrumentName.toLowerCase()] || 0;
                    marketValueNative = totalQuantity * marketPrice;
                }

                const valueUSD = inv.currency === Currency.USD ? marketValueNative : marketValueNative / rateForDay;
                historicalTotalInvestmentUSD += valueUSD;
            });
            
            data.push({
                date: dateStr,
                "Deuda Total": historicalTotalDebtUSD,
                "Inversiones Totales": historicalTotalInvestmentUSD,
                "Posición Neta": historicalTotalInvestmentUSD - historicalTotalDebtUSD,
            });
        }
        return data;
    }, [companyDebts, companyInvestments, exchangeRates, marketPriceHistory, appSettings, latestRate, today]);
    
    const isDarkMode = appSettings.theme === 'dark';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Dashboard Global</h1>
          
          {/* Panel de Stress Test */}
          <div className="bg-primary/5 dark:bg-accent-dm/5 border border-primary/20 dark:border-accent-dm/20 p-3 rounded-xl flex flex-col md:flex-row items-center gap-4 shadow-sm w-full md:w-auto">
              <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 dark:bg-accent-dm/10 rounded-lg text-primary dark:text-accent-dm">
                    <ArrowsUpDownIcon className="w-5 h-5" />
                  </div>
                  <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 leading-none">Stress Test CCL</p>
                      <p className="text-sm font-bold text-primary dark:text-accent-dm">${effectiveRate.toLocaleString('es-AR', {minimumFractionDigits: 2})}</p>
                  </div>
              </div>
              <div className="flex-grow md:w-48">
                  <input 
                    type="range" 
                    min="-20" 
                    max="100" 
                    step="5"
                    value={fxShift} 
                    onChange={(e) => setFxShift(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] font-medium text-gray-400 mt-1">
                      <span>-20%</span>
                      <span className={fxShift !== 0 ? 'text-primary dark:text-accent-dm font-bold' : ''}>{fxShift > 0 ? `+${fxShift}%` : `${fxShift}%`}</span>
                      <span>+100%</span>
                  </div>
              </div>
              {fxShift !== 0 && (
                  <button 
                    onClick={() => setFxShift(0)}
                    className="text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded hover:bg-gray-50 font-bold transition-colors"
                  >
                      RESET
                  </button>
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard 
            title="Posición Neta" 
            value={`USD ${netPosition.toLocaleString('es-AR', {maximumFractionDigits:0})}`} 
            helpText="Inversiones Totales - Deuda Total Devengada. Se recalcula según el escenario de tipo de cambio elegido en el panel de Stress Test." 
            colorClass={netPosition >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} 
            secondaryValue={fxShift !== 0 ? `Escenario: ${fxShift}% TC` : undefined}
        />
        <KpiCard title="Deuda Total Devengada" value={`USD ${totalDebtUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}`} helpText="Capital total adeudado más intereses acumulados hasta hoy, valorizado en USD (simulado si se aplicó el Stress Test)." />
        <KpiCard title="Inversiones Totales" value={`USD ${totalInvestmentUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}`} helpText="Valor de mercado actual de todas las inversiones valorizadas en USD." />
        <KpiCard title="CFT Ponderado Deuda" value={`${weightedCft.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`} helpText="Costo Financiero Total promedio de la cartera de deudas, ponderada por el monto de cada operación." />
        <KpiCard title="Crédito Disponible" value={`USD ${availableCredit.toLocaleString('es-AR', {maximumFractionDigits:0})}`} helpText="Suma de todas las líneas de crédito bancarias menos la deuda utilizada." />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Widget title="Proyección de Flujo de Caja (6 Meses)">
             <MaturitiesWaterfallChart data={waterfallData} appSettings={appSettings} />
          </Widget>
           <Widget title="Evolución Histórica (180 días)">
             <HistoricalEvolutionChart data={historicalData} appSettings={appSettings} />
          </Widget>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Widget title="Desglose de Deuda por Tipo">
             <BreakdownPieChart data={debtBreakdownData} appSettings={appSettings} />
          </Widget>
           <Widget title="Desglose de Inversiones por Tipo">
             <BreakdownPieChart data={investmentBreakdownData} appSettings={appSettings} />
          </Widget>
      </div>
    </div>
  );
};

export default GlobalDashboard;
