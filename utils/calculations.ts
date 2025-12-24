import { useMemo } from 'react';
// FIX: Import AppState from types.ts as it is no longer in App.tsx.
// FIX: Add GrainCollection and CollectionAdjustment to imports
import type { 
    Debt, Investment, DailyExchangeRate, FutureExchangeRateSnapshot, 
    MarketPriceSnapshot, DebtType, InvestmentType, Bank, Broker, AppSettings, ArbitrageOperation, AppState,
    GrainCollection, CollectionAdjustment,
    GroupedHolding,
    InvestmentGroup,
    BrokerDetail,
    Transaction
} from '../types';
import { Currency } from '../types';
import { getTodayArgentinaDate, calculateFinancialsForDate, calculateUsdAnalysisForDate, daysBetween, getInterpolatedRate, calculateCumulativeArbitragePnl } from './financials';
import { useAppContext } from '../App';

// --- Core Selectors ---

/**
 * Selects and filters the primary data based on the current view mode (individual/consolidated).
 */
// FIX: Update function signature and body to include grain collections and adjustments
export const selectFilteredData = (state: AppState): {
    companyDebts: Debt[];
    companyInvestments: Investment[];
    companyArbitrageOps: ArbitrageOperation[];
    companyGrainCollections: GrainCollection[];
    companyCollectionAdjustments: CollectionAdjustment[];
} => {
    const { viewMode, selectedCompanyId, selectedConsolidatedCompanyIds, debts, investments, arbitrageOperations, grainCollections, collectionAdjustments } = state;
    
    const companyIds = viewMode === 'individual'
        ? (selectedCompanyId ? [selectedCompanyId] : [])
        : selectedConsolidatedCompanyIds;

    const companyDebts = debts.filter(d => companyIds.includes(d.companyId));
    const companyInvestments = investments.filter(i => companyIds.includes(i.companyId));
    const companyArbitrageOps = arbitrageOperations.filter(a => companyIds.includes(a.companyId));
    const companyGrainCollections = grainCollections.filter(gc => companyIds.includes(gc.companyId));
    const companyCollectionAdjustments = collectionAdjustments.filter(ca => companyIds.includes(ca.companyId));

    return { companyDebts, companyInvestments, companyArbitrageOps, companyGrainCollections, companyCollectionAdjustments };
};


/**
 * Selects the most recent spot exchange rate and future rate snapshot for a given date.
 */
export const selectLatestRates = (
    exchangeRates: DailyExchangeRate[],
    futureRateHistory: FutureExchangeRateSnapshot[],
    date: Date
) => {
    const dateStr = date.toISOString().split('T')[0];
    const latestRate = [...exchangeRates]
        .sort((a, b) => b.date.localeCompare(a.date))
        .find(r => r.date <= dateStr)?.rate || 1;

    const latestFutureSnapshot = [...futureRateHistory]
        .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))
        .find(s => s.snapshotDate <= dateStr);
        
    return { latestRate, latestFutureSnapshot };
};

/**
 * Calculates and memoizes detailed financial metrics for a list of debts.
 */
export const selectDebtCalculations = (
    debts: Debt[],
    date: Date,
    settings: AppSettings,
    latestFutureSnapshot: FutureExchangeRateSnapshot | undefined,
    exchangeRates: DailyExchangeRate[],
    arbitrageOperations: ArbitrageOperation[]
): Map<string, { financials: ReturnType<typeof calculateFinancialsForDate>, usdAnalysis: ReturnType<typeof calculateUsdAnalysisForDate> | null }> => {
    const calculations = new Map();
    debts.forEach(debt => {
        const financials = calculateFinancialsForDate(debt, date, settings);
        const usdAnalysis = calculateUsdAnalysisForDate(debt, financials, latestFutureSnapshot, settings, exchangeRates, arbitrageOperations);
        calculations.set(debt.id, { financials, usdAnalysis });
    });
    return calculations;
};

/**
 * Splits debts into active and expired lists based on their status.
 */
export const selectActiveAndExpiredDebts = (debts: Debt[]) => {
    // Debts with status 'cancelled' are considered expired/archived.
    // All others ('active' or undefined for legacy data) are considered active.
    const activeDebts = debts.filter(d => d.status !== 'cancelled');
    const expiredDebts = debts.filter(d => d.status === 'cancelled');
    
    return { activeDebts, expiredDebts };
};

export const generateInvestmentGroups = (
    snapshotDate: Date,
    companyInvestments: Investment[],
    investmentTypes: InvestmentType[],
    marketPriceHistory: MarketPriceSnapshot[],
    exchangeRates: DailyExchangeRate[],
    appSettings: AppSettings,
    companyArbitrageOps: ArbitrageOperation[],
    brokers: Broker[],
    banks: Bank[],
    futureRateHistory: FutureExchangeRateSnapshot[]
) => {
    const { latestRate, latestFutureSnapshot } = selectLatestRates(exchangeRates, futureRateHistory, snapshotDate);

    const priceSnapshot = [...marketPriceHistory].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).find(s => new Date(s.date) <= snapshotDate);
    const currentMarketPricesValue = priceSnapshot ? priceSnapshot.prices : {};

    const allHoldings: GroupedHolding[] = [];

    companyInvestments.forEach(inv => {
        const investmentType = investmentTypes.find(it => it.id === inv.investmentTypeId);

        const transactionsUpToDate = inv.transactions.filter(t => new Date(t.date + 'T00:00:00Z') <= snapshotDate);

        // 1. Create a base holding for the instrument
        const holding: GroupedHolding = {
            instrumentId: inv.id,
            companyId: inv.companyId,
            instrumentName: inv.instrumentName,
            investmentTypeId: inv.investmentTypeId,
            investmentTypeName: investmentType?.name || 'N/D',
            currency: inv.currency,
            currencySubtypeId: inv.currencySubtypeId,
            brokerDetails: [],
            isFixedRate: false,
            maturityDate: undefined,
            marketPrice: 0,
            totalQuantity: 0,
            marketValue: 0,
            marketValueUSD: 0,
            remainingCostBasisUSD: 0,
            totalPL_Native: 0,
            totalPL_USD: 0,
            arbitragePL_Native: 0,
            arbitragePL_USD: 0,
            totalYieldPercent_Native: 0,
            totalYieldPercent_USD: 0,
            tea_Native: 0,
            tea_USD: 0,
            tea_total_USD: 0,
            isActive: false,
        };

        // 2. Group transactions by broker/bank within this holding
        const brokerDetailsMap = new Map<string, BrokerDetail>();

        transactionsUpToDate.forEach(tx => {
            const counterpartyKey = tx.brokerId ? `broker-${tx.brokerId}` : tx.bankId ? `bank-${tx.bankId}` : 'unknown';
            
            if (!brokerDetailsMap.has(counterpartyKey)) {
                 brokerDetailsMap.set(counterpartyKey, {
                    brokerId: tx.brokerId,
                    brokerName: tx.brokerId ? brokers.find(b => b.id === tx.brokerId)?.name : undefined,
                    bankId: tx.bankId,
                    bankName: tx.bankId ? banks.find(b => b.id === tx.bankId)?.name : undefined,
                    transactions: [], totalQuantity: 0, totalCostNative: 0, totalProceedsNative: 0,
                    totalCostUSD: 0, totalProceedsUSD: 0, avgBuyPriceNative: 0, avgBuyPriceUSD: 0,
                    realizedPL_Native: 0, realizedPL_USD: 0,
                });
            }
            brokerDetailsMap.get(counterpartyKey)!.transactions.push(tx);
        });

        holding.brokerDetails = Array.from(brokerDetailsMap.values());
        
        // 3. Calculate metrics for each broker detail
        holding.brokerDetails.forEach(bd => {
             bd.totalQuantity = bd.transactions.reduce((sum, tx) => sum + (tx.type === 'Compra' ? tx.quantity : -tx.quantity), 0);
        });

        // 4. Aggregate and calculate metrics for the whole instrument
        const allTransactions = transactionsUpToDate.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        holding.totalQuantity = allTransactions.reduce((sum, tx) => sum + (tx.type === 'Compra' ? tx.quantity : -tx.quantity), 0);
        
        const purchaseTxs = allTransactions.filter(t => t.type === 'Compra');
        holding.isFixedRate = purchaseTxs.length > 0 && purchaseTxs.every(t => t.isFixedRate && t.dueDate);

        holding.maturityDate = allTransactions.reduce((latest, t) => {
            if (!t.dueDate) return latest;
            return !latest || t.dueDate > latest ? t.dueDate : latest;
        }, undefined as string | undefined);
        
        if (holding.isFixedRate) {
            const quantityBought = purchaseTxs.reduce((sum, t) => sum + t.quantity, 0);
            const costBasisNative = purchaseTxs.reduce((sum, t) => sum + t.price * t.quantity, 0);
            const avgBuyPrice = quantityBought > 0 ? costBasisNative / quantityBought : 0;
            const remainingCostBasis = holding.totalQuantity * avgBuyPrice;
            
            const accruedInterestOnPurchases = purchaseTxs.reduce((total, t) => {
                const elapsedDays = daysBetween(t.date, snapshotDate);
                const principal = t.quantity * t.price;
                const accrued = principal * (t.tea || 0) / 100 / appSettings.annualRateBasis * Math.max(0, elapsedDays);
                return total + accrued;
            }, 0);
            
            const proportionRemaining = quantityBought > 0 ? holding.totalQuantity / quantityBought : 0;
            const accruedInterestOnRemaining = accruedInterestOnPurchases * proportionRemaining;
            
            holding.marketValue = remainingCostBasis + accruedInterestOnRemaining;
        } else {
            holding.marketPrice = currentMarketPricesValue[holding.instrumentName.toLowerCase()] || 0;
            holding.marketValue = holding.totalQuantity * holding.marketPrice;
        }

        holding.marketValueUSD = holding.currency === Currency.USD ? holding.marketValue : holding.marketValue / latestRate;

        // --- P&L Calculation (Instrument Level) ---
        const purchaseLots: { quantity: number; costUSD: number; date: Date }[] = [];
        let realizedPL_USD = 0;
        const investedCapitalTimeline: { date: Date; capitalUSD: number }[] = [];

        allTransactions.forEach(tx => {
            const txDate = new Date(tx.date + 'T00:00:00Z');
            const costNative = tx.quantity * tx.price;
            const valueUSD = tx.exchangeRate > 0 ? costNative / tx.exchangeRate : 0;
            let currentCapitalUSD = investedCapitalTimeline.length > 0 ? investedCapitalTimeline[investedCapitalTimeline.length - 1].capitalUSD : 0;

            if (tx.type === 'Compra') {
                purchaseLots.push({ quantity: tx.quantity, costUSD: valueUSD, date: txDate });
                currentCapitalUSD += valueUSD;
            } else { // Venta
                let quantityToSell = tx.quantity;
                let costOfGoodsSoldUSD = 0;

                while (quantityToSell > 0 && purchaseLots.length > 0) {
                    const lot = purchaseLots[0];
                    const sellableQty = Math.min(quantityToSell, lot.quantity);
                    const costOfPortion = (lot.costUSD / lot.quantity) * sellableQty;
                    
                    costOfGoodsSoldUSD += costOfPortion;
                    lot.quantity -= sellableQty;
                    lot.costUSD -= costOfPortion;
                    quantityToSell -= sellableQty;

                    if (lot.quantity < 1e-9) {
                        purchaseLots.shift();
                    }
                }
                realizedPL_USD += valueUSD - costOfGoodsSoldUSD;
                currentCapitalUSD -= costOfGoodsSoldUSD;
            }
            investedCapitalTimeline.push({ date: txDate, capitalUSD: currentCapitalUSD });
        });
        
        holding.remainingCostBasisUSD = purchaseLots.reduce((sum, lot) => sum + lot.costUSD, 0);
        const unrealizedPL_USD = holding.marketValueUSD - holding.remainingCostBasisUSD;
        holding.totalPL_USD = realizedPL_USD + unrealizedPL_USD;
        
        // --- TEA Calculation ---
        if (investedCapitalTimeline.length > 0) {
            const firstTxDate = investedCapitalTimeline[0].date;
            const totalDurationDays = daysBetween(firstTxDate, snapshotDate);

            if (totalDurationDays > 0) {
                let capitalTimeProduct = 0;
                let lastDate = firstTxDate;
                let lastCapital = 0;
                
                investedCapitalTimeline.forEach(entry => {
                    const periodDays = daysBetween(lastDate, entry.date);
                    capitalTimeProduct += lastCapital * periodDays;
                    lastCapital = entry.capitalUSD;
                    lastDate = entry.date;
                });
                capitalTimeProduct += lastCapital * daysBetween(lastDate, snapshotDate);

                const averageInvestedCapitalUSD = capitalTimeProduct / totalDurationDays;

                if (averageInvestedCapitalUSD > 1e-9) { // Avoid division by zero
                    // TEA (Instrument Only)
                    const returnRate = holding.totalPL_USD / averageInvestedCapitalUSD;
                    holding.tea_USD = (returnRate / totalDurationDays) * 365 * 100;
                    
                    const {pnlArs, pnlUsd} = calculateCumulativeArbitragePnl(inv, snapshotDate, companyArbitrageOps, exchangeRates, futureRateHistory);
                    holding.arbitragePL_USD = pnlUsd;
                    holding.arbitragePL_Native = pnlArs;
                    
                    // TEA (Total Strategy)
                    const totalPLWithArb_USD = holding.totalPL_USD + holding.arbitragePL_USD;
                    const returnRateWithArb = totalPLWithArb_USD / averageInvestedCapitalUSD;
                    holding.tea_total_USD = (returnRateWithArb / totalDurationDays) * 365 * 100;
                }
            }
        }
        
        const hasMatured = holding.maturityDate && new Date(holding.maturityDate + 'T00:00:00Z') < snapshotDate;
        holding.isActive = holding.totalQuantity > 0.00001 && !hasMatured;
        
        allHoldings.push(holding);
    });

    const activeHoldings = allHoldings.filter(h => h.isActive);
    const expiredHoldingsValue = allHoldings.filter(h => !h.isActive);
    
    const investmentGroupsMap = new Map<string, InvestmentGroup>();
    activeHoldings.forEach(h => {
        if (!investmentGroupsMap.has(h.investmentTypeName)) {
            investmentGroupsMap.set(h.investmentTypeName, { groupName: h.investmentTypeName, holdings: [], totalMarketValueUSD: 0 });
        }
        const group = investmentGroupsMap.get(h.investmentTypeName)!;
        group.holdings.push(h);
        group.totalMarketValueUSD += h.marketValueUSD;
    });
    
    investmentGroupsMap.forEach(group => {
        group.holdings.sort((a, b) => a.instrumentName.localeCompare(b.instrumentName));
    });
    
    return { expiredHoldings: expiredHoldingsValue, currentMarketPrices: currentMarketPricesValue, investmentGroups: Array.from(investmentGroupsMap.values()) };
};


// --- Hooks for Component Consumption ---

/**
 * A comprehensive hook that provides all derived financial data for the application.
 * It centralizes filtering and calculations, ensuring consistency and performance.
 */
export const useFinancialCalculations = () => {
    const { state } = useAppContext();
    const { 
        debts, investments, exchangeRates, futureRateHistory, marketPriceHistory, 
        appSettings, debtTypes, investmentTypes, banks, brokers, arbitrageOperations, holidays, cashAccounts,
        currencies
    } = state;

    const today = useMemo(() => getTodayArgentinaDate(), []);

    // FIX: Destructure new properties from selectFilteredData
    const { companyDebts, companyInvestments, companyArbitrageOps, companyGrainCollections, companyCollectionAdjustments } = useMemo(() => selectFilteredData(state), [state]);
    
    const { latestRate, latestFutureSnapshot } = useMemo(() => selectLatestRates(exchangeRates, futureRateHistory, today), [exchangeRates, futureRateHistory, today]);

    const debtCalculations = useMemo(() => 
        selectDebtCalculations(debts, today, appSettings, latestFutureSnapshot, exchangeRates, arbitrageOperations),
        [debts, today, appSettings, latestFutureSnapshot, exchangeRates, arbitrageOperations]
    );
    
    const companyDebtCalculations = useMemo(() => 
        selectDebtCalculations(companyDebts, today, appSettings, latestFutureSnapshot, exchangeRates, companyArbitrageOps),
        [companyDebts, today, appSettings, latestFutureSnapshot, exchangeRates, companyArbitrageOps]
    );

    const historicalDebtLog = useMemo(() => {
        if (debts.length === 0 || exchangeRates.length === 0) return [];
        const log: any[] = [];
        const allDates = new Set<string>(exchangeRates.map(r => r.date));
        debts.forEach(d => {
            allDates.add(d.originationDate);
            allDates.add(d.dueDate);
        });

        const sortedDates = Array.from(allDates).sort();
        if (sortedDates.length === 0) return [];

        // FIX: Explicitly parse dates as UTC to avoid timezone inconsistencies and prevent potential errors.
        const firstDate = new Date(sortedDates[0] + 'T00:00:00Z');
        const lastDate = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00Z');

        for (let d = firstDate; d <= lastDate; d.setUTCDate(d.getUTCDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const rateForDay = [...exchangeRates].reverse().find(r => r.date <= dateStr)?.rate;
            if (!rateForDay) continue;

            const snapshotForDay = [...futureRateHistory].reverse().find(s => s.snapshotDate <= dateStr);
            const activeDebtsOnDate = debts.filter(debt => debt.originationDate <= dateStr && dateStr <= debt.dueDate);

            if (activeDebtsOnDate.length === 0) continue;

            let totalDebtStockUSD = 0;
            let totalWeightedCftNumerator = 0;
            let totalPrincipalUSD = 0;
            const byType: Record<string, { stock: number; weightedCftNumerator: number; principalUSD: number }> = {};

            activeDebtsOnDate.forEach(debt => {
                const financials = calculateFinancialsForDate(debt, d, appSettings);
                const usdAnalysis = calculateUsdAnalysisForDate(debt, financials, snapshotForDay, appSettings, exchangeRates, arbitrageOperations);
                const debtStockUSD = debt.currency === Currency.USD ? debt.amount : debt.amount / rateForDay;
                const principalUSD = debt.currency === Currency.USD ? debt.amount : debt.amount / debt.exchangeRateAtOrigination;

                totalDebtStockUSD += debtStockUSD;
                let cftInUsd: number | null = null;
                if (debt.currency === Currency.USD) cftInUsd = financials.cft;
                else if (usdAnalysis?.usd_cft) cftInUsd = usdAnalysis.usd_cft;

                if (cftInUsd !== null && isFinite(cftInUsd)) {
                    totalWeightedCftNumerator += cftInUsd * principalUSD;
                    totalPrincipalUSD += principalUSD;
                }

                if (!byType[debt.type]) byType[debt.type] = { stock: 0, weightedCftNumerator: 0, principalUSD: 0 };
                byType[debt.type].stock += debtStockUSD;
                if (cftInUsd !== null && isFinite(cftInUsd)) {
                    byType[debt.type].weightedCftNumerator += cftInUsd * principalUSD;
                    byType[debt.type].principalUSD += principalUSD;
                }
            });

            const logEntry: any = {
                date: dateStr,
                totalDebtStockUSD,
                overallWeightedCft: totalPrincipalUSD > 0 ? totalWeightedCftNumerator / totalPrincipalUSD : 0,
            };
            
            debtTypes.forEach(dt => {
                const data = byType[dt.name];
                if (data) {
                    logEntry[dt.name] = {
                        stock: data.stock,
                        weightedCft: data.principalUSD > 0 ? data.weightedCftNumerator / data.principalUSD : 0
                    };
                }
            });

            log.push(logEntry);
        }
        return log;
    }, [debts, exchangeRates, futureRateHistory, appSettings, debtTypes, arbitrageOperations]);

    const { investmentGroups, expiredHoldings, currentMarketPrices } = useMemo(() => {
        return generateInvestmentGroups(
            today,
            companyInvestments,
            investmentTypes,
            marketPriceHistory,
            exchangeRates,
            appSettings,
            companyArbitrageOps,
            brokers,
            banks,
            futureRateHistory
        );
    }, [today, companyInvestments, investmentTypes, marketPriceHistory, exchangeRates, appSettings, companyArbitrageOps, brokers, banks, futureRateHistory]);


    return {
        // Raw State (for convenience)
        ...state,
        
        // Filtered Data
        companyDebts,
        companyInvestments,
        companyArbitrageOps,
        // FIX: Return new properties
        companyGrainCollections,
        companyCollectionAdjustments,

        // Rates
        latestRate,
        latestFutureSnapshot,

        // Calculations
        debtCalculations,
        companyDebtCalculations,
        
        // Derived Data for UI
        historicalDebtLog,
        investmentGroups,
        expiredHoldings,
        currentMarketPrices,
        // For CashFlow
        holidays,
        cashAccounts,
        currencies,
    };
};