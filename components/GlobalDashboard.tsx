
import React, { useMemo, useState } from 'react';
import { Cell, PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useFinancialCalculations } from '../utils/calculations';
import { getTodayArgentinaDate, calculateFinancialsForDate, daysBetween } from '../utils/financials';
import { Currency } from '../types';
import type { AppSettings } from '../types';
import HelpTooltip from './HelpTooltip';
import MaturitiesWaterfallChart from './MaturitiesWaterfallChart';
import LiquidityGapChart from './LiquidityGapChart';
import HistoricalEvolutionChart from './HistoricalEvolutionChart';
import FinancialRatiosWidget from './FinancialRatiosWidget';
import { useAppContext } from '../App';
import { ArrowsUpDownIcon, InformationCircleIcon, PrinterIcon } from './Icons';
import { generateExecutiveReport } from './ExecutiveReportService';

const KpiCard: React.FC<{ 
    title: string; 
    value: string; 
    baseValue?: string;
    helpText: string; 
    colorClass?: string; 
    isStressed?: boolean 
}> = ({ title, value, baseValue, helpText, colorClass = 'text-gray-800 dark:text-gray-100', isStressed }) => (
    <div className={`p-4 rounded-lg shadow-sm border transition-all duration-300 ${isStressed ? 'bg-primary/5 border-primary/30 dark:bg-accent-dm/5 dark:border-accent-dm/30' : 'bg-white dark:bg-gray-800 dark:border-gray-700'}`}>
        <h3 className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
            {title} <HelpTooltip text={helpText} />
        </h3>
        <div className="mt-2">
            {baseValue && isStressed ? (
                <div className="flex flex-col">
                    <p className="text-xs text-gray-400 line-through">{baseValue}</p>
                    <p className={`text-xl lg:text-2xl font-bold ${colorClass}`}>{value}</p>
                </div>
            ) : (
                <p className={`text-xl lg:text-2xl font-bold ${colorClass}`}>{value}</p>
            )}
        </div>
        {isStressed && <div className="mt-1 inline-block px-1.5 py-0.5 bg-primary/10 dark:bg-accent-dm/10 text-[9px] font-black text-primary dark:text-accent-dm rounded">SIMULADO</div>}
    </div>
);

const Widget: React.FC<{title: string, children: React.ReactNode, className?: string, headerAction?: React.ReactNode}> = ({title, children, className="", headerAction}) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 ${className}`}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">{title}</h3>
            {headerAction}
        </div>
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
        <ResponsiveContainer width="100%" height={220}>
            <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {data.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_PALETTE[index % PIE_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `USD ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', color: isDarkMode ? '#9ca3af' : '#4b5563' }} />
            </PieChart>
        </ResponsiveContainer>
    );
};

const GlobalDashboard: React.FC = () => {
    const { state } = useAppContext();
    const { exchangeRates, marketPriceHistory, companies, selectedCompanyId } = state;
    const { companyDebts, investmentGroups, banks, latestRate, appSettings, companyDebtCalculations, companyInvestments, companyGrainCollections, companyArbitrageOps } = useFinancialCalculations();
    const today = useMemo(() => getTodayArgentinaDate(), []);

    const [fxShift, setFxShift] = useState(0); 
    const [rateShift, setRateShift] = useState(0); 
    
    const isStressed = fxShift !== 0 || rateShift !== 0;
    const effectiveFXRate = useMemo(() => latestRate * (1 + fxShift / 100), [latestRate, fxShift]);

    const calculateStats = (fxRate: number, rateOffset: number) => {
        let totalDebtStockUSD = 0;
        let totalPrincipalArs = 0;
        let totalHedgedArs = 0;
        let weightedDaysToMaturity = 0;
        let totalPrincipalUSDForMaturity = 0;

        companyDebts.forEach(debt => {
            const stressedDebt = { ...debt, rate: debt.rate + (rateOffset / 100) };
            const financials = calculateFinancialsForDate(stressedDebt, today, appSettings);
            const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
            const accruedInterestNative = financials.accruedInterest;
            const valueUSD = (debt.currency === Currency.USD) ? (principalNative + accruedInterestNative) : (principalNative + accruedInterestNative) / fxRate;
            
            totalDebtStockUSD += valueUSD;

            // Para Ratios
            if (debt.currency === Currency.ARS) {
                totalPrincipalArs += principalNative;
                const hasHedge = (debt.linkedArbitrageOpIds || []).length > 0;
                if (hasHedge) {
                    totalHedgedArs += principalNative;
                }
            }

            const daysToDue = daysBetween(today, debt.dueDate);
            if (daysToDue > 0) {
                weightedDaysToMaturity += daysToDue * valueUSD;
                totalPrincipalUSDForMaturity += valueUSD;
            }
        });

        const totalInvestmentValueUSD = investmentGroups.reduce((sum, group) => {
            return sum + group.holdings.reduce((hSum, h) => {
                const valUSD = h.currency === Currency.USD ? h.marketValue : h.marketValue / fxRate;
                return hSum + valUSD;
            }, 0);
        }, 0);

        const totalCreditLimitUSD = banks.reduce((sum, bank) => {
            return sum + bank.creditLines.reduce((bankSum, line) => {
                return bankSum + (line.currency === Currency.USD ? line.amount : line.amount / fxRate);
            }, 0);
        }, 0);

        const totalUsedCreditUSD = companyDebts.reduce((sum, debt) => {
             const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
             return sum + (debt.currency === Currency.USD ? principalNative : principalNative / fxRate);
        }, 0);

        return {
            netPosition: totalInvestmentValueUSD - totalDebtStockUSD,
            totalDebtUSD: totalDebtStockUSD,
            totalInvestmentUSD: totalInvestmentValueUSD,
            availableCredit: totalCreditLimitUSD - totalUsedCreditUSD,
            hedgeCoverage: totalPrincipalArs > 0 ? (totalHedgedArs / totalPrincipalArs) * 100 : 100,
            avgMaturityDays: totalPrincipalUSDForMaturity > 0 ? weightedDaysToMaturity / totalPrincipalUSDForMaturity : 0
        };
    };

    const baseStats = useMemo(() => calculateStats(latestRate, 0), [latestRate, companyDebts, investmentGroups, banks, appSettings]);
    const stressedStats = useMemo(() => isStressed ? calculateStats(effectiveFXRate, rateShift) : baseStats, [isStressed, effectiveFXRate, rateShift, companyDebts, investmentGroups, banks, appSettings, baseStats]);

    const handlePrintReport = async () => {
        const companyName = companies.find(c => c.id === selectedCompanyId)?.name || 'Consolidado';
        await generateExecutiveReport({
            stats: baseStats,
            stressedStats: stressedStats,
            isStressed,
            today,
            companyName
        });
    };

    const waterfallData = useMemo(() => {
        const data: any[] = [{ month: 'Actual', cumulativeNet: stressedStats.netPosition, debt: 0, investment: 0, net: 0, inflow: 0, outflow: 0 }];
        let runningBalance = stressedStats.netPosition;

        for (let i = 0; i < 6; i++) {
            const targetMonth = new Date(today);
            targetMonth.setUTCMonth(today.getUTCMonth() + i);
            const monthKey = `${targetMonth.getUTCFullYear()}-${String(targetMonth.getUTCMonth() + 1).padStart(2, '0')}`;
            
            let debtMaturities = 0;
            companyDebts.forEach(d => {
                if (d.dueDate.startsWith(monthKey)) {
                    const stressedDebt = { ...d, rate: d.rate + (rateShift / 100) };
                    const financials = calculateFinancialsForDate(stressedDebt, new Date(d.dueDate + 'T00:00:00Z'), appSettings);
                    debtMaturities -= d.currency === Currency.USD ? financials.totalToRepay : financials.totalToRepay / effectiveFXRate;
                }
            });
            
            let investmentMaturities = 0;
            investmentGroups.flatMap(g => g.holdings).forEach(h => {
                if (h.maturityDate?.startsWith(monthKey)) {
                    investmentMaturities += h.currency === Currency.USD ? h.marketValue : h.marketValue / effectiveFXRate; 
                }
            });

            let grainInflows = 0;
            companyGrainCollections.forEach(c => {
                if (c.status === 'matched' && (c.actualCollectionDate || c.dueDate).startsWith(monthKey)) {
                    const netARS = c.finalNetAmount ?? (c.grossAmount * (1 - c.tentativeDeductionPercentage/100));
                    grainInflows += netARS / effectiveFXRate;
                }
            });
            
            const totalInflow = investmentMaturities + grainInflows;
            const totalOutflow = Math.abs(debtMaturities);
            const netFlow = totalInflow - totalOutflow;
            runningBalance += netFlow;
            
            data.push({
                month: monthKey,
                inflow: totalInflow,
                outflow: totalOutflow,
                net: netFlow,
                cumulativeNet: runningBalance
            });
        }
        return data;
    }, [stressedStats.netPosition, companyDebts, investmentGroups, companyGrainCollections, effectiveFXRate, rateShift, today, appSettings]);

    const liquidityAlerts = useMemo(() => {
        return waterfallData
            .filter(d => d.month !== 'Actual' && d.net < 0)
            .map(d => ({
                month: new Date(d.month + '-02').toLocaleDateString('es-AR', { month: 'short' }).toUpperCase(),
                gap: Math.abs(d.net)
            }));
    }, [waterfallData]);
    
    const debtBreakdownData = useMemo(() => {
        const byType: Record<string, number> = {};
        companyDebts.forEach(debt => {
            const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
            const debtStockUSD = debt.currency === Currency.USD ? principalNative : principalNative / effectiveFXRate;
            byType[debt.type] = (byType[debt.type] || 0) + debtStockUSD;
        });
        return Object.entries(byType).map(([name, value]) => ({ name, value }));
    }, [companyDebts, effectiveFXRate]);

    const historicalData = useMemo(() => {
        const data: any[] = [];
        const rangeInDays = 90;
        for (let i = rangeInDays; i >= 0; i--) {
            const date = new Date(today);
            date.setUTCDate(today.getUTCDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const rateForDay = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= dateStr)?.rate || latestRate;
            
            let hDebt = 0;
            companyDebts.forEach(debt => {
                if (debt.originationDate <= dateStr && (debt.actualCancellationDate || debt.dueDate) > dateStr) {
                    const financials = calculateFinancialsForDate(debt, date, appSettings);
                    const val = (debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount) + financials.accruedInterest;
                    hDebt += debt.currency === Currency.USD ? val : val / rateForDay;
                }
            });

            let hInv = 0;
            companyInvestments.forEach(inv => {
                const totalQty = inv.transactions.filter(t => t.date <= dateStr).reduce((acc, t) => acc + (t.type === 'Compra' ? t.quantity : -t.quantity), 0);
                if (totalQty > 0) {
                    const price = marketPriceHistory.find(s => s.date <= dateStr)?.prices[inv.instrumentName.toLowerCase()] || 0;
                    const val = totalQty * price;
                    hInv += inv.currency === Currency.USD ? val : val / rateForDay;
                }
            });

            data.push({ date: dateStr, "Deuda Total": hDebt, "Inversiones Totales": hInv, "Posición Neta": hInv - hDebt });
        }
        return data;
    }, [companyDebts, companyInvestments, exchangeRates, marketPriceHistory, appSettings, latestRate, today]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex-shrink-0 flex items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        Panel de Control Estratégico
                        {isStressed && <span className="animate-pulse px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded-full border border-amber-200">MODO SIMULACIÓN</span>}
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Simulación activa de riesgos cambiarios y financieros.</p>
                </div>
                <button 
                    onClick={handlePrintReport}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-4 py-2.5 rounded-lg shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
                >
                    <PrinterIcon className="w-4 h-4" />
                    REPORTE EJECUTIVO
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow max-w-4xl w-full">
                  <div className="bg-primary/5 dark:bg-accent-dm/5 p-3 rounded-lg border border-primary/20 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-gray-500">TC (CCL) Stress</span>
                          <span className="text-sm font-bold text-primary">${effectiveFXRate.toLocaleString('es-AR', {minimumFractionDigits: 1})}</span>
                      </div>
                      <input 
                        type="range" min="-20" max="100" step="5" value={fxShift} 
                        onChange={(e) => setFxShift(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[9px] font-bold text-gray-400">
                          <span>BASE</span>
                          <span className={fxShift !== 0 ? 'text-primary' : ''}>{fxShift > 0 ? `+${fxShift}%` : `${fxShift}%`}</span>
                          <span>+100%</span>
                      </div>
                  </div>

                  <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-lg border border-indigo-200 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-gray-500">Tasa (TNA) Offset</span>
                          <span className="text-sm font-bold text-indigo-600">{(rateShift / 100).toFixed(2)}% p.p.</span>
                      </div>
                      <input 
                        type="range" min="-500" max="5000" step="100" value={rateShift} 
                        onChange={(e) => setRateShift(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-[9px] font-bold text-gray-400">
                          <span>-5%</span>
                          <span className={rateShift !== 0 ? 'text-indigo-600' : ''}>{rateShift > 0 ? `+${rateShift/100}%` : `${rateShift/100}%`}</span>
                          <span>+50%</span>
                      </div>
                  </div>
              </div>
              
              {isStressed && (
                  <button onClick={() => {setFxShift(0); setRateShift(0);}} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-black hover:bg-red-100 transition-all">RESET</button>
              )}
          </div>

          {liquidityAlerts.length > 0 && (
            <div className="mt-4 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 flex items-center gap-3 overflow-x-auto">
                <div className="flex-shrink-0 flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs uppercase pl-2">
                    <InformationCircleIcon className="w-4 h-4" />
                    Baches de Liquidez:
                </div>
                <div className="flex gap-2">
                    {liquidityAlerts.map((alert, idx) => (
                        <div key={idx} className="bg-white dark:bg-gray-800 px-3 py-1 rounded-md border border-red-200 dark:border-red-700 text-[10px] font-bold shadow-sm whitespace-nowrap">
                            <span className="text-gray-500">{alert.month}:</span> <span className="text-red-600">USD {alert.gap.toLocaleString('es-AR', {maximumFractionDigits:0})}</span>
                        </div>
                    ))}
                </div>
            </div>
          )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
            title="Posición Neta" 
            value={`USD ${stressedStats.netPosition.toLocaleString('es-AR', {maximumFractionDigits:0})}`} 
            baseValue={isStressed ? `USD ${baseStats.netPosition.toLocaleString('es-AR', {maximumFractionDigits:0})}` : undefined}
            isStressed={isStressed}
            helpText="Muestra la solvencia neta proyectada. Se ve afectada por el stress de tipo de cambio y el incremento de tasas simulado." 
            colorClass={stressedStats.netPosition >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} 
        />
        <KpiCard 
            title="Deuda Stock (USD)" 
            value={`USD ${stressedStats.totalDebtUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}`} 
            baseValue={isStressed ? `USD ${baseStats.totalDebtUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}` : undefined}
            isStressed={isStressed}
            helpText="Capital adeudado + intereses devengados. Si suben las tasas simuladas, este valor aumenta por mayor devengamiento." 
        />
        <KpiCard 
            title="Inversiones (USD)" 
            value={`USD ${stressedStats.totalInvestmentUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}`} 
            baseValue={isStressed ? `USD ${baseStats.totalInvestmentUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}` : undefined}
            isStressed={isStressed}
            helpText="Valor de mercado de la cartera en USD según el TC simulado." 
        />
        <KpiCard 
            title="Crédito Disponible" 
            value={`USD ${stressedStats.availableCredit.toLocaleString('es-AR', {maximumFractionDigits:0})}`} 
            baseValue={isStressed ? `USD ${baseStats.availableCredit.toLocaleString('es-AR', {maximumFractionDigits:0})}` : undefined}
            isStressed={isStressed}
            helpText="Capacidad de endeudamiento remanente expresada en USD simulados." 
            colorClass="text-blue-600 dark:text-blue-400"
        />
      </div>

      <Widget title="Indicadores de Salud Financiera" className="w-full">
         <FinancialRatiosWidget stats={stressedStats} baseStats={baseStats} isStressed={isStressed} />
      </Widget>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Widget title="Análisis de Brechas (Income vs Expense)" className="lg:col-span-8">
             <LiquidityGapChart data={waterfallData.filter(d => d.month !== 'Actual')} appSettings={appSettings} />
          </Widget>
          <Widget title="Estructura de Pasivos" className="lg:col-span-4">
             <BreakdownPieChart data={debtBreakdownData} appSettings={appSettings} />
          </Widget>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Widget title="Evolución Histórica (90 días)">
             <HistoricalEvolutionChart data={historicalData} appSettings={appSettings} />
          </Widget>
          <Widget title="Proyección de Solvencia (Caja Acumulada)">
             <MaturitiesWaterfallChart data={waterfallData} appSettings={appSettings} />
          </Widget>
      </div>
    </div>
  );
};

export default GlobalDashboard;
