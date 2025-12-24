// This is a new file: components/ExpandedFlowModal.tsx
import React, { useMemo } from 'react';
import type { GrainCollection, CollectionAdjustment, Bank } from '../types';
import { XIcon } from './Icons';

interface ExpandedFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: GrainCollection[];
  adjustments: CollectionAdjustment[];
  today: Date;
  banks: Bank[];
  filters: { buyer: string };
  holidays: string[];
}

const formatCurrency = (amount: number) => amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const ExpandedFlowModal: React.FC<ExpandedFlowModalProps> = ({ isOpen, onClose, collections, adjustments, today, banks, filters, holidays }) => {
  const { dates, buyers, flowData } = useMemo(() => {
    const lastDueDate = collections.reduce((maxDate, c) => {
        const collectionDateStr = c.actualCollectionDate || c.dueDate;
        if (!collectionDateStr) return maxDate;
        const d = new Date(collectionDateStr + 'T00:00:00Z');
        return d > maxDate ? d : maxDate;
    }, new Date(0));
    
    const ninetyDaysFromNow = new Date(today);
    ninetyDaysFromNow.setUTCDate(today.getUTCDate() + 90);

    let endDate = lastDueDate > ninetyDaysFromNow ? ninetyDaysFromNow : lastDueDate;
    if (endDate < today && collections.length > 0) {
      endDate = lastDueDate;
    } else if (endDate < today) {
      endDate = ninetyDaysFromNow;
    }

    const datesArray: Date[] = [];
    for (let d = new Date(today.getTime()); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        datesArray.push(new Date(d));
    }
    const dates = datesArray.map(d => d.toISOString().split('T')[0]);
    const buyersSet = new Set<string>();

    const flow: { [date: string]: { [buyer: string]: number } } = {};
    collections.forEach(c => {
        if (c.status === 'matched') {
            const collectionDate = c.actualCollectionDate || c.dueDate;
            if (!collectionDate || !dates.includes(collectionDate)) return;
            const netAmount = c.finalNetAmount ?? (c.grossAmount * (1 - (c.tentativeDeductionPercentage / 100)));
            const finalAmount = c.movementType === 'Débito' ? netAmount : -netAmount;
            buyersSet.add(c.buyerName);
            if (!flow[collectionDate]) flow[collectionDate] = {};
            flow[collectionDate][c.buyerName] = (flow[collectionDate][c.buyerName] || 0) + finalAmount;
        }
    });

    return { dates, buyers: Array.from(buyersSet).sort(), flowData: flow };
  }, [collections, today]);

  const flowTotals = useMemo(() => {
    const dateTotals: { [date: string]: number } = {};
    const buyerTotals: { [buyer: string]: number } = {};
    let grandTotal = 0;
    
    buyers.forEach(buyer => {
        buyerTotals[buyer] = 0;
        dates.forEach(date => {
            const value = flowData[date]?.[buyer] || 0;
            dateTotals[date] = (dateTotals[date] || 0) + value;
            buyerTotals[buyer] += value;
            grandTotal += value;
        });
    });
    return { dateTotals, buyerTotals, grandTotal };
  }, [flowData, dates, buyers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl m-4 h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Flujo de Cobranzas Extendido</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th className="p-2 border dark:border-gray-600 text-left sticky left-0 bg-gray-100 dark:bg-gray-700 z-10">Comprador</th>
                        {dates.map(date => {
                            const d = new Date(date + 'T00:00:00Z');
                            const dayOfWeek = d.getUTCDay();
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                            const isHoliday = holidays.includes(date);
                            const day = d.toLocaleDateString('es-AR', { weekday: 'short', timeZone: 'UTC' });
                            const dayNum = d.toLocaleDateString('es-AR', { day: '2-digit', timeZone: 'UTC' });
                            return (
                                <th key={date} className={`p-2 border dark:border-gray-600 text-center ${isWeekend || isHoliday ? 'bg-gray-200 dark:bg-gray-700/60' : ''}`}>
                                    <div>{day}</div><div className="font-normal">{dayNum}</div>
                                </th>
                            )
                        })}
                        <th className="p-2 border dark:border-gray-600 text-right sticky right-0 bg-gray-100 dark:bg-gray-700 z-10">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {buyers.map(buyer => (
                        <tr key={buyer} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                            <td className="p-2 border dark:border-gray-600 sticky left-0 bg-white dark:bg-gray-800 z-10 font-semibold">{buyer}</td>
                            {dates.map(date => {
                                const totalAmount = flowData[date]?.[buyer] || 0;
                                const d = new Date(date + 'T00:00:00Z');
                                const dayOfWeek = d.getUTCDay();
                                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                const isHoliday = holidays.includes(date);
                                return (
                                    <td key={date} className={`p-2 border dark:border-gray-600 text-right ${isWeekend || isHoliday ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}>
                                        {totalAmount !== 0 ? <span className={isWeekend || isHoliday ? 'font-semibold' : ''}>{formatCurrency(totalAmount)}</span> : '-'}
                                    </td>
                                )
                            })}
                            <td className="p-2 border dark:border-gray-600 text-right font-bold sticky right-0 bg-white dark:bg-gray-800 z-10">{formatCurrency(flowTotals.buyerTotals[buyer] || 0)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="font-bold bg-gray-200 dark:bg-gray-600 text-base">
                    <tr>
                        <td className="p-2 border dark:border-gray-600 sticky left-0 bg-gray-200 dark:bg-gray-600 z-10">Total por Día</td>
                        {dates.map(date => {
                            const isWeekend = new Date(date + 'T00:00:00Z').getUTCDay() % 6 === 0;
                            const isHoliday = holidays.includes(date);
                            return (
                                <td key={date} className={`p-2 border dark:border-gray-600 text-right ${isWeekend || isHoliday ? 'bg-gray-200 dark:bg-gray-700/80' : ''}`}>
                                    {formatCurrency(flowTotals.dateTotals[date] || 0)}
                                </td>
                            )
                        })}
                        <td className="p-2 border dark:border-gray-600 text-right sticky right-0 bg-gray-200 dark:bg-gray-600 z-10 text-lg">{formatCurrency(flowTotals.grandTotal)}</td>
                    </tr>
                </tfoot>
            </table>
          </div>
        </div>
        <div className="flex justify-end p-4 border-t dark:border-gray-700">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 font-bold py-2 px-4 rounded-lg">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default ExpandedFlowModal;