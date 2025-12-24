import React, { useMemo } from 'react';
import type { Debt } from '../types';
import { Currency } from '../types';
import { getTodayArgentinaDate, daysBetween } from '../utils/financials';
import { useFinancialCalculations } from '../utils/calculations';

interface EventsTimelineProps {
    debts: Debt[];
}

const EventsTimeline: React.FC<EventsTimelineProps> = ({ debts }) => {
    const { latestRate } = useFinancialCalculations();

    const events = useMemo(() => {
        const today = getTodayArgentinaDate();
        const ninetyDaysFromNow = new Date(today);
        ninetyDaysFromNow.setDate(today.getDate() + 90);

        const significantDebts = debts
            .filter(d => {
                const dueDate = new Date(d.dueDate + "T00:00:00Z");
                return dueDate >= today && dueDate <= ninetyDaysFromNow;
            })
            .map(d => {
                const principalNative = d.calculationMode === 'futureValue' ? (d.netAmountReceived || 0) : d.amount;
                const valueUSD = d.currency === Currency.USD ? principalNative : principalNative / latestRate;
                return {
                    id: d.id,
                    date: d.dueDate,
                    type: 'Vencimiento Deuda',
                    description: d.type,
                    amountUSD: valueUSD,
                };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return significantDebts;

    }, [debts, latestRate]);

    if (events.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">No hay eventos importantes en los próximos 90 días.</div>;
    }
    
    const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

    return (
        <div className="flex overflow-x-auto space-x-4 pb-4">
            {events.map(event => (
                <div key={event.id} className="flex-shrink-0 w-48 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                    <p className="font-bold text-sm text-primary dark:text-accent-dm">{new Date(event.date + "T00:00:00Z").toLocaleDateString('es-AR', { timeZone: 'UTC', day:'2-digit', month:'short' })}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{event.type}</p>
                    <p className="text-sm mt-1 truncate">{event.description}</p>
                    <p className="text-sm font-bold mt-2">{formatUSD(event.amountUSD)}</p>
                </div>
            ))}
        </div>
    );
};

export default EventsTimeline;