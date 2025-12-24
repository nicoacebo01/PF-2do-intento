import React, { useMemo } from 'react';
import type { Debt, DebtType } from '../types';
import { Currency } from '../types';
import { useFinancialCalculations } from '../utils/calculations';
import HelpTooltip from './HelpTooltip';

interface RiskHeatmapProps {
    heatmapData: {
        matrix: Record<string, Record<string, number>>;
        counterparties: { id: string; name: string; type: string; }[];
        totalDebt: number;
    };
    debtTypes: DebtType[];
}

const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ heatmapData, debtTypes }) => {
    const { matrix, counterparties, totalDebt } = heatmapData;

    const getColor = (value: number) => {
        if (!totalDebt || totalDebt === 0) return 'bg-gray-100 dark:bg-gray-700';
        const percentage = (value / totalDebt) * 100;
        if (percentage > 20) return 'bg-red-500 text-white';
        if (percentage > 15) return 'bg-red-400 text-white';
        if (percentage > 10) return 'bg-orange-400 text-white';
        if (percentage > 5) return 'bg-yellow-400 text-gray-800';
        if (percentage > 1) return 'bg-green-300 text-gray-800';
        if (percentage > 0) return 'bg-green-200 text-gray-800';
        return 'bg-gray-100 dark:bg-gray-700';
    };
    
    const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

    if (counterparties.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">No hay datos para mostrar.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th className="p-2 border dark:border-gray-600 text-left font-semibold text-gray-700 dark:text-gray-200 sticky left-0 bg-gray-100 dark:bg-gray-700 z-10">Contraparte</th>
                        {debtTypes.map(dt => (
                            <th key={dt.id} className="p-2 border dark:border-gray-600 text-center font-semibold text-gray-700 dark:text-gray-200">{dt.name}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {counterparties.map(c => (
                        <tr key={c.id}>
                            <td className="p-2 border dark:border-gray-600 font-semibold sticky left-0 bg-white dark:bg-gray-800 z-10">{c.name}</td>
                            {debtTypes.map(dt => {
                                const value = matrix[c.name]?.[dt.name] || 0;
                                return (
                                    <td key={dt.id} className={`p-2 border dark:border-gray-600 text-center transition-colors ${getColor(value)}`}>
                                        <HelpTooltip text={formatUSD(value)}>
                                            <span>{value > 0 ? `${((value / totalDebt) * 100).toFixed(1)}%` : '-'}</span>
                                        </HelpTooltip>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default RiskHeatmap;