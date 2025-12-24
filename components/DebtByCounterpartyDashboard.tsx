import React, { useMemo, useState, useCallback } from 'react';
import type { Debt } from '../types';
import { Currency } from '../types';
import { PencilIcon } from './Icons';
import { useFinancialCalculations, selectActiveAndExpiredDebts } from '../utils/calculations';
import { useAppContext } from '../App';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const PALETTE = ['#047857', '#10b981', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#84cc16', '#0891b2', '#f43f5e', '#64748b'];

interface DebtByCounterpartyDashboardProps {
  chartFilter: { type: string; value: string } | null;
  setChartFilter: (filter: { type: 'banks'; value: string } | null) => void;
}

const DebtByCounterpartyDashboard: React.FC<DebtByCounterpartyDashboardProps> = ({ chartFilter, setChartFilter }) => {
  const { companyDebts, banks, brokers, appSettings } = useFinancialCalculations();
  
  const { activeDebts } = useMemo(() => selectActiveAndExpiredDebts(companyDebts), [companyDebts]);

  const debtData = useMemo(() => {
    const byCounterparty: Record<string, number> = {};

    activeDebts.forEach(debt => {
      const counterpartyName = debt.bankId 
        ? banks.find(b => b.id === debt.bankId)?.name
        : brokers.find(b => b.id === debt.brokerId)?.name;
      
      if (counterpartyName) {
        const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
        const debtStockUSD = debt.currency === Currency.USD ? principalNative : principalNative / debt.exchangeRateAtOrigination;
        byCounterparty[counterpartyName] = (byCounterparty[counterpartyName] || 0) + debtStockUSD;
      }
    });

    return Object.entries(byCounterparty).map(([name, value]) => ({ name, value }));
  }, [activeDebts, banks, brokers]);


  const handlePieClick = useCallback((data: any) => {
    const { name } = data;
    if (chartFilter && chartFilter.type === 'banks' && chartFilter.value === name) {
        setChartFilter(null);
    } else {
        setChartFilter({ type: 'banks', value: name });
    }
  }, [chartFilter, setChartFilter]);
  
  const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (debtData.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm"><p>No hay deudas para mostrar.</p></div>;
  }
  
  return (
    <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
        <PieChart>
            <Pie
                data={debtData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                labelLine={false}
                onClick={handlePieClick}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                    const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
                    const x = Number(cx) + radius * Math.cos(-midAngle * (Math.PI / 180));
                    const y = Number(cy) + radius * Math.sin(-midAngle * (Math.PI / 180));
                    if (percent < 0.05) return null;
                    return (
                        <text x={x} y={y} fill={appSettings.theme === 'dark' ? '#d1d5db' : '#4b5563'} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12">
                            {`${(percent * 100).toFixed(0)}%`}
                        </text>
                    );
                }}
            >
            {debtData.map((entry, index) => (
                <Cell 
                    key={`cell-${index}`} 
                    fill={PALETTE[index % PALETTE.length]} 
                    opacity={chartFilter && chartFilter.type === 'banks' && chartFilter.value !== entry.name ? 0.5 : 1}
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s ease-in-out' }}
                />
            ))}
            </Pie>
            <Tooltip
                formatter={(value: number) => [formatUSD(value), "Deuda"]}
                contentStyle={appSettings.theme === 'dark' ? { backgroundColor: 'rgba(31, 41, 55, 0.9)', border: '1px solid #4b5563' } : {}}
                wrapperStyle={{ zIndex: 10 }}
            />
            <Legend iconSize={10} wrapperStyle={{fontSize: '12px'}}/>
        </PieChart>
        </ResponsiveContainer>
    </div>
  );
};

export default DebtByCounterpartyDashboard;