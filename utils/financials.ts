import type { Debt, Cost, FutureExchangeRateSnapshot, DailyExchangeRate, AppSettings, ArbitrageOperation, Investment, InvestmentType, GroupedHolding, MarketPriceSnapshot, Transaction } from '../types';
import { Currency } from '../types';

export const getTodayArgentinaDate = (): Date => {
  try {
    const parts = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).split('-');
    return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  } catch (e) {
    console.error("Failed to get Argentina date, falling back to local date", e);
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    return today;
  }
};

// A helper to parse date strings or Date objects into a UTC-based Date object without time.
// This prevents timezone-related off-by-one errors.
const parseToUtcDate = (date: string | Date): Date | null => {
    if (date instanceof Date) {
        // If it's already a Date object, trust its UTC components
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
    if (typeof date === 'string') {
        // For "YYYY-MM-DD" strings, parse as UTC
        const parts = date.split('-').map(Number);
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        }
    }
    return null;
}

export const daysBetween = (date1: string | Date, date2: string | Date): number => {
    // This function calculates the number of full days between two dates (e.g., nights).
    // The start date is inclusive, the end date is exclusive.
    // Example: daysBetween('2025-01-02', '2025-01-10') returns 8.
    if (!date1 || !date2) return 0;

    const d1 = parseToUtcDate(date1);
    const d2 = parseToUtcDate(date2);

    if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;

    const diff = d2.getTime() - d1.getTime();
    
    return Math.floor(diff / (1000 * 3600 * 24));
};

export const calculateBusinessDays = (startDateStr: string, endDateStr: string, holidays: string[]): number => {
    if (!startDateStr || !endDateStr) return 0;

    const start = new Date(startDateStr + 'T00:00:00Z');
    const end = new Date(endDateStr + 'T00:00:00Z');

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    
    let count = 0;
    const holidaySet = new Set(holidays);
    const currentDate = new Date(start);
    
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);

    while (currentDate <= end) {
        const dayOfWeek = currentDate.getUTCDay();
        const dateStr = currentDate.toISOString().split('T')[0];

        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
            count++;
        }
        
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    return count;
};


export const getInterpolatedRate = (
    targetDate: Date,
    snapshot: FutureExchangeRateSnapshot,
    referenceSpotRate: number
): number | null => {
    const targetTime = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());

    if (!snapshot || !snapshot.rates) return null;

    // Dates in snapshot are 'YYYY-MM-DD' strings, treat as UTC
    const sortedFutureRates = [...snapshot.rates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const spotAnchor = { date: snapshot.snapshotDate, rate: referenceSpotRate };
    const combinedRates = [spotAnchor, ...sortedFutureRates];

    let rateBefore: { date: string, rate: number } | null = null;
    let rateAfter: { date: string, rate: number } | null = null;

    for (const rate of combinedRates) {
        const rateDateParts = rate.date.split('-').map(Number);
        const rateTime = Date.UTC(rateDateParts[0], rateDateParts[1] - 1, rateDateParts[2]);

        if (rateTime <= targetTime) {
            rateBefore = rate;
        } else {
            rateAfter = rate;
            break;
        }
    }
    
    if (rateBefore) {
        const rateBeforeDateParts = rateBefore.date.split('-').map(Number);
        if (Date.UTC(rateBeforeDateParts[0], rateBeforeDateParts[1] - 1, rateBeforeDateParts[2]) === targetTime) {
            return rateBefore.rate;
        }
    }

    if (rateBefore && rateAfter) {
        const beforeDateParts = rateBefore.date.split('-').map(Number);
        const afterDateParts = rateAfter.date.split('-').map(Number);
        const beforeTime = Date.UTC(beforeDateParts[0], beforeDateParts[1] - 1, beforeDateParts[2]);
        const afterTime = Date.UTC(afterDateParts[0], afterDateParts[1] - 1, afterDateParts[2]);
        
        const timeDiffTotal = afterTime - beforeTime;
        if (timeDiffTotal > 0) {
            const timeDiffTarget = targetTime - beforeTime;
            const rateDiff = rateAfter.rate - rateBefore.rate;
            return rateBefore.rate + (rateDiff * (timeDiffTarget / timeDiffTotal));
        }
        return rateBefore.rate;
    }

    if (rateBefore && !rateAfter) { // Extrapolation case
        if (combinedRates.length >= 2) {
            const lastPoint = combinedRates[combinedRates.length - 1];
            const secondLastPoint = combinedRates[combinedRates.length - 2];
            
            const lastDateParts = lastPoint.date.split('-').map(Number);
            const secondLastDateParts = secondLastPoint.date.split('-').map(Number);
            
            const lastTime = Date.UTC(lastDateParts[0], lastDateParts[1] - 1, lastDateParts[2]);
            const secondLastTime = Date.UTC(secondLastDateParts[0], secondLastDateParts[1] - 1, secondLastDateParts[2]);
            const timeDiff = lastTime - secondLastTime;

            if (timeDiff > 0) {
                const rateDiff = lastPoint.rate - secondLastPoint.rate;
                const dailyRateChange = rateDiff / timeDiff;
                const timeDiffFromLast = targetTime - lastTime;
                return lastPoint.rate + (dailyRateChange * timeDiffFromLast);
            }
        }
        if (rateBefore.date !== spotAnchor.date) {
            return rateBefore.rate;
        }
        
        return null;
    }
    
    return null;
};


export const calculateFinancialsForDate = (debt: Debt, currentDate: Date, settings: AppSettings) => {
    // 1. Determine effective end date for calculation
    const isCancelled = debt.status === 'cancelled';
    const cancellationDateObj = isCancelled && debt.actualCancellationDate ? new Date(debt.actualCancellationDate + 'T00:00:00Z') : null;
    const effectiveEndDate = cancellationDateObj || currentDate;

    // 2. Normalize costs and basic date calculations
    const commission_raw = debt.commission;
    const stamps_raw = debt.stamps;
    const marketRights_raw = debt.marketRights;
    
    const originationDateObj = new Date(debt.originationDate + 'T00:00:00Z');
    const dueDateObj = new Date(debt.dueDate + 'T00:00:00Z');

    const termForCFT = daysBetween(originationDateObj, cancellationDateObj || dueDateObj);
    
    const mode = debt.calculationMode || 'presentValue';
    const annualRateBasis = settings.annualRateBasis;

    const defaultReturn = {
        cft: 0, ted: 0, 
        commissionAmount: 0, stampsAmount: 0, marketRightsAmount: 0,
        upfrontCosts: 0, maturityCosts: 0,
        totalInterest: 0, netDisbursed: 0, totalToRepay: 0, accruedInterest: 0,
        totalPunitiveInterest: 0,
    };

    // This is the base amount for calculating percentage-based costs and punitive interest.
    // For both loans (PV) and discounts (FV), costs are typically a percentage of the nominal/face value.
    const costAndPunitiveBase = debt.amount; 

    const getAmount = (cost: Cost | number | undefined): number => {
        if (!cost) return 0;
        
        if (typeof cost === 'number') {
            if (cost > 1000) { 
                console.warn(`Corrupt legacy cost data detected (large number: ${cost}). Treating cost as 0.`, { debtId: debt.id, costValue: cost });
                return 0;
            }
            return costAndPunitiveBase * (cost / 100); // Legacy costs are percentages
        }

        if (typeof cost === 'object' && cost !== null) {
            if ('id' in cost && 'companyId' in cost && 'dueDate' in cost) {
                console.warn("Corrupt cost data detected in financials (looks like a Debt object). Treating cost as 0.", { debtId: debt.id, costObject: cost });
                return 0;
            }

            const value = 'value' in cost && typeof (cost as any).value === 'number'
                ? (cost as any).value
                : 'amount' in cost && typeof (cost as any).amount === 'number'
                  ? (cost as any).amount
                  : null;
            
            if (value === null) {
                return 0;
            }

            if ((cost as any).type === 'percentage') {
                return costAndPunitiveBase * (value / 100);
            }
            return value;
        }

        return 0;
    };

    const getTiming = (cost: Cost | number | undefined, defaultTiming: 'V' | 'A'): 'V' | 'A' => {
        if (typeof cost === 'number') return 'V'; // Legacy commission/stamps were Vencido
        if (typeof cost === 'object' && cost.timing) return cost.timing;
        return defaultTiming;
    };

    const commissionAmount = getAmount(commission_raw);
    const stampsAmount = getAmount(stamps_raw);
    const marketRightsAmount = getAmount(marketRights_raw);

    const commissionTiming = getTiming(commission_raw, 'A');
    const stampsTiming = getTiming(stamps_raw, 'A');
    const marketRightsTiming = getTiming(marketRights_raw, 'A');

    const upfrontCosts = (commissionTiming === 'A' ? commissionAmount : 0)
        + (stampsTiming === 'A' ? stampsAmount : 0)
        + (marketRightsTiming === 'A' ? marketRightsAmount : 0);
        
    const maturityCosts = (commissionTiming === 'V' ? commissionAmount : 0)
        + (stampsTiming === 'V' ? stampsAmount : 0)
        + (marketRightsTiming === 'V' ? marketRightsAmount : 0);

    // 3. Calculate Net Disbursed (Cash received at T=0)
    let netDisbursed: number;
    const brutoRecibido = debt.netAmountReceived || 0;
    if (mode === 'presentValue') {
        netDisbursed = debt.amount - upfrontCosts;
    } else { // futureValue
        netDisbursed = brutoRecibido - upfrontCosts;
    }
    
    if (netDisbursed <= 0 && mode === 'presentValue') { // For FV, netDisbursed can be negative if costs are high
      return defaultReturn;
    }

    // 4. Calculate Interest & Total To Repay
    const tnaDecimal = debt.rate / 100;
    const punitiveTnaDecimal = (debt.punitiveInterestRate || 0) / 100;
    
    const daysForNormalInterest = daysBetween(originationDateObj, cancellationDateObj || dueDateObj);
    const daysPastDueDate = cancellationDateObj && dueDateObj < cancellationDateObj ? daysBetween(dueDateObj, cancellationDateObj) : 0;
    
    const totalPunitiveInterest = costAndPunitiveBase * (punitiveTnaDecimal / annualRateBasis) * daysPastDueDate;
    
    const totalCompensatoryInterest = (mode === 'presentValue') 
        ? debt.amount * (tnaDecimal / annualRateBasis) * daysForNormalInterest
        : (debt.amount - brutoRecibido);

    let totalToRepay: number;
    let totalInterest = totalCompensatoryInterest + totalPunitiveInterest;
    
    if (mode === 'presentValue') {
        totalToRepay = debt.amount + totalInterest + maturityCosts;
    } else { // futureValue
        totalToRepay = debt.amount + totalPunitiveInterest + maturityCosts;
    }

    // Accrued interest up to snapshot date (currentDate)
    let accruedInterest = 0;
    const daysActiveForAccrual = daysBetween(originationDateObj, currentDate > dueDateObj ? dueDateObj : currentDate);
    if (daysActiveForAccrual > 0) {
        if (mode === 'presentValue') {
            accruedInterest = debt.amount * (tnaDecimal / annualRateBasis) * daysActiveForAccrual;
        } else {
            // For future value, accrued interest is the "earned" portion of the total discount.
            const totalTerm = daysBetween(originationDateObj, dueDateObj);
            if (totalTerm > 0) {
                // Here, compensatory interest is the total financial cost before penalties
                const totalFinancingCost = totalCompensatoryInterest;
                accruedInterest = (totalFinancingCost / totalTerm) * daysActiveForAccrual;
            }
        }
    }
    
    const daysOverdueForAccrual = currentDate > dueDateObj ? daysBetween(dueDateObj, currentDate) : 0;
    const accruedPunitive = costAndPunitiveBase * (punitiveTnaDecimal / annualRateBasis) * daysOverdueForAccrual;
    accruedInterest += accruedPunitive;

    // --- Overrides for Cancelled Debts ---
    let finalTotalInterest = totalInterest;
    let finalTotalToRepay = totalToRepay;

    if (isCancelled) {
        if (debt.paidInterestAmount !== undefined && debt.paidInterestAmount !== null) {
            const originalTotalInterest = totalInterest;
            const interestAdjustment = debt.paidInterestAmount - originalTotalInterest;
            finalTotalToRepay += interestAdjustment;
            finalTotalInterest = debt.paidInterestAmount;
        }

        if (debt.cancellationPenalty) {
            finalTotalToRepay += debt.cancellationPenalty;
        }
    }
    
    // Recalculate CFT and TED with the final repayment amount
    let finalCft = 0;
    let finalTed = 0;
    if (netDisbursed > 0 && termForCFT > 0) {
      const finalTedDecimal = (finalTotalToRepay / netDisbursed) - 1;
      finalTed = finalTedDecimal * 100;
      finalCft = (finalTedDecimal / termForCFT) * annualRateBasis * 100;
    }
    
    // If the snapshot date is on or after the cancellation, the accrued interest is the final total interest.
    let finalAccruedInterest = accruedInterest;
    if (isCancelled && cancellationDateObj && currentDate >= cancellationDateObj) {
        finalAccruedInterest = finalTotalInterest;
    }

    return { 
        cft: finalCft, 
        ted: finalTed, 
        commissionAmount, stampsAmount, marketRightsAmount, 
        upfrontCosts, maturityCosts,
        totalInterest: finalTotalInterest, 
        netDisbursed, 
        totalToRepay: finalTotalToRepay, 
        accruedInterest: finalAccruedInterest, 
        totalPunitiveInterest 
    };
};


export const calculateUsdAnalysisForDate = (
    debt: Debt,
    financials: ReturnType<typeof calculateFinancialsForDate>,
    futureRateSnapshot: FutureExchangeRateSnapshot | undefined,
    settings: AppSettings,
    spotRates?: DailyExchangeRate[],
    arbitrageOperations?: ArbitrageOperation[],
) => {
    if (debt.currency !== Currency.ARS) return null;

    const { netDisbursed, totalToRepay } = financials;
    
    const termEndDate = debt.status === 'cancelled' && debt.actualCancellationDate
        ? debt.actualCancellationDate
        : debt.dueDate;

    const termInDays = daysBetween(debt.originationDate, termEndDate);
    if (termInDays <= 0) return null;

    let projectedLoanDueDateRate: number | null = null;
    let analysisType: 'Sintético' | 'Implícito' | 'Real' = 'Implícito';

    const originationSpotRate = debt.exchangeRateAtOrigination;
    
    const linkedArbitrage = (debt.linkedArbitrageOpIds && arbitrageOperations)
        ? arbitrageOperations.find(op => debt.linkedArbitrageOpIds?.includes(op.id))
        : undefined;

    // --- START OF MODIFICATION ---
    // Priority 1: A linked hedge determines the rate.
    if (linkedArbitrage) {
        projectedLoanDueDateRate = linkedArbitrage.arbitrageRate;
        analysisType = 'Sintético';
    } 
    // Priority 2: A cancelled ARS debt (without a hedge) uses the historical spot rate.
    else if (debt.status === 'cancelled' && debt.actualCancellationDate && spotRates) {
        const cancellationSpotRate = [...spotRates]
            .sort((a, b) => b.date.localeCompare(a.date))
            .find(r => r.date <= debt.actualCancellationDate!)?.rate;
        
        if (cancellationSpotRate) {
            projectedLoanDueDateRate = cancellationSpotRate;
            analysisType = 'Real';
        }
    } 
    // Priority 3: An active ARS debt uses future rate interpolation.
    else if (futureRateSnapshot) {
        const dueDateParts = debt.dueDate.split('-').map(Number);
        const dueDateUTC = new Date(Date.UTC(dueDateParts[0], dueDateParts[1] - 1, dueDateParts[2]));
        projectedLoanDueDateRate = getInterpolatedRate(dueDateUTC, futureRateSnapshot, originationSpotRate);
        // analysisType is already 'Implícito' by default, which is correct.
    }
    // --- END OF MODIFICATION ---

    if (projectedLoanDueDateRate === null) return null;

    const usdReceived = netDisbursed / originationSpotRate;
    const usdToRepay = totalToRepay / projectedLoanDueDateRate;

    if (usdReceived <= 0) return null;

    const usdDirectRate = ((usdToRepay / usdReceived) - 1) * 100;
    const usd_cft = (usdDirectRate / termInDays) * settings.annualRateBasis;

    return {
        projectedLoanDueDateRate,
        analysisType,
        usdReceived,
        usdToRepay,
        usdInterest: usdToRepay - usdReceived,
        usdDirectRate,
        usd_cft,
    };
};
// FIX: Moved and exported calculatePortfolioSnapshot function to be shared across modules.
export const calculatePortfolioSnapshot = (
    snapshotDate: Date,
    investments: Investment[],
    marketPriceHistory: MarketPriceSnapshot[],
    exchangeRates: DailyExchangeRate[],
    investmentTypes: InvestmentType[],
    appSettings: AppSettings
) => {
    const dateStr = snapshotDate.toISOString().split('T')[0];
    const rateForDay = [...exchangeRates].sort((a, b) => b.date.localeCompare(a.date)).find(r => r.date <= dateStr)?.rate || 1;
    const priceSnapshot = [...marketPriceHistory].sort((a, b) => b.date.localeCompare(a.date)).find(s => s.date <= dateStr);
    const marketPrices = priceSnapshot ? priceSnapshot.prices : {};

    const holdings: GroupedHolding[] = [];

    investments.forEach(inv => {
        const transactionsUpToDate = inv.transactions.filter(t => new Date(t.date + 'T00:00:00Z') <= snapshotDate);
        if (transactionsUpToDate.length === 0) return;

        const totalQuantity = transactionsUpToDate.reduce((sum, tx) => sum + (tx.type === 'Compra' ? tx.quantity : -tx.quantity), 0);
        if (totalQuantity <= 1e-9) return;

        const purchaseTxs = transactionsUpToDate.filter(t => t.type === 'Compra');
        const isFixedRate = purchaseTxs.length > 0 && purchaseTxs.every(t => t.isFixedRate);
        
        let marketValueNative = 0;
        if(isFixedRate) {
            const quantityBought = purchaseTxs.reduce((sum, t) => sum + t.quantity, 0);
            const costBasisNative = purchaseTxs.reduce((sum, t) => sum + t.price * t.quantity, 0);
            const avgBuyPrice = quantityBought > 0 ? costBasisNative / quantityBought : 0;
            const remainingCostBasis = totalQuantity * avgBuyPrice;

            const accruedInterestOnPurchases = purchaseTxs.reduce((total, t) => {
                const elapsedDays = daysBetween(t.date, snapshotDate);
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

        const holding: GroupedHolding = {
            instrumentId: inv.id,
            // FIX: Add missing 'companyId' property to the 'holding' object.
            companyId: inv.companyId,
            instrumentName: inv.instrumentName,
            investmentTypeId: inv.investmentTypeId,
            investmentTypeName: investmentTypes.find(it => it.id === inv.investmentTypeId)?.name || 'N/D',
            currency: inv.currency,
            totalQuantity,
            marketValue: marketValueNative,
            marketValueUSD: inv.currency === Currency.USD ? marketValueNative : marketValueNative / rateForDay,
            // These fields are not calculated for snapshot as they are performance-related
            brokerDetails: [], isFixedRate: false, marketPrice: 0, remainingCostBasisUSD: 0,
            totalPL_Native: 0, totalPL_USD: 0, arbitragePL_Native: 0, arbitragePL_USD: 0,
            totalYieldPercent_Native: 0, totalYieldPercent_USD: 0, tea_Native: 0, tea_USD: 0, tea_total_USD: 0, isActive: true
        };
        holdings.push(holding);
    });

    const totalValueUSD = holdings.reduce((sum, h) => sum + h.marketValueUSD, 0);
    return { holdings, totalValueUSD };
};

export const calculateCumulativeArbitragePnl = (
    investment: Investment,
    snapshotDate: Date,
    allArbitrageOps: ArbitrageOperation[],
    allExchangeRates: DailyExchangeRate[],
    allFutureRateHistory: FutureExchangeRateSnapshot[]
): { pnlArs: number; pnlUsd: number } => {
    const snapshotDateStr = snapshotDate.toISOString().split('T')[0];

    const snapshotForDate = [...allFutureRateHistory]
        .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))
        .find(s => s.snapshotDate <= snapshotDateStr);
    const spotRateForSnapshot = [...allExchangeRates]
        .sort((a, b) => b.date.localeCompare(a.date))
        .find(r => r.date <= snapshotDateStr)?.rate;

    let totalPnlArs = 0;
    let totalPnlUsd = 0;

    const transactionIds = new Set(investment.transactions.map(tx => tx.id));
    const linkedOps = allArbitrageOps.filter(op => op.linkedTransactionId && transactionIds.has(op.linkedTransactionId));

    for (const op of linkedOps) {
        const closingDateStr = op.cancellationDate || op.arbitrageDate;

        if (closingDateStr <= snapshotDateStr) { // Realized P&L
            const spotOnClose = [...allExchangeRates]
                .sort((a, b) => b.date.localeCompare(a.date))
                .find(r => r.date <= closingDateStr)?.rate;

            if (!spotOnClose) continue;

            const closingRate = op.cancellationRate || spotOnClose; // Simplified assumption for realized
            const pnlArs = (op.position === 'Vendida' ? op.arbitrageRate - closingRate : closingRate - op.arbitrageRate) * op.usdAmount;
            const pnlUsd = pnlArs / spotOnClose;

            totalPnlArs += pnlArs;
            totalPnlUsd += pnlUsd;

        } else if (op.startDate <= snapshotDateStr) { // Latent P&L
            if (snapshotForDate && spotRateForSnapshot) {
                const maturityDate = new Date(op.arbitrageDate + 'T00:00:00Z');
                const mtmRate = getInterpolatedRate(maturityDate, snapshotForDate, spotRateForSnapshot);

                if (mtmRate !== null) {
                    const pnlArs = (op.position === 'Vendida' ? op.arbitrageRate - mtmRate : mtmRate - op.arbitrageRate) * op.usdAmount;
                    const pnlUsd = pnlArs / spotRateForSnapshot;
                    
                    totalPnlArs += pnlArs;
                    totalPnlUsd += pnlUsd;
                }
            }
        }
    }

    return { pnlArs: totalPnlArs, pnlUsd: totalPnlUsd };
};
